const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all payroll records
router.get('/', (req, res) => {
    try {
        const { month, year, employee_id } = req.query;
        let query = `
      SELECT p.*, e.first_name, e.last_name, e.employee_number, e.department, e.position, e.grade
      FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE 1=1
    `;
        const params = [];
        if (month) { query += ' AND p.period_month = ?'; params.push(parseInt(month)); }
        if (year) { query += ' AND p.period_year = ?'; params.push(parseInt(year)); }
        if (employee_id) { query += ' AND p.employee_id = ?'; params.push(employee_id); }
        query += ' ORDER BY p.period_year DESC, p.period_month DESC, e.first_name';
        res.json(db.prepare(query).all(...params));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST calculate payroll for a month
router.post('/calculate', (req, res) => {
    try {
        const { month, year } = req.body;
        const employees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
        const settings = db.prepare('SELECT key, value FROM settings').all()
            .reduce((a, r) => { a[r.key] = r.value; return a; }, {});
        const workingDays = parseInt(settings.working_days_per_month || '22');
        const results = [];

        for (const emp of employees) {
            const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const attSummary = db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as days_worked,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as days_absent,
          SUM(overtime_minutes) as total_overtime_minutes
        FROM attendance WHERE employee_id = ? AND date >= ? AND date <= ?
      `).get(emp.id, periodStart, periodEnd);

            const daysWorked = attSummary.days_worked || workingDays;
            const daysAbsent = attSummary.days_absent || 0;
            const overtimeHours = ((attSummary.total_overtime_minutes || 0) / 60);

            const dailyRate = emp.base_salary / workingDays;

            // Tiered sick leave deduction (Saudi Labor Law Art. 117)
            let sickLeaveDeduction = 0;
            const sickDays = db.prepare(`
                SELECT COUNT(*) as cnt FROM attendance 
                WHERE employee_id = ? AND date >= ? AND date <= ? AND status = 'sick_leave'
            `).get(emp.id, periodStart, periodEnd)?.cnt || 0;

            if (sickDays > 0) {
                const year = parseInt(periodStart.split('-')[0]);
                const balance = db.prepare('SELECT * FROM leave_balance WHERE employee_id = ? AND year = ?').get(emp.id, year);
                const totalSickUsed = (balance?.sick_leave_used || 0);
                const fullPayLimit = balance?.sick_leave_full_pay_days || 30;
                const seventyFiveLimit = (balance?.sick_leave_75_pay_days || 60);
                const fiftyLimit = (balance?.sick_leave_50_pay_days || 30);

                // Calculate deduction for each sick day based on cumulative usage
                for (let d = 0; d < sickDays; d++) {
                    const dayIndex = totalSickUsed - sickDays + d; // position in total usage
                    if (dayIndex < fullPayLimit) {
                        sickLeaveDeduction += 0; // 100% pay, no deduction
                    } else if (dayIndex < fullPayLimit + seventyFiveLimit) {
                        sickLeaveDeduction += dailyRate * 0.25; // 75% pay = 25% deduction
                    } else if (dayIndex < fullPayLimit + seventyFiveLimit + fiftyLimit) {
                        sickLeaveDeduction += dailyRate * 0.50; // 50% pay = 50% deduction
                    } else {
                        sickLeaveDeduction += dailyRate; // HR decision / unpaid
                    }
                }
            }

            const absenceDeduction = dailyRate * daysAbsent;
            const totalDeductions = absenceDeduction + sickLeaveDeduction;
            const overtimePay = (emp.base_salary / workingDays / 8) * 1.5 * overtimeHours;
            const grossPay = emp.base_salary + emp.housing_allowance + emp.transport_allowance + emp.other_allowance + overtimePay;
            const netPay = grossPay - totalDeductions;
            const annualIncentive = emp.annual_incentive_multiplier * emp.base_salary;

            db.prepare(`
        INSERT INTO payroll (employee_id, period_month, period_year, base_salary,
          housing_allowance, transport_allowance, other_allowance, gross_pay, deductions,
          absence_deduction, net_pay, working_days, days_worked, days_absent,
          overtime_hours, overtime_pay, annual_incentive, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed')
        ON CONFLICT(employee_id, period_month, period_year)
        DO UPDATE SET
          base_salary = excluded.base_salary, housing_allowance = excluded.housing_allowance,
          transport_allowance = excluded.transport_allowance, other_allowance = excluded.other_allowance,
          gross_pay = excluded.gross_pay, deductions = excluded.deductions,
          absence_deduction = excluded.absence_deduction, net_pay = excluded.net_pay,
          days_worked = excluded.days_worked, days_absent = excluded.days_absent,
          overtime_hours = excluded.overtime_hours, overtime_pay = excluded.overtime_pay,
          annual_incentive = excluded.annual_incentive, status = 'processed'
      `).run(
                emp.id, month, year, emp.base_salary,
                emp.housing_allowance, emp.transport_allowance, emp.other_allowance,
                grossPay, totalDeductions, totalDeductions, Math.max(0, netPay),
                workingDays, daysWorked, daysAbsent,
                Math.round(overtimeHours * 100) / 100, Math.round(overtimePay * 100) / 100,
                Math.round(annualIncentive * 100) / 100
            );

            results.push({
                employee: `${emp.first_name} ${emp.last_name}`,
                gross_pay: Math.round(grossPay * 100) / 100,
                net_pay: Math.max(0, Math.round(netPay * 100) / 100)
            });
        }

        res.json({ month, year, processed: results.length, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET payroll summary for a month
router.get('/summary', (req, res) => {
    try {
        const { month, year } = req.query;
        const summary = db.prepare(`
      SELECT
        COUNT(*) as total_employees,
        SUM(gross_pay) as total_gross,
        SUM(absence_deduction) as total_deductions,
        SUM(net_pay) as total_net,
        SUM(overtime_pay) as total_overtime,
        SUM(annual_incentive) as total_incentives,
        AVG(net_pay) as avg_net
      FROM payroll WHERE period_month = ? AND period_year = ?
    `).get(parseInt(month), parseInt(year));
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT mark as paid
router.put('/:id/paid', (req, res) => {
    try {
        db.prepare("UPDATE payroll SET status = 'paid', processed_at = datetime('now') WHERE id = ?").run(req.params.id);
        res.json({ message: 'Marked as paid' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// SALARY LADDER ENDPOINTS
// ============================================================

// GET all salary ladder records (optionally filtered by grade)
router.get('/salary-ladder', (req, res) => {
    try {
        const { grade } = req.query;
        let query = 'SELECT * FROM salary_ladder';
        const params = [];
        if (grade) { query += ' WHERE grade = ?'; params.push(grade); }
        query += ' ORDER BY grade, year_number';
        const records = db.prepare(query).all(...params);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all distinct grades in the salary ladder
router.get('/salary-ladder/grades', (req, res) => {
    try {
        const grades = db.prepare('SELECT DISTINCT grade FROM salary_ladder ORDER BY grade').all();
        res.json(grades.map(g => g.grade));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create or update a single salary ladder entry
router.post('/salary-ladder', (req, res) => {
    try {
        const { grade, year_number, min_salary, max_salary, annual_increment } = req.body;
        db.prepare(`
            INSERT INTO salary_ladder (grade, year_number, min_salary, max_salary, annual_increment)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(grade, year_number) DO UPDATE SET
                min_salary = excluded.min_salary,
                max_salary = excluded.max_salary,
                annual_increment = excluded.annual_increment,
                updated_at = datetime('now')
        `).run(grade, year_number, min_salary || 0, max_salary || 0, annual_increment || 0);
        const entry = db.prepare('SELECT * FROM salary_ladder WHERE grade = ? AND year_number = ?').get(grade, year_number);
        res.json(entry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST auto-generate 10-year ladder for a grade
router.post('/salary-ladder/generate', (req, res) => {
    try {
        const { grade, start_min, start_max, annual_increment, years = 10 } = req.body;
        if (!grade || start_min == null || start_max == null) {
            return res.status(400).json({ error: 'grade, start_min, and start_max are required' });
        }

        const increment = annual_increment || 0;
        const entries = [];

        const insertStmt = db.prepare(`
            INSERT INTO salary_ladder (grade, year_number, min_salary, max_salary, annual_increment)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(grade, year_number) DO UPDATE SET
                min_salary = excluded.min_salary,
                max_salary = excluded.max_salary,
                annual_increment = excluded.annual_increment,
                updated_at = datetime('now')
        `);

        const transaction = db.transaction(() => {
            for (let y = 1; y <= years; y++) {
                const minSal = Math.round((start_min + increment * (y - 1)) * 100) / 100;
                const maxSal = Math.round((start_max + increment * (y - 1)) * 100) / 100;
                insertStmt.run(grade, y, minSal, maxSal, increment);
                entries.push({ grade, year_number: y, min_salary: minSal, max_salary: maxSal, annual_increment: increment });
            }
        });
        transaction();

        res.json({ grade, years: entries.length, entries });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update a single salary ladder entry by id
router.put('/salary-ladder/:id', (req, res) => {
    try {
        const { min_salary, max_salary, annual_increment } = req.body;
        db.prepare(`
            UPDATE salary_ladder SET min_salary = ?, max_salary = ?, annual_increment = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(min_salary, max_salary, annual_increment, req.params.id);
        const entry = db.prepare('SELECT * FROM salary_ladder WHERE id = ?').get(req.params.id);
        res.json(entry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE all salary ladder entries for a grade
router.delete('/salary-ladder/:grade', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM salary_ladder WHERE grade = ?').run(req.params.grade);
        res.json({ message: `Deleted ${result.changes} entries for ${req.params.grade}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
