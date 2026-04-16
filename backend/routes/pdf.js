const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const PDFS_DIR = path.join(__dirname, '..', 'pdfs');
if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });

const getSettings = () => {
    return db.prepare('SELECT key, value FROM settings').all()
        .reduce((a, r) => { a[r.key] = r.value; return a; }, {});
};

const COLORS = {
    primary: '#1a237e',
    secondary: '#283593',
    accent: '#e53935',
    warning: '#f57f17',
    success: '#2e7d32',
    text: '#212121',
    muted: '#757575',
    border: '#e0e0e0',
    lightBg: '#f5f5f5',
};

const drawHeader = (doc, settings, title, color = COLORS.primary) => {
    // Header background
    doc.rect(0, 0, doc.page.width, 100).fill(color);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
        .text(settings.company_name || 'COMPANY NAME', 50, 25, { align: 'center' });
    doc.fontSize(13).font('Helvetica')
        .text(title, 50, 55, { align: 'center' });
    doc.fillColor(COLORS.text).moveDown(2);
};

const drawSection = (doc, label, value, y) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text(label + ':', 50, y);
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.text).text(value || '-', 200, y);
};

const drawInfoTable = (doc, rows, startY) => {
    let y = startY;
    rows.forEach(([label, value], i) => {
        if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 18).fill(COLORS.lightBg);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text(label, 55, y);
        doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(String(value || '-'), 220, y);
        y += 22;
    });
    return y;
};

const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// === WARNING LETTER ===
const generateWarningPDF = (employee, warning, settings, filename) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filePath = path.join(PDFS_DIR, filename);
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const warningColors = {
            first: COLORS.warning,
            second: '#e65100',
            third: COLORS.accent,
            final: '#b71c1c',
            recognition: COLORS.success
        };
        const headerColor = warningColors[warning.warning_type] || COLORS.primary;

        const titles = {
            first: 'FIRST WARNING LETTER',
            second: 'SECOND WARNING LETTER',
            third: 'THIRD WARNING LETTER',
            final: 'FINAL WARNING / TERMINATION NOTICE',
            recognition: 'EMPLOYEE RECOGNITION CERTIFICATE'
        };

        drawHeader(doc, settings, titles[warning.warning_type] || 'WARNING LETTER', headerColor);

        // Reference and date
        doc.fontSize(9).fillColor(COLORS.muted)
            .text(`Ref: WRN-${String(warning.id).padStart(4, '0')}`, 50, 115)
            .text(`Date: ${formatDate(warning.issued_date)}`, 0, 115, { align: 'right', width: doc.page.width - 100 });

        // Divider
        doc.moveTo(50, 130).lineTo(doc.page.width - 50, 130).strokeColor(COLORS.border).lineWidth(1).stroke();

        // Employee info box
        doc.rect(50, 140, doc.page.width - 100, 90).fill(COLORS.lightBg);
        doc.fillColor(COLORS.text);
        const infoY = 145;
        drawSection(doc, 'Employee Name', `${employee.first_name} ${employee.last_name}`, infoY);
        drawSection(doc, 'Employee ID', employee.employee_number, infoY + 18);
        drawSection(doc, 'Department', employee.department, infoY + 36);
        drawSection(doc, 'Position', employee.position, infoY + 54);

        doc.moveDown(5);

        // Body text
        const bodyY = 245;
        doc.font('Helvetica').fontSize(11).fillColor(COLORS.text);

        if (warning.warning_type === 'recognition') {
            doc.text(`Dear ${employee.first_name} ${employee.last_name},`, 50, bodyY)
                .moveDown(0.5)
                .text(`We are delighted to formally recognize your exceptional performance and dedication to ${settings.company_name || 'the company'}. Your commitment to excellence serves as an inspiration to your colleagues and greatly contributes to our organization's success.`, { width: doc.page.width - 100 })
                .moveDown(0.5)
                .text(`Reason for Recognition:`, { underline: true })
                .moveDown(0.3)
                .text(warning.reason, { indent: 20 });
            if (warning.details) {
                doc.moveDown(0.4).text(warning.details, { indent: 20, color: COLORS.muted });
            }
            doc.moveDown()
                .text(`This certificate is a testament to your hard work and outstanding contribution. We look forward to your continued excellence.`);
        } else {
            const warningOrdinal = { first: 'first', second: 'second', third: 'third', final: 'final and formal' };
            doc.text(`Dear ${employee.first_name} ${employee.last_name},`, 50, bodyY)
                .moveDown(0.5);

            if (warning.warning_type === 'final') {
                doc.text(`This letter serves as your FINAL WARNING and formal notice regarding serious conduct issues. Failure to comply with company policies may result in immediate termination of employment.`, { width: doc.page.width - 100 });
            } else {
                doc.text(`This letter serves as your ${warningOrdinal[warning.warning_type]} formal warning regarding the following matter:`, { width: doc.page.width - 100 });
            }

            doc.moveDown(0.5)
                .font('Helvetica-Bold').text('Reason:', { underline: false })
                .font('Helvetica').text(warning.reason, { indent: 20 });

            if (warning.details) {
                doc.moveDown(0.3).font('Helvetica-Bold').text('Details:')
                    .font('Helvetica').text(warning.details, { indent: 20 });
            }

            doc.moveDown();
            if (warning.warning_type === 'first') {
                doc.text(`We expect immediate improvement. Should this behavior continue, further disciplinary action will be taken, including a second and subsequent warnings.`);
            } else if (warning.warning_type === 'second') {
                doc.text(`This is your second warning. Your conduct has not improved as expected. A third and final warning may result in termination of your employment.`);
            } else if (warning.warning_type === 'third') {
                doc.text(`This is your third and penultimate warning. Any further violations of company policy will result in immediate termination of employment.`);
            } else if (warning.warning_type === 'final') {
                doc.text(`This constitutes your final warning. Any further misconduct or policy violations will result in the immediate termination of your employment contract, without additional notice.`);
            }

            doc.moveDown().text(`You are requested to acknowledge receipt of this letter by signing below.`);
        }

        // Signatures
        const sigY = doc.y + 40;
        doc.fontSize(10).fillColor(COLORS.text);
        doc.text('_______________________', 50, sigY).text('Employee Signature', 50, sigY + 15).text(formatDate(warning.issued_date), 50, sigY + 30);
        doc.text('_______________________', 350, sigY).text(`Issued by: ${warning.issued_by}`, 350, sigY + 15).text('HR Department', 350, sigY + 30);

        // Footer
        const footerY = doc.page.height - 60;
        doc.rect(0, footerY - 5, doc.page.width, 65).fill(COLORS.lightBg);
        doc.fontSize(8).fillColor(COLORS.muted)
            .text(`${settings.company_name || 'Company'} — Confidential HR Document | Generated: ${new Date().toLocaleDateString()}`, 50, footerY + 5, { align: 'center' });

        doc.end();
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
};

