const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all employees
router.get('/', (req, res) => {
    try {
        const { department, status, search } = req.query;
        let query = 'SELECT * FROM employees WHERE 1=1';
        const params = [];

        if (status) { query += ' AND status = ?'; params.push(status); }
        if (department) { query += ' AND department = ?'; params.push(department); }
        if (search) {
            query += ' AND (first_name LIKE ? OR last_name LIKE ? OR employee_number LIKE ? OR position LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        query += ' ORDER BY first_name, last_name';
        const employees = db.prepare(query).all(...params);
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET employee by ID
router.get('/:id', (req, res) => {
    try {
        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json(employee);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create employee
router.post('/', (req, res) => {
    try {
        const {
            employee_number, first_name, last_name, email, phone,
            position, department, hire_date, salary_type, base_salary,
            housing_allowance, transport_allowance, other_allowance, annual_incentive_multiplier, grade
        } = req.body;

        const result = db.prepare(`
      INSERT INTO employees 
      (employee_number, first_name, last_name, email, phone, position, department, hire_date,
       salary_type, base_salary, housing_allowance, transport_allowance, other_allowance, annual_incentive_multiplier, grade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            employee_number, first_name, last_name, email, phone,
            position, department, hire_date, salary_type || 'monthly',
            base_salary || 0, housing_allowance || 0, transport_allowance || 0,
            other_allowance || 0, annual_incentive_multiplier || 0, grade || null
        );

        // Create initial leave balance for current year
        const year = new Date().getFullYear();
        db.prepare(`
      INSERT OR IGNORE INTO leave_balance (employee_id, year)
      VALUES (?, ?)
    `).run(result.lastInsertRowid, year);

        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(employee);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update employee
router.put('/:id', (req, res) => {
    try {
        const {
            employee_number, first_name, last_name, email, phone,
            position, department, hire_date, salary_type, base_salary,
            housing_allowance, transport_allowance, other_allowance, annual_incentive_multiplier, status, grade
        } = req.body;

        db.prepare(`
      UPDATE employees SET
        employee_number = ?, first_name = ?, last_name = ?, email = ?, phone = ?,
        position = ?, department = ?, hire_date = ?, salary_type = ?, base_salary = ?,
        housing_allowance = ?, transport_allowance = ?, other_allowance = ?,
        annual_incentive_multiplier = ?, status = ?, grade = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
            employee_number, first_name, last_name, email, phone,
            position, department, hire_date, salary_type,
            base_salary, housing_allowance, transport_allowance,
            other_allowance, annual_incentive_multiplier, status || 'active', grade || null,
            req.params.id
        );

        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
        res.json(employee);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE employee
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
        res.json({ message: 'Employee deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET departments list
router.get('/meta/departments', (req, res) => {
    try {
        const departments = db.prepare('SELECT DISTINCT department FROM employees ORDER BY department').all();
        res.json(departments.map(d => d.department));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET employee leave balance (Saudi Labor Law compliant)
router.get('/:id/leave-balance', (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        let balance = db.prepare('SELECT * FROM leave_balance WHERE employee_id = ? AND year = ?').get(req.params.id, year);
        if (!balance) {
            db.prepare('INSERT OR IGNORE INTO leave_balance (employee_id, year) VALUES (?, ?)').run(req.params.id, year);
            balance = db.prepare('SELECT * FROM leave_balance WHERE employee_id = ? AND year = ?').get(req.params.id, year);
        }

        // Calculate dynamic annual leave based on service years (Art. 109)
        const employee = db.prepare('SELECT hire_date FROM employees WHERE id = ?').get(req.params.id);
        let serviceYears = 0;
        if (employee && employee.hire_date) {
            const hireDate = new Date(employee.hire_date);
            const now = new Date();
            serviceYears = (now - hireDate) / (1000 * 60 * 60 * 24 * 365.25);
        }
        const dynamicAnnualTotal = serviceYears >= 5 ? 30 : 21;

        // Calculate sick leave tier breakdown
        const sickUsed = balance.sick_leave_used || 0;
        const fullPayDays = balance.sick_leave_full_pay_days || 30;
        const seventyFivePayDays = balance.sick_leave_75_pay_days || 60;
        const fiftyPayDays = balance.sick_leave_50_pay_days || 30;

        const tier1Used = Math.min(sickUsed, fullPayDays);
        const tier2Used = Math.min(Math.max(0, sickUsed - fullPayDays), seventyFivePayDays);
        const tier3Used = Math.min(Math.max(0, sickUsed - fullPayDays - seventyFivePayDays), fiftyPayDays);

        res.json({
            ...balance,
            annual_leave_total: dynamicAnnualTotal,
            service_years: Math.floor(serviceYears),
            annual_leave: {
                total: dynamicAnnualTotal,
                used: balance.annual_leave_used || 0,
                remaining: dynamicAnnualTotal - (balance.annual_leave_used || 0),
                pay_rate: 1.0
            },
            emergency_leave: {
                total: balance.emergency_leave_total || 10,
                used: balance.emergency_leave_used || 0,
                remaining: (balance.emergency_leave_total || 10) - (balance.emergency_leave_used || 0),
                pay_rate: 1.0
            },
            sick_leave: {
                total: balance.sick_leave_total || 120,
                used: sickUsed,
                remaining: (balance.sick_leave_total || 120) - sickUsed,
                tiers: [
                    { label: '100% Pay', label_ar: 'راتب كامل 100%', days: fullPayDays, used: tier1Used, remaining: fullPayDays - tier1Used, pay_rate: 1.0 },
                    { label: '75% Pay', label_ar: 'راتب 75%', days: seventyFivePayDays, used: tier2Used, remaining: seventyFivePayDays - tier2Used, pay_rate: 0.75 },
                    { label: '50% Pay', label_ar: 'راتب 50%', days: fiftyPayDays, used: tier3Used, remaining: fiftyPayDays - tier3Used, pay_rate: 0.50 },
                    { label: 'HR Decision', label_ar: 'قرار الموارد البشرية', days: null, used: Math.max(0, sickUsed - fullPayDays - seventyFivePayDays - fiftyPayDays), remaining: null, pay_rate: 0 }
                ]
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
