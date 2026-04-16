const express = require('express');
const router = express.Router();
const db = require('../database');

const getSettings = () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
};

const calcMinutesLate = (checkIn, workStart) => {
    if (!checkIn) return 0;
    const [sh, sm] = workStart.split(':').map(Number);
    const [ch, cm] = checkIn.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const checkInMinutes = ch * 60 + cm;
    return Math.max(0, checkInMinutes - startMinutes);
};

// GET attendance for date range / employee
router.get('/', (req, res) => {
    try {
        const { employee_id, start_date, end_date, date, month, year } = req.query;
        let query = `
      SELECT a.*, e.first_name, e.last_name, e.employee_number, e.department, e.position
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE 1=1
    `;
        const params = [];

        if (employee_id) { query += ' AND a.employee_id = ?'; params.push(employee_id); }
        if (date) { query += ' AND a.date = ?'; params.push(date); }
        if (start_date) { query += ' AND a.date >= ?'; params.push(start_date); }
        if (end_date) { query += ' AND a.date <= ?'; params.push(end_date); }
        if (month && year) {
            query += ' AND strftime("%m", a.date) = ? AND strftime("%Y", a.date) = ?';
            params.push(String(month).padStart(2, '0'), String(year));
        }
        query += ' ORDER BY a.date DESC, e.first_name';

        const records = db.prepare(query).all(...params);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET today's attendance summary
router.get('/today', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const summary = db.prepare(`
      SELECT
        COUNT(*) as total_employees,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'annual_leave' THEN 1 ELSE 0 END) as annual_leave,
        SUM(CASE WHEN a.status = 'sick_leave' THEN 1 ELSE 0 END) as sick_leave,
        SUM(CASE WHEN a.status = 'emergency_leave' THEN 1 ELSE 0 END) as emergency_leave,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
      WHERE e.status = 'active'
    `).get(today);
        res.json({ date: today, ...summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST - Check in
router.post('/checkin', (req, res) => {
    try {
        const { employee_id, check_in, notes } = req.body;
        const date = new Date().toISOString().split('T')[0];
        const settings = getSettings();
        const minutesLate = calcMinutesLate(check_in, settings.work_start_time);
        const status = 'present';

        const existing = db.prepare('SELECT id FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
        if (existing) {
            db.prepare(`UPDATE attendance SET check_in = ?, status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
                .run(check_in, status, notes, existing.id);
        } else {
            db.prepare(`INSERT INTO attendance (employee_id, date, check_in, status, notes) VALUES (?, ?, ?, ?, ?)`)
                .run(employee_id, date, check_in, status, notes);
        }
        const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
        res.json({ ...record, minutes_late: minutesLate });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST - Check out
router.post('/checkout', (req, res) => {
    try {
        const { employee_id, check_out } = req.body;
        const date = new Date().toISOString().split('T')[0];
        const settings = getSettings();
        const [eh, em] = settings.work_end_time.split(':').map(Number);
        const [ch, cm] = check_out.split(':').map(Number);
        const overtimeMinutes = Math.max(0, (ch * 60 + cm) - (eh * 60 + em));

        db.prepare(`
      UPDATE attendance SET check_out = ?, overtime_minutes = ?, updated_at = datetime('now')
      WHERE employee_id = ? AND date = ?
    `).run(check_out, overtimeMinutes, employee_id, date);

        const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
        res.json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST - Break start
router.post('/break/start', (req, res) => {
    try {
        const { employee_id, break_start } = req.body;
        const date = new Date().toISOString().split('T')[0];
        db.prepare(`UPDATE attendance SET break_start = ?, updated_at = datetime('now') WHERE employee_id = ? AND date = ?`)
            .run(break_start, employee_id, date);
        res.json({ message: 'Break started', break_start });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST - Break end
router.post('/break/end', (req, res) => {
    try {
        const { employee_id, break_end } = req.body;
        const date = new Date().toISOString().split('T')[0];
        const record = db.prepare('SELECT break_start FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
        let totalBreak = 0;
        if (record && record.break_start) {
            const [sh, sm] = record.break_start.split(':').map(Number);
            const [eh, em] = break_end.split(':').map(Number);
            totalBreak = (eh * 60 + em) - (sh * 60 + sm);
        }
        db.prepare(`UPDATE attendance SET break_end = ?, total_break_minutes = ?, updated_at = datetime('now') WHERE employee_id = ? AND date = ?`)
            .run(break_end, totalBreak, employee_id, date);
        res.json({ message: 'Break ended', break_end, total_break_minutes: totalBreak });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST - Mark attendance status (for absences, leaves)
router.post('/mark', (req, res) => {
    try {
        const { employee_id, date, status, notes } = req.body;

        // Update leave balance
        const year = date.split('-')[0];
        const leaveMap = { annual_leave: 'annual_leave', sick_leave: 'sick_leave', emergency_leave: 'emergency_leave' };
        if (leaveMap[status]) {
            const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
            if (!existing || existing.status !== status) {
                const col = leaveMap[status].replace('_leave', '_leave_used');
                db.prepare(`UPDATE leave_balance SET ${col} = ${col} + 1 WHERE employee_id = ? AND year = ?`)
                    .run(employee_id, parseInt(year));
            }
            // If changing status, restore old balance
            if (existing && leaveMap[existing.status]) {
                const oldCol = leaveMap[existing.status].replace('_leave', '_leave_used');
                db.prepare(`UPDATE leave_balance SET ${oldCol} = MAX(0, ${oldCol} - 1) WHERE employee_id = ? AND year = ?`)
                    .run(employee_id, parseInt(year));
            }
        }

        db.prepare(`
      INSERT INTO attendance (employee_id, date, status, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(employee_id, date)
      DO UPDATE SET status = excluded.status, notes = excluded.notes, updated_at = datetime('now')
    `).run(employee_id, date, status, notes);

        const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
        res.json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT - Update attendance record
router.put('/:id', (req, res) => {
    try {
        const { check_in, check_out, break_start, break_end, status, notes } = req.body;
        let totalBreak = 0;
        if (break_start && break_end) {
            const [sh, sm] = break_start.split(':').map(Number);
            const [eh, em] = break_end.split(':').map(Number);
            totalBreak = (eh * 60 + em) - (sh * 60 + sm);
        }

        db.prepare(`
      UPDATE attendance SET
        check_in = ?, check_out = ?, break_start = ?, break_end = ?,
        total_break_minutes = ?, status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(check_in, check_out, break_start, break_end, totalBreak, status, notes, req.params.id);

        const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
        res.json(record);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET monthly attendance summary for an employee
router.get('/summary/:employee_id', (req, res) => {
    try {
        const { month, year } = req.query;
        const summary = db.prepare(`
      SELECT
        COUNT(*) as total_records,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'annual_leave' THEN 1 ELSE 0 END) as annual_leave,
        SUM(CASE WHEN status = 'sick_leave' THEN 1 ELSE 0 END) as sick_leave,
        SUM(CASE WHEN status = 'emergency_leave' THEN 1 ELSE 0 END) as emergency_leave,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused,
        SUM(total_break_minutes) as total_break_minutes,
        SUM(overtime_minutes) as total_overtime_minutes
      FROM attendance
      WHERE employee_id = ?
      AND strftime('%m', date) = ?
      AND strftime('%Y', date) = ?
    `).get(req.params.employee_id, String(month).padStart(2, '0'), String(year));
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
