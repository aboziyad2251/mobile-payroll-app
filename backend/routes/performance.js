const express = require('express');
const router = express.Router();
const db = require('../database');

const getRating = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Average';
    if (score >= 40) return 'Needs Improvement';
    return 'Poor';
};

const calculateScore = (presentDays, totalDays, lateCount, warningCount, abscentDays) => {
    if (totalDays === 0) return 0;
    // Attendance score /40
    const attendanceScore = Math.max(0, (presentDays / totalDays) * 40);
    // Punctuality /25 (5 pts off per late incident, max deduct 25)
    const punctualityScore = Math.max(0, 25 - (lateCount * 5));
    // Leave management /20 (5 pts off per unexcused absent)
    const leaveScore = Math.max(0, 20 - (abscentDays * 5));
    // Discipline /15 (5 pts off per warning)
    const disciplineScore = Math.max(0, 15 - (warningCount * 5));

    return {
        attendance_score: Math.round(attendanceScore * 10) / 10,
        punctuality_score: Math.round(punctualityScore * 10) / 10,
        leave_score: Math.round(leaveScore * 10) / 10,
        discipline_score: Math.round(disciplineScore * 10) / 10,
        total_score: Math.round((attendanceScore + punctualityScore + leaveScore + disciplineScore) * 10) / 10
    };
};

// GET performance rankings
router.get('/rankings', (req, res) => {
    try {
        const { period, date, week_start, month, year } = req.query;
        let records;

        if (period === 'daily' && date) {
            records = db.prepare(`
        SELECT * FROM performance WHERE period = 'daily' AND period_start = ?
        ORDER BY total_score DESC
      `).all(date);
        } else if (period === 'weekly' && week_start) {
            records = db.prepare(`
        SELECT * FROM performance WHERE period = 'weekly' AND period_start = ?
        ORDER BY total_score DESC
      `).all(week_start);
        } else if (period === 'monthly' && month && year) {
            const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
            records = db.prepare(`
        SELECT p.*, e.first_name, e.last_name, e.employee_number, e.department, e.position
        FROM performance p
        JOIN employees e ON p.employee_id = e.id
        WHERE p.period = 'monthly' AND p.period_start = ?
        ORDER BY p.total_score DESC
      `).all(periodStart);
        } else {
            records = db.prepare(`
        SELECT p.*, e.first_name, e.last_name, e.employee_number, e.department, e.position
        FROM performance p JOIN employees e ON p.employee_id = e.id
        ORDER BY p.created_at DESC, p.total_score DESC
        LIMIT 100
      `).all();
        }

        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST calculate and store performance for a period
router.post('/calculate', (req, res) => {
    try {
        const { period, period_start, period_end } = req.body;
        const employees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
        const results = [];

        for (const emp of employees) {
            const attRecords = db.prepare(`
        SELECT * FROM attendance
        WHERE employee_id = ? AND date >= ? AND date <= ?
      `).all(emp.id, period_start, period_end);

            const presentDays = attRecords.filter(r => r.status === 'present').length;
            const absentDays = attRecords.filter(r => r.status === 'absent').length;
            const totalDays = attRecords.length || 1;

            // Calculate late arrivals
            const settings = db.prepare("SELECT key, value FROM settings").all()
                .reduce((a, r) => { a[r.key] = r.value; return a; }, {});
            const lateThreshold = parseInt(settings.late_threshold_minutes || '15');
            const [wh, wm] = (settings.work_start_time || '08:00').split(':').map(Number);
            const workStartMinutes = wh * 60 + wm;

            let lateCount = 0;
            for (const r of attRecords) {
                if (r.check_in && r.status === 'present') {
                    const [ch, cm] = r.check_in.split(':').map(Number);
                    if ((ch * 60 + cm) > workStartMinutes + lateThreshold) lateCount++;
                }
            }

            // Warning count in this period
            const warningCount = db.prepare(`
        SELECT COUNT(*) as count FROM warnings
        WHERE employee_id = ? AND issued_date >= ? AND issued_date <= ?
        AND warning_type IN ('first','second','third','final')
      `).get(emp.id, period_start, period_end).count;

            const scores = calculateScore(presentDays, totalDays, lateCount, warningCount, absentDays);

            db.prepare(`
        INSERT INTO performance (employee_id, period, period_start, period_end,
          attendance_score, punctuality_score, leave_score, discipline_score, total_score,
          rating, total_days, present_days, absent_days, late_arrivals, warning_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `).run(
                emp.id, period, period_start, period_end,
                scores.attendance_score, scores.punctuality_score, scores.leave_score, scores.discipline_score,
                scores.total_score, getRating(scores.total_score),
                totalDays, presentDays, absentDays, lateCount, warningCount
            );

            results.push({ employee: `${emp.first_name} ${emp.last_name}`, ...scores, rating: getRating(scores.total_score) });
        }

        // Update ranks
        const ranked = results.sort((a, b) => b.total_score - a.total_score);
        // Return sorted results
        res.json({ period, period_start, period_end, results: ranked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET employee performance history
router.get('/employee/:id', (req, res) => {
    try {
        const { period } = req.query;
        let query = 'SELECT * FROM performance WHERE employee_id = ?';
        const params = [req.params.id];
        if (period) { query += ' AND period = ?'; params.push(period); }
        query += ' ORDER BY period_start DESC LIMIT 12';
        const records = db.prepare(query).all(...params);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET top performers
router.get('/top', (req, res) => {
    try {
        const { period, limit = 10 } = req.query;
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;

        const records = db.prepare(`
      SELECT p.*, e.first_name, e.last_name, e.employee_number, e.department, e.position
      FROM performance p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.period = ? AND p.period_start = ?
      ORDER BY p.total_score DESC
      LIMIT ?
    `).all(period || 'monthly', periodStart, parseInt(limit));

        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
