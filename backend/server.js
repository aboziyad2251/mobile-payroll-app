const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// JWT Auth Middleware
const { expressjwt } = require('express-jwt');
app.use('/api', expressjwt({
    secret: process.env.JWT_SECRET || 'payroll_super_secret_key',
    algorithms: ['HS256'],
    credentialsRequired: true
}).unless({ path: ['/api/health', '/api/auth/login'] }));

// Routes
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/warnings', require('./routes/warnings'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/pdf', require('./routes/pdf'));

// Static files for generated PDFs
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend application in production
app.use(express.static(path.join(__dirname, 'public')));

// SPA Catch-all Error handling (Must be defined AFTER static files and APIs)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid token or no token provided' });
    }
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Payroll Server running on http://localhost:${PORT}`);
});

module.exports = app;
