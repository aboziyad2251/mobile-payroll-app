const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all settings
router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update settings
router.put('/', (req, res) => {
    try {
        const updates = req.body;
        const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const updateMany = db.transaction((items) => {
            for (const [key, value] of Object.entries(items)) {
                updateSetting.run(key, String(value));
            }
        });
        updateMany(updates);
        const rows = db.prepare('SELECT key, value FROM settings').all();
        res.json(rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {}));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
