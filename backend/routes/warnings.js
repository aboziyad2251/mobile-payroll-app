const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all warnings (optionally filtered)
router.get('/', (req, res) => {
    try {
        const { employee_id, warning_type } = req.query;
        let query = `
      SELECT w.*, e.first_name, e.last_name, e.employee_number, e.department
      FROM warnings w
      JOIN employees e ON w.employee_id = e.id
      WHERE 1=1
    `;
        const params = [];
        if (employee_id) { query += ' AND w.employee_id = ?'; params.push(employee_id); }
        if (warning_type) { query += ' AND w.warning_type = ?'; params.push(warning_type); }
        query += ' ORDER BY w.issued_date DESC';

        const warnings = db.prepare(query).all(...params);
        res.json(warnings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET warning count per employee
router.get('/counts', (req, res) => {
    try {
        const counts = db.prepare(`
      SELECT employee_id, COUNT(*) as total_warnings,
        SUM(CASE WHEN warning_type = 'first' THEN 1 ELSE 0 END) as first_warnings,
        SUM(CASE WHEN warning_type = 'second' THEN 1 ELSE 0 END) as second_warnings,
        SUM(CASE WHEN warning_type = 'third' THEN 1 ELSE 0 END) as third_warnings,
        SUM(CASE WHEN warning_type = 'final' THEN 1 ELSE 0 END) as final_warnings,
        SUM(CASE WHEN warning_type = 'recognition' THEN 1 ELSE 0 END) as recognitions
      FROM warnings
      GROUP BY employee_id
    `).all();
        res.json(counts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET employee's next warning type (auto-determine)
router.get('/next-type/:employee_id', (req, res) => {
    try {
        const count = db.prepare(`
      SELECT COUNT(*) as count FROM warnings
      WHERE employee_id = ? AND warning_type IN ('first', 'second', 'third', 'final')
    `).get(req.params.employee_id);

        const types = ['first', 'second', 'third', 'final'];
        const nextIndex = Math.min(count.count, 3);
        res.json({ next_type: types[nextIndex], warning_number: nextIndex + 1, total_issued: count.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST issue a warning
router.post('/', (req, res) => {
    try {
        const { employee_id, warning_type, reason, details, issued_by, issued_date } = req.body;

        // Determine warning_number
        const count = db.prepare(`
      SELECT COUNT(*) as count FROM warnings
      WHERE employee_id = ? AND warning_type IN ('first', 'second', 'third', 'final')
    `).get(employee_id);

        const warning_number = warning_type === 'recognition' ? 0 : count.count + 1;

        const result = db.prepare(`
      INSERT INTO warnings (employee_id, warning_number, warning_type, reason, details, issued_by, issued_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(employee_id, warning_number, warning_type, reason, details, issued_by, issued_date || new Date().toISOString().split('T')[0]);

        const warning = db.prepare(`
      SELECT w.*, e.first_name, e.last_name, e.employee_number
      FROM warnings w JOIN employees e ON w.employee_id = e.id
      WHERE w.id = ?
    `).get(result.lastInsertRowid);
        res.status(201).json(warning);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT acknowledge warning
router.put('/:id/acknowledge', (req, res) => {
    try {
        db.prepare('UPDATE warnings SET acknowledged = 1 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Warning acknowledged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE warning
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM warnings WHERE id = ?').run(req.params.id);
        res.json({ message: 'Warning deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
