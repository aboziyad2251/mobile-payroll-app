import { jsPDF } from 'jspdf';

const COLORS = {
    primary: [79, 70, 229],
    dark: [15, 23, 42],
    muted: [100, 116, 139],
    light: [241, 245, 249],
    success: [16, 185, 129],
    danger: [239, 68, 68],
    border: [226, 232, 240],
};

const addHeader = (doc, companyName, title, subtitle) => {
    // Background bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 32, 'F');

    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName || 'PayrollPro', 14, 13);

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(title, 14, 22);

    // Date on right
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('en-GB'), 196, 13, { align: 'right' });
    if (subtitle) doc.text(subtitle, 196, 22, { align: 'right' });

    return 42; // y position after header
};

const addSection = (doc, y, label) => {
    doc.setFillColor(...COLORS.light);
    doc.rect(14, y, 182, 7, 'F');
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), 16, y + 5);
    return y + 11;
};

const addRow = (doc, y, label, value, highlight = false) => {
    if (highlight) {
        doc.setFillColor(...COLORS.light);
        doc.rect(14, y - 4, 182, 8, 'F');
    }
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 16, y);

    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', highlight ? 'bold' : 'normal');
    doc.text(String(value), 196, y, { align: 'right' });
    return y + 8;
};

const addDivider = (doc, y) => {
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    return y + 5;
};

export const generatePayslipPDF = async (record, companyName = 'PayrollPro') => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const monthLabel = `${monthNames[(record.period_month || 1) - 1]} ${record.period_year}`;
    const empName = `${record.first_name || ''} ${record.last_name || ''}`.trim();

    let y = addHeader(doc, companyName, 'PAYSLIP', monthLabel);

    // Employee info
    y = addSection(doc, y, 'Employee Information');
    y = addRow(doc, y, 'Employee Name', empName);
    y = addRow(doc, y, 'Employee Number', record.employee_number || '—');
    y = addRow(doc, y, 'Department', record.department || '—');
    y = addRow(doc, y, 'Position', record.position || '—');
    y = addRow(doc, y, 'Pay Period', monthLabel);
    y += 4;

    // Earnings
    y = addSection(doc, y, 'Earnings');
    y = addRow(doc, y, 'Base Salary', `${Number(record.base_salary || 0).toLocaleString()} SAR`);
    y = addRow(doc, y, 'Housing Allowance', `${Number(record.housing_allowance || 0).toLocaleString()} SAR`);
    y = addRow(doc, y, 'Transport Allowance', `${Number(record.transport_allowance || 0).toLocaleString()} SAR`);
    y = addRow(doc, y, 'Other Allowance', `${Number(record.other_allowance || 0).toLocaleString()} SAR`);
    if (record.overtime_pay > 0) {
        y = addRow(doc, y, `Overtime Pay (${record.overtime_hours}h)`, `${Number(record.overtime_pay || 0).toLocaleString()} SAR`);
    }
    y = addDivider(doc, y);
    y = addRow(doc, y, 'Gross Pay', `${Number(record.gross_pay || 0).toLocaleString()} SAR`, true);
    y += 4;

    // Deductions
    y = addSection(doc, y, 'Deductions');
    y = addRow(doc, y, `Absence Deduction (${record.days_absent || 0} days)`, `-${Number(record.absence_deduction || 0).toLocaleString()} SAR`);
    y = addDivider(doc, y);
    y = addRow(doc, y, 'Total Deductions', `-${Number(record.deductions || 0).toLocaleString()} SAR`, true);
    y += 4;

    // Attendance summary
    y = addSection(doc, y, 'Attendance Summary');
    y = addRow(doc, y, 'Working Days', String(record.working_days || 22));
    y = addRow(doc, y, 'Days Worked', String(record.days_worked || 0));
    y = addRow(doc, y, 'Days Absent', String(record.days_absent || 0));
    y = addRow(doc, y, 'Overtime Hours', `${record.overtime_hours || 0}h`);
    y += 4;

    // Net pay highlight box
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(14, y, 182, 18, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('NET PAY', 20, y + 7);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${Number(record.net_pay || 0).toLocaleString()} SAR`, 192, y + 11, { align: 'right' });
    y += 26;

    // Footer
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('This payslip is computer generated and does not require a signature.', 105, y, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString()}`, 105, y + 5, { align: 'center' });

    const filename = `payslip_${empName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
};

export const generateWarningPDF = async (warning, companyName = 'PayrollPro') => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const typeLabels = {
        first: 'First Warning',
        second: 'Second Warning',
        third: 'Third Warning',
        final: 'Final Warning',
        recognition: 'Recognition Letter',
    };
    const typeLabel = typeLabels[warning.warning_type] || warning.warning_type;
    const empName = `${warning.first_name || ''} ${warning.last_name || ''}`.trim();
    const isRecognition = warning.warning_type === 'recognition';

    // Override primary color for recognition
    const headerColor = isRecognition ? [16, 185, 129] : COLORS.primary;
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(typeLabel.toUpperCase(), 14, 22);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('en-GB'), 196, 13, { align: 'right' });

    let y = 42;

    // Reference number
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(8);
    doc.text(`Reference: WRN-${String(warning.id || '').slice(0, 8).toUpperCase()}`, 196, y, { align: 'right' });
    y += 8;

    // To/From block
    y = addSection(doc, y, 'Letter Details');
    y = addRow(doc, y, 'To', empName);
    y = addRow(doc, y, 'Employee Number', warning.employee_number || '—');
    y = addRow(doc, y, 'Department', warning.department || '—');
    y = addRow(doc, y, 'Issued By', warning.issued_by || 'HR Manager');
    y = addRow(doc, y, 'Date', warning.issued_date || new Date().toLocaleDateString('en-GB'));
    y = addRow(doc, y, 'Warning Type', typeLabel);
    y += 4;

    // Body
    y = addSection(doc, y, 'Reason');
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const reasonLines = doc.splitTextToSize(warning.reason || '—', 178);
    doc.text(reasonLines, 16, y);
    y += reasonLines.length * 5 + 4;

    if (warning.details) {
        y = addSection(doc, y, 'Details');
        const detailLines = doc.splitTextToSize(warning.details, 178);
        doc.setTextColor(...COLORS.dark);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(detailLines, 16, y);
        y += detailLines.length * 5 + 4;
    }

    // Acknowledgement section
    y = Math.max(y + 10, 200);
    y = addSection(doc, y, 'Acknowledgement');
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(8);
    doc.text('By signing below, the employee acknowledges receipt of this letter.', 16, y);
    y += 16;

    doc.setDrawColor(...COLORS.border);
    doc.line(16, y, 90, y);
    doc.line(120, y, 196, y);
    y += 5;
    doc.setFontSize(7);
    doc.text('Employee Signature & Date', 16, y);
    doc.text('HR Manager Signature & Date', 120, y);

    const filename = `${warning.warning_type}_warning_${empName.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
};