// === PAYSLIP PDF ===
const generatePayslipPDF = (employee, payroll, settings, filename) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filePath = path.join(PDFS_DIR, filename);
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const monthName = new Date(payroll.period_year, payroll.period_month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

        drawHeader(doc, settings, `PAYSLIP — ${monthName.toUpperCase()}`, COLORS.primary);

        doc.fontSize(9).fillColor(COLORS.muted)
            .text(`Pay Slip #: PAY-${payroll.period_year}${String(payroll.period_month).padStart(2, '0')}-${String(employee.id).padStart(3, '0')}`, 50, 115)
            .text(`Generated: ${new Date().toLocaleDateString()}`, 0, 115, { align: 'right', width: doc.page.width - 100 });

        doc.moveTo(50, 130).lineTo(doc.page.width - 50, 130).strokeColor(COLORS.border).lineWidth(1).stroke();

        // Employee Info
        doc.rect(50, 140, doc.page.width - 100, 90).fill(COLORS.lightBg);
        const infoY = 145;
        drawSection(doc, 'Employee Name', `${employee.first_name} ${employee.last_name}`, infoY);
        drawSection(doc, 'Employee ID', employee.employee_number, infoY + 18);
        drawSection(doc, 'Department', employee.department, infoY + 36);
        drawSection(doc, 'Position', employee.position, infoY + 54);

        // Earnings table
        const tableY = 245;
        doc.rect(50, tableY, doc.page.width - 100, 20).fill(COLORS.primary);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
            .text('EARNINGS', 60, tableY + 5).text('AMOUNT', 400, tableY + 5);

        const rows = [
            ['Basic Salary', `${Number(payroll.base_salary).toFixed(2)}`],
            ['Housing Allowance', `${Number(payroll.housing_allowance).toFixed(2)}`],
            ['Transport Allowance', `${Number(payroll.transport_allowance).toFixed(2)}`],
            ['Other Allowance', `${Number(payroll.other_allowance).toFixed(2)}`],
            ['Overtime Pay', `${Number(payroll.overtime_pay || 0).toFixed(2)}`],
        ];

        let rowY = tableY + 22;
        rows.forEach(([label, val], i) => {
            if (i % 2 === 0) doc.rect(50, rowY - 2, doc.page.width - 100, 17).fill(COLORS.lightBg);
            doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
                .text(label, 60, rowY).text(val, 400, rowY);
            rowY += 18;
        });

        // Deductions
        rowY += 5;
        doc.rect(50, rowY, doc.page.width - 100, 20).fill(COLORS.accent);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
            .text('DEDUCTIONS', 60, rowY + 5).text('AMOUNT', 400, rowY + 5);
        rowY += 22;
        doc.rect(50, rowY - 2, doc.page.width - 100, 17).fill(COLORS.lightBg);
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
            .text('Absence Deduction', 60, rowY).text(`-${Number(payroll.absence_deduction || 0).toFixed(2)}`, 400, rowY);
        rowY += 22;

        // Totals
        doc.moveTo(50, rowY).lineTo(doc.page.width - 50, rowY).strokeColor(COLORS.border).lineWidth(1).stroke();
        rowY += 8;
        doc.rect(50, rowY, doc.page.width - 100, 25).fill(COLORS.primary);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12)
            .text('NET PAY', 60, rowY + 6).text(`${Number(payroll.net_pay).toFixed(2)}`, 390, rowY + 6);
        rowY += 32;

        // Attendance details
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
            .text(`Working Days: ${payroll.working_days}   Days Worked: ${payroll.days_worked}   Days Absent: ${payroll.days_absent}   Overtime Hours: ${payroll.overtime_hours}`, 50, rowY);

        // Footer
        const footerY = doc.page.height - 60;
        doc.rect(0, footerY - 5, doc.page.width, 65).fill(COLORS.lightBg);
        doc.fontSize(8).fillColor(COLORS.muted)
            .text('This is a computer-generated payslip and does not require a signature.', 50, footerY + 5, { align: 'center' })
            .text(`${settings.company_name || 'Company'} | ${monthName}`, 50, footerY + 18, { align: 'center' });

        doc.end();
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
};

