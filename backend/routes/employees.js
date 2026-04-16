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
            housing_allowance, transport_allowance, other_allowance, annual_incentive_multiplier
        } = req.body;

        const result = db.prepare(`
      INSERT INTO employees 
      (employee_number, first_name, last_name, email, phone, position, department, hire_date,
       salary_type, base_salary, housing_allowance, transport_allowance, other_allowance, annual_incentive_multiplier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            employee_number, first_name, last_name, email, phone,
            position, department, hire_date, salary_type || 'monthly',
            base_salary || 0, housing_allowance || 0, transport_allowance || 0,
            other_allowance || 0, annual_incentive_multiplier || 0
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
            housing_allowance, transport_allowance, other_allowance, annual_incentive_multiplier, status
        } = req.body;

        db.prepare(`
      UPDATE employees SET
        employee_number = ?, first_name = ?, last_name = ?, email = ?, phone = ?,
        position = ?, department = ?, hire_date = ?, salary_type = ?, base_salary = ?,
        housing_allowance = ?, transport_allowance = ?, other_allowance = ?,
        annual_incentive_multiplier = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
            employee_number, first_name, last_name, email, phone,
            position, department, hire_date, salary_type,
            base_salary, housing_allowance, transport_allowance,
            other_allowance, annual_incentive_multiplier, status || 'active',
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

// GET employee leave balance
router.get('/:id/leave-balance', (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        let balance = db.prepare('SELECT * FROM leave_balance WHERE employee_id = ? AND year = ?').get(req.params.id, year);
        if (!balance) {
            db.prepare('INSERT OR IGNORE INTO leave_balance (employee_id, year) VALUES (?, ?)').run(req.params.id, year);
            balance = db.prepare('SELECT * FROM leave_balance WHERE employee_id = ? AND year = ?').get(req.params.id, year);
        }
        res.json(balance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