// === ROUTES ===

// Generate warning PDF
router.post('/warning/:warning_id', async (req, res) => {
    try {
        const warning = db.prepare(`
      SELECT w.*, e.first_name, e.last_name, e.employee_number, e.department, e.position
      FROM warnings w JOIN employees e ON w.employee_id = e.id WHERE w.id = ?
    `).get(req.params.warning_id);
        if (!warning) return res.status(404).json({ error: 'Warning not found' });

        const settings = getSettings();
        const filename = `warning_${warning.id}_${Date.now()}.pdf`;
        const filePath = await generateWarningPDF(
            { first_name: warning.first_name, last_name: warning.last_name, employee_number: warning.employee_number, department: warning.department, position: warning.position, id: warning.employee_id },
            warning, settings, filename
        );

        db.prepare('UPDATE warnings SET pdf_path = ? WHERE id = ?').run(`/pdfs/${filename}`, warning.id);
        res.json({ url: `/pdfs/${filename}`, filename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate payslip PDF
router.post('/payslip/:payroll_id', async (req, res) => {
    try {
        const payroll = db.prepare('SELECT * FROM payroll WHERE id = ?').get(req.params.payroll_id);
        if (!payroll) return res.status(404).json({ error: 'Payroll not found' });
        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(payroll.employee_id);
        const settings = getSettings();
        const filename = `payslip_${payroll.employee_id}_${payroll.period_year}${String(payroll.period_month).padStart(2, '0')}.pdf`;
        await generatePayslipPDF(employee, payroll, settings, filename);
        res.json({ url: `/pdfs/${filename}`, filename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stream PDF directly
router.get('/view/:filename', (req, res) => {
    const filePath = path.join(PDFS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
    fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
