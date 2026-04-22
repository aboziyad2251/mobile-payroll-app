/**
 * api.js — All backend calls now go directly to InsForge PostgreSQL.
 * Same exported function signatures as before so NO page components need changing.
 */
import client from '../lib/insforge';
import { generatePayslipPDF as _genPayslipPDF, generateWarningPDF as _genWarningPDF } from '../lib/pdfGenerator';
import { employeeSchema, attendanceSchema, warningSchema, leaveRequestSchema, validateSchema } from './schemaValidation';
import { queueOfflineAction } from './offlineSync';

const db = client.database;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const throwIfError = ({ data, error }) => {
    if (error) throw new Error(error.message || JSON.stringify(error));
    return { data };
};

// Wrap result to look like axios response { data: ... }
const wrap = (val) => ({ data: val });

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────

export const getEmployees = async ({ search, department, status, ids } = {}) => {
    let q = db.from('employees').select('*');
    if (status) q = q.eq('status', status);
    if (department) q = q.eq('department', department);
    if (search) q = q.ilike('first_name', `%${search}%`);
    if (ids && ids.length > 0) q = q.in('id', ids);
    else if (ids && ids.length === 0) return wrap([]); // manager with no subordinates
    const { data, error } = await q.order('first_name', { ascending: true });
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const getEmployee = async (id) => {
    const { data, error } = await db.from('employees').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return wrap(data);
};

export const createEmployee = async (body) => {
    const validBody = validateSchema(employeeSchema, body);
    const { data, error } = await db.from('employees').insert([{
        employee_number: validBody.employee_number,
        first_name: validBody.first_name,
        last_name: validBody.last_name,
        email: validBody.email || null,
        phone: validBody.phone || null,
        position: validBody.position,
        job_title: validBody.job_title || null,
        department: validBody.department,
        hire_date: validBody.hire_date,
        salary_type: validBody.salary_type || 'monthly',
        base_salary: Number(validBody.base_salary) || 0,
        housing_allowance: Number(validBody.housing_allowance) || 0,
        transport_allowance: Number(validBody.transport_allowance) || 0,
        other_allowance: Number(validBody.other_allowance) || 0,
        annual_incentive_multiplier: Number(validBody.annual_incentive_multiplier) || 0,
        status: validBody.status || 'active',
        shift_type: validBody.shift_type || 'first',
        shift_start: validBody.shift_type === 'first' ? '09:00' : validBody.shift_type === 'second' ? '16:00' : (validBody.shift_start || '09:00'),
        shift_end: validBody.shift_type === 'first' ? '16:00' : validBody.shift_type === 'second' ? '00:00' : (validBody.shift_end || '17:00'),
        days_off_count: Number(validBody.days_off_count) || 2,
        day_off_1: validBody.day_off_1 || 'friday',
        day_off_2: Number(validBody.days_off_count) === 1 ? null : (validBody.day_off_2 || 'saturday'),
        national_id: validBody.national_id || null,
        iban: validBody.iban || null,
        bank_code: validBody.bank_code || null,
        bank_name: validBody.bank_name || null,
        grade: validBody.grade || null,
    }]).select();
    if (error) throw new Error(error.message);
    // Create initial leave balance
    const empId = data[0]?.id;
    if (empId) {
        await db.from('leave_balance').insert([{ employee_id: empId, year: new Date().getFullYear() }]);
    }
    return wrap(data[0]);
};

export const updateEmployee = async (id, body) => {
    const validBody = validateSchema(employeeSchema, body);
    const { data, error } = await db.from('employees').update({
        employee_number: validBody.employee_number,
        first_name: validBody.first_name,
        last_name: validBody.last_name,
        email: validBody.email || null,
        phone: validBody.phone || null,
        position: validBody.position,
        job_title: validBody.job_title || null,
        department: validBody.department,
        hire_date: validBody.hire_date,
        salary_type: validBody.salary_type || 'monthly',
        base_salary: Number(validBody.base_salary) || 0,
        housing_allowance: Number(validBody.housing_allowance) || 0,
        transport_allowance: Number(validBody.transport_allowance) || 0,
        other_allowance: Number(validBody.other_allowance) || 0,
        annual_incentive_multiplier: Number(validBody.annual_incentive_multiplier) || 0,
        status: validBody.status || 'active',
        shift_type: validBody.shift_type || 'first',
        shift_start: validBody.shift_type === 'first' ? '09:00' : validBody.shift_type === 'second' ? '16:00' : (validBody.shift_start || '09:00'),
        shift_end: validBody.shift_type === 'first' ? '16:00' : validBody.shift_type === 'second' ? '00:00' : (validBody.shift_end || '17:00'),
        days_off_count: Number(validBody.days_off_count) || 2,
        day_off_1: validBody.day_off_1 || 'friday',
        day_off_2: Number(validBody.days_off_count) === 1 ? null : (validBody.day_off_2 || 'saturday'),
        national_id: validBody.national_id || null,
        iban: validBody.iban || null,
        bank_code: validBody.bank_code || null,
        bank_name: validBody.bank_name || null,
        grade: validBody.grade || null,
    }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteEmployee = async (id) => {
    const { error } = await db.from('employees').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap({ message: 'Deleted' });
};

export const getDepartments = async () => {
    const { data, error } = await db.from('employees').select('department').order('department', { ascending: true });
    if (error) throw new Error(error.message);
    const unique = [...new Set((data || []).map(r => r.department).filter(Boolean))];
    return wrap(unique);
};

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────

export const getAttendance = async ({ date } = {}) => {
    // Get all employees + join attendance for the given date
    const { data: emps } = await db.from('employees').select('id, employee_number, first_name, last_name, department').eq('status', 'active');
    let attQuery = db.from('attendance').select('*');
    if (date) attQuery = attQuery.eq('date', date);
    const { data: recs, error } = await attQuery;
    if (error) throw new Error(error.message);

    // Merge employee info — preserve attendance id explicitly (employee also has 'id')
    const empMap = Object.fromEntries((emps || []).map(e => [e.id, e]));
    const merged = (recs || []).map(r => {
        const emp = empMap[r.employee_id] || {};
        return {
            ...r,
            id: r.id,  // attendance UUID wins over employee integer id
            first_name: emp.first_name,
            last_name: emp.last_name,
            employee_number: emp.employee_number,
            department: emp.department,
        };
    });
    return wrap(merged);
};

export const getTodayAttendance = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: emps } = await db.from('employees').select('id').eq('status', 'active');
    const { data: recs } = await db.from('attendance').select('*').eq('date', today);
    const attendanceRecords = recs || [];
    const totalEmployees = (emps || []).length;

    const counts = { present: 0, absent: 0, annual_leave: 0, sick_leave: 0, emergency_leave: 0, excused: 0 };
    attendanceRecords.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

    return wrap({
        date: today,
        total_employees: totalEmployees,
        ...counts,
    });
};

export const markAttendance = async (body, isBackgroundSync = false) => {
    const validBody = validateSchema(attendanceSchema, {
        employee_id: body.employee_id,
        date: body.date,
        check_in: body.check_in,
        check_out: body.check_out,
        status: body.status
    });
    
    // Merge validBody core with potentially unvalidated optional fields
    const { employee_id, date, status, check_in, check_out } = validBody;
    const { break_start, break_end, notes } = body;

    // Trigger Offline Sync if applicable
    if (!navigator.onLine && !isBackgroundSync) {
        await queueOfflineAction('markAttendance', body);
        return wrap({ ...validBody, id: 'offline-pending' });
    }

    // Calculate break and overtime minutes
    let total_break_minutes = 0;
    if (break_start && break_end) {
        const [bsh, bsm] = break_start.split(':').map(Number);
        const [beh, bem] = break_end.split(':').map(Number);
        total_break_minutes = Math.max(0, (beh * 60 + bem) - (bsh * 60 + bsm));
    }
    // Upsert: try insert, on conflict update
    const { data: existing } = await db.from('attendance').select('id').eq('employee_id', employee_id).eq('date', date).maybeSingle();

    let result;
    if (existing) {
        const { data, error } = await db.from('attendance').update({
            status, check_in: check_in || null, check_out: check_out || null,
            break_start: break_start || null, break_end: break_end || null,
            notes: notes || null,
        }).eq('id', existing.id).select();
        if (error) throw new Error(error.message);
        result = data[0];
    } else {
        const { data, error } = await db.from('attendance').insert([{
            employee_id, date, status,
            check_in: check_in || null, check_out: check_out || null,
            break_start: break_start || null, break_end: break_end || null,
            notes: notes || null,
        }]).select();
        if (error) throw new Error(error.message);
        result = data[0];
    }

    // Update leave balance if it's a leave type
    if (['annual_leave', 'sick_leave', 'emergency_leave'].includes(status)) {
        const year = new Date(date).getFullYear();
        const { data: lb } = await db.from('leave_balance').select('*').eq('employee_id', employee_id).eq('year', year).maybeSingle();
        if (lb) {
            const field = `${status}_used`;
            await db.from('leave_balance').update({ [field]: (lb[field] || 0) + 1 }).eq('id', lb.id);
        }
    }
    return wrap(result);
};

export const updateAttendance = async (id, body) => {
    const { status, check_in, check_out, break_start, break_end, notes } = body;
    const updatePayload = {
        status,
        check_in: check_in || null,
        check_out: check_out || null,
        break_start: break_start || null,
        break_end: break_end || null,
        notes: notes || null,
    };
    const { data, error } = await db.from('attendance').update(updatePayload).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const checkIn = async ({ employee_id, date, check_in, notes }) => {
    return markAttendance({ employee_id, date, status: 'present', check_in, notes });
};

// ─── WARNINGS ─────────────────────────────────────────────────────────────────

export const getWarnings = async ({ warning_type } = {}) => {
    let q = db.from('warnings').select('*, employees(id, employee_number, first_name, last_name, department)');
    if (warning_type) q = q.eq('warning_type', warning_type);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    // Flatten employee join
    const flat = (data || []).map(w => {
        const { id: _eid, ...empFields } = w.employees || {};
        return { ...w, ...empFields, employees: undefined };
    });
    return wrap(flat);
};

export const getNextWarningType = async (employeeId) => {
    const { data, error } = await db.from('warnings').select('warning_type').eq('employee_id', employeeId).neq('warning_type', 'recognition');
    if (error) throw new Error(error.message);
    const count = (data || []).length;
    const types = ['first', 'second', 'third', 'final'];
    const nextType = types[Math.min(count, 3)];
    return wrap({ next_type: nextType, total_issued: count });
};

export const createWarning = async (body) => {
    const validBody = validateSchema(warningSchema, body);
    const { data: prev } = await db.from('warnings').select('id').eq('employee_id', validBody.employee_id).neq('warning_type', 'recognition');
    const warning_number = ((prev || []).length) + 1;
    const { data, error } = await db.from('warnings').insert([{
        employee_id: validBody.employee_id,
        warning_number,
        warning_type: validBody.warning_type,
        reason: validBody.reason,
        details: validBody.details || null,
        issued_by: validBody.issued_by || 'HR Manager',
        issued_date: validBody.issued_date || new Date().toISOString().split('T')[0],
    }]).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteWarning = async (id) => {
    const { error } = await db.from('warnings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap({ message: 'Deleted' });
};

export const generateWarningPDF = async (id, warningData) => {
    const { data: settings } = await getSettings();
    await _genWarningPDF(warningData, settings?.company_name);
    return wrap({ success: true });
};

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────

export const getRankings = async ({ period, month, year, employeeIds } = {}) => {
    if (employeeIds && employeeIds.length === 0) return wrap([]);
    let q = db.from('performance')
        .select('*, employees(id, employee_number, first_name, last_name, department)')
        .eq('period', period || 'monthly');
    if (month && year) {
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        q = q.eq('period_start', start);
    }
    if (employeeIds && employeeIds.length > 0) q = q.in('employee_id', employeeIds);
    const { data, error } = await q.order('total_score', { ascending: false });
    if (error) throw new Error(error.message);
    const flat = (data || []).map((r, i) => {
        const { id: _eid, ...empFields } = r.employees || {};
        return { ...r, ...empFields, employees: undefined, rank_position: i + 1 };
    });
    return wrap(flat);
};

export const getTopPerformers = async ({ period = 'monthly', limit = 5 } = {}) => {
    const { data, error } = await db.from('performance')
        .select('*, employees(id, employee_number, first_name, last_name, department)')
        .eq('period', period)
        .order('total_score', { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    const flat = (data || []).map(r => {
        const { id: _eid, ...empFields } = r.employees || {};
        return { ...r, ...empFields, employees: undefined };
    });
    return wrap(flat);
};

export const calculatePerformance = async ({ period, period_start, period_end }) => {
    // Fetch all active employees
    const { data: emps } = await db.from('employees').select('*').eq('status', 'active');
    if (!emps?.length) return wrap({ processed: 0 });

    // Fetch settings for late threshold
    const { data: settings } = await getSettings();
    const lateThreshold = Number(settings?.late_threshold_minutes || 15);
    const workStartTime = settings?.work_start_time || '08:00';
    const [wsh, wsm] = workStartTime.split(':').map(Number);
    const workStartMinutes = wsh * 60 + wsm;

    // Fetch attendance records in the period
    const { data: attRecords } = await db.from('attendance')
        .select('*')
        .gte('date', period_start)
        .lte('date', period_end);

    // Fetch warnings for the period
    const { data: warnRecords } = await db.from('warnings')
        .select('*')
        .gte('issued_date', period_start)
        .lte('issued_date', period_end)
        .neq('warning_type', 'recognition');

    const today = new Date();
    const start = new Date(period_start);
    const end = new Date(period_end < today.toISOString().split('T')[0] ? period_end : today.toISOString().split('T')[0]);
    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const scores = emps.map(emp => {
        const empAtt = (attRecords || []).filter(r => r.employee_id === emp.id);
        const presentDays = empAtt.filter(r => r.status === 'present').length;
        const absentDays = empAtt.filter(r => r.status === 'absent').length;
        const leaveDays = empAtt.filter(r => ['annual_leave', 'sick_leave', 'emergency_leave'].includes(r.status)).length;
        const lateArrivals = empAtt.filter(r => {
            if (!r.check_in) return false;
            const [ch, cm] = r.check_in.split(':').map(Number);
            return (ch * 60 + cm) > workStartMinutes + lateThreshold;
        }).length;
        const warnings = (warnRecords || []).filter(r => r.employee_id === emp.id).length;

        // Scoring: attendance/40, punctuality/25, leave/20, discipline/15
        const attRate = totalDays > 0 ? presentDays / totalDays : 0;
        const attendance_score = Math.round(attRate * 40 * 10) / 10;
        const punctuality_score = Math.max(0, Math.round((25 - lateArrivals * 3) * 10) / 10);
        const leave_score = Math.max(0, Math.round((20 - leaveDays * 2) * 10) / 10);
        const discipline_score = Math.max(0, Math.round((15 - warnings * 5) * 10) / 10);
        const total_score = Math.min(100, attendance_score + punctuality_score + leave_score + discipline_score);

        const rating = total_score >= 90 ? 'Excellent'
            : total_score >= 75 ? 'Good'
                : total_score >= 60 ? 'Average'
                    : total_score >= 45 ? 'Needs Improvement' : 'Poor';

        return {
            employee_id: emp.id, period, period_start, period_end,
            attendance_score, punctuality_score, leave_score, discipline_score,
            total_score, rating, total_days: totalDays, present_days: presentDays,
            absent_days: absentDays, late_arrivals: lateArrivals, warning_count: warnings,
        };
    });

    // Sort and assign ranks
    scores.sort((a, b) => b.total_score - a.total_score);
    scores.forEach((s, i) => { s.rank_position = i + 1; });

    // Delete old records for this period and upsert fresh
    await db.from('performance').delete().eq('period', period).eq('period_start', period_start);
    if (scores.length > 0) {
        await db.from('performance').insert(scores);
    }

    return wrap({ processed: scores.length });
};

// ─── PAYROLL ──────────────────────────────────────────────────────────────────

export const getPayroll = async ({ month, year } = {}) => {
    let q = db.from('payroll').select('*');
    if (month) q = q.eq('period_month', month);
    if (year) q = q.eq('period_year', year);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data || [];
    if (rows.length === 0) return wrap([]);
    // Fetch employee details separately (no FK constraint in InsForge)
    const empIds = [...new Set(rows.map(r => r.employee_id).filter(Boolean))];
    const { data: emps } = await db.from('employees').select('id, employee_number, first_name, last_name, department, position, grade').in('id', empIds);
    const empMap = {};
    (emps || []).forEach(e => { empMap[e.id] = e; });
    const flat = rows.map(r => {
        const emp = empMap[r.employee_id] || {};
        return {
            ...r,
            id: r.id, // payroll UUID wins over employee integer id
            first_name: emp.first_name,
            last_name: emp.last_name,
            employee_number: emp.employee_number,
            department: emp.department,
            position: emp.position,
            grade: emp.grade,
        };
    });
    return wrap(flat);
};

export const getPayrollSummary = async ({ month, year } = {}) => {
    const { data } = await getPayroll({ month, year });
    const rows = data || [];
    return wrap({
        total_employees: rows.length,
        total_gross: rows.reduce((s, r) => s + Number(r.gross_pay || 0), 0),
        total_deductions: rows.reduce((s, r) => s + Number(r.deductions || 0), 0),
        total_net: rows.reduce((s, r) => s + Number(r.net_pay || 0), 0),
    });
};

export const calculatePayroll = async ({ month, year }) => {
    const { data: emps } = await db.from('employees').select('*').eq('status', 'active');
    if (!emps?.length) return wrap({ processed: 0 });

    const { data: settings } = await getSettings();
    const workingDaysPerMonth = Number(settings?.working_days_per_month || 22);
    const workStartTime = settings?.work_start_time || '08:00';
    const workEndTime = settings?.work_end_time || '16:00';
    const [weh, wem] = workEndTime.split(':').map(Number);
    const [wsh, wsm] = workStartTime.split(':').map(Number);
    const standardHours = ((weh * 60 + wem) - (wsh * 60 + wsm)) / 60;

    // Get attendance for the month
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: attRecs } = await db.from('attendance')
        .select('*').gte('date', periodStart).lte('date', periodEnd);

    const payrollRecords = emps.map(emp => {
        const empAtt = (attRecs || []).filter(r => r.employee_id === emp.id);
        const presentDays = empAtt.filter(r => r.status === 'present').length;
        const absentDays = empAtt.filter(r => r.status === 'absent').length;
        const overtimeMinutes = empAtt.reduce((s, r) => s + (r.overtime_minutes || 0), 0);
        const overtimeHours = Math.round(overtimeMinutes / 60 * 10) / 10;

        const baseSalary = Number(emp.base_salary || 0);
        const housingAllowance = Number(emp.housing_allowance || 0);
        const transportAllowance = Number(emp.transport_allowance || 0);
        const otherAllowance = Number(emp.other_allowance || 0);
        const totalAllowances = housingAllowance + transportAllowance + otherAllowance;

        const dailyRate = baseSalary / workingDaysPerMonth;
        const absenceDeduction = absentDays * dailyRate;
        const hourlyRate = baseSalary / (workingDaysPerMonth * standardHours);
        const overtimePay = overtimeHours * hourlyRate * 1.5;

        const grossPay = baseSalary + totalAllowances + overtimePay;
        const bonus = 0; // Set per-employee after calculation via Set Bonus
        const netPay = grossPay - absenceDeduction + bonus;

        return {
            employee_id: emp.id,
            period_month: month,
            period_year: year,
            base_salary: baseSalary,
            housing_allowance: housingAllowance,
            transport_allowance: transportAllowance,
            other_allowance: otherAllowance,
            gross_pay: Math.round(grossPay * 100) / 100,
            deductions: Math.round(absenceDeduction * 100) / 100,
            absence_deduction: Math.round(absenceDeduction * 100) / 100,
            net_pay: Math.round(netPay * 100) / 100,
            working_days: workingDaysPerMonth,
            days_worked: presentDays,
            days_absent: absentDays,
            overtime_hours: overtimeHours,
            overtime_pay: Math.round(overtimePay * 100) / 100,
            annual_incentive: 0,
            status: 'processed',
            processed_at: new Date().toISOString(),
        };
    });

    // Delete old payroll records for this period and insert fresh
    await db.from('payroll').delete().eq('period_month', month).eq('period_year', year);
    if (payrollRecords.length > 0) {
        const { error: insertError } = await db.from('payroll').insert(payrollRecords);
        if (insertError) throw new Error(insertError.message);
    }

    return wrap({ processed: payrollRecords.length });
};

export const markPaid = async (id) => {
    const { data, error } = await db.from('payroll').update({ status: 'paid' }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const updatePayrollStatus = async (id, status) => {
    const { data, error } = await db.from('payroll').update({ status }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const updatePayrollBonus = async (id, bonusAmount, baseSalary, absenceDeduction, grossPay) => {
    const bonus = Math.round(Number(bonusAmount || 0) * 100) / 100;
    const netPay = Math.round((Number(grossPay || 0) - Number(absenceDeduction || 0) + bonus) * 100) / 100;
    const { data, error } = await db.from('payroll').update({
        annual_incentive: bonus,
        net_pay: netPay,
    }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap({ ...data[0], annual_incentive: bonus, net_pay: netPay });
};

export const generatePayslipPDF = async (id, payrollRecord) => {
    const { data: settings } = await getSettings();
    await _genPayslipPDF(payrollRecord, settings?.company_name);
    return wrap({ success: true });
};

// ─── WPS / ESTABLISHMENTS ─────────────────────────────────────────────────────

export const getEstablishment = async () => {
    const { data, error } = await db.from('establishments').select('*').limit(1);
    if (error) return wrap(null);
    return wrap(data?.[0] || null);
};

export const saveEstablishment = async (fields) => {
    const { data: existing } = await db.from('establishments').select('id').limit(1);
    let result;
    if (existing?.[0]?.id) {
        const { data, error } = await db.from('establishments').update(fields).eq('id', existing[0].id).select();
        if (error) throw new Error(error.message);
        result = data?.[0];
    } else {
        const { data, error } = await db.from('establishments').insert([fields]).select();
        if (error) throw new Error(error.message);
        result = data?.[0];
    }
    return wrap(result);
};

export const updateEmployeeWPS = async (id, { national_id, iban, bank_code, bank_name }) => {
    const { data, error } = await db.from('employees')
        .update({ national_id, iban, bank_code, bank_name })
        .eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data?.[0]);
};

export const generateWPSSIF = async ({ month, year }) => {
    // Fetch establishment
    const { data: estab } = await getEstablishment();
    if (!estab?.employer_id) throw new Error('Establishment info missing. Fill WPS settings first.');

    // Fetch payroll records with employee details
    const { data: payrollRows } = await getPayroll({ month, year });
    const paidRows = (payrollRows || []).filter(r => r.status === 'paid' || r.status === 'processed');
    if (!paidRows.length) throw new Error('No processed payroll records found for this period.');

    // Fetch employee WPS fields
    const empIds = [...new Set(paidRows.map(r => r.employee_id))];
    const { data: emps } = await db.from('employees')
        .select('id, national_id, iban, bank_code, bank_name, base_salary')
        .in('id', empIds);
    const empMap = Object.fromEntries((emps || []).map(e => [e.id, e]));

    const paymentDate = `${year}${String(month).padStart(2, '0')}01`;
    const totalNet = paidRows.reduce((s, r) => s + Number(r.net_pay || 0), 0);

    // SAMA SIF format
    const lines = [];
    // Header
    lines.push(`H,${estab.employer_id},${paymentDate},${paidRows.length},${totalNet.toFixed(2)}`);

    const violations = [];
    paidRows.forEach(rec => {
        const emp = empMap[rec.employee_id] || {};
        const basicPaid   = Number(rec.base_salary || 0).toFixed(2);
        const housingPaid = Number(rec.housing_allowance || 0).toFixed(2);
        const otherPaid   = (Number(rec.transport_allowance || 0) + Number(rec.other_allowance || 0) + Number(rec.annual_incentive || 0)).toFixed(2);
        const deductions  = Number(rec.deductions || 0).toFixed(2);
        const gosiDeduct  = Number(rec.gosi_deduction || 0).toFixed(2);
        const netSalary   = Number(rec.net_pay || 0).toFixed(2);

        // 80% rule check — net must be >= 80% of base_salary
        const gosiBase = Number(emp.base_salary || rec.base_salary || 0);
        if (gosiBase > 0 && Number(netSalary) < gosiBase * 0.8) {
            violations.push(`${rec.first_name} ${rec.last_name} (${emp.national_id || 'N/A'})`);
        }

        lines.push([
            'D',
            emp.national_id || '',
            emp.bank_code || '',
            (emp.iban || '').replace(/\s/g, ''),
            basicPaid,
            housingPaid,
            otherPaid,
            deductions,
            netSalary,
            'Normal Salary',
        ].join(','));
    });

    // Trailer
    lines.push(`T,${paidRows.length},${totalNet.toFixed(2)}`);

    return wrap({ content: lines.join('\r\n'), violations, count: paidRows.length, total: totalNet });
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

export const getSettings = async () => {
    const { data, error } = await db.from('app_settings').select('*');
    if (error) return wrap({});
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return wrap(settings);
};

// ─── LEAVES ───────────────────────────────────────────────────────────────────

export const getLeaveRequests = async ({ status, employee_id, employeeIds } = {}) => {
    if (employeeIds && employeeIds.length === 0) return wrap([]);
    let q = db.from('leave_requests')
        .select('id, employee_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_by, reviewed_at, reviewer_notes, created_at, auto_reject_at')
        .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (employee_id) q = q.eq('employee_id', employee_id);
    if (employeeIds && employeeIds.length > 0) q = q.in('employee_id', employeeIds);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const leaves = data || [];
    if (leaves.length > 0) {
        const empIds = [...new Set(leaves.map(l => l.employee_id).filter(Boolean))];
        const { data: emps } = await db.from('employees').select('id, employee_number, first_name, last_name, department, position').in('id', empIds);
        const empMap = {};
        (emps || []).forEach(e => { empMap[e.id] = e; });
        return wrap(leaves.map(l => {
            const emp = empMap[l.employee_id] || {};
            // Build explicitly — no spread, so id is ALWAYS l.id (UUID from leave_requests)
            return {
                id: l.id,
                leave_uuid: l.id,
                employee_id: l.employee_id,
                employee_display_id: emp.id,
                leave_type: l.leave_type,
                start_date: l.start_date,
                end_date: l.end_date,
                days_count: l.days_count,
                reason: l.reason,
                status: l.status,
                reviewed_by: l.reviewed_by,
                reviewed_at: l.reviewed_at,
                reviewer_notes: l.reviewer_notes,
                created_at: l.created_at,
                auto_reject_at: l.auto_reject_at,
                first_name: emp.first_name,
                last_name: emp.last_name,
                employee_number: emp.employee_number,
                department: emp.department,
                position: emp.position,
            };
        }));
    }
    return wrap(leaves);
};

export const submitLeaveRequest = async (body) => {
    const validBody = validateSchema(leaveRequestSchema, {
        employee_id: body.employee_id,
        start_date: body.start_date,
        end_date: body.end_date,
        type: body.leave_type,
        reason: body.reason
    });
    const autoRejectAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const requesterRole = body.requester_role || 'employee';
    // CEO leaves are auto-approved; everyone else starts as pending
    const initialStatus = (requesterRole === 'admin' || requesterRole === 'CEO') ? 'approved' : 'pending';
    const { data: { user: authUser } } = await client.auth.getCurrentUser();
    const { data, error } = await db.from('leave_requests').insert([{
        employee_id: validBody.employee_id || null,
        requester_user_id: authUser?.id || null,
        leave_type: validBody.type,
        start_date: validBody.start_date,
        end_date: validBody.end_date,
        days_count: body.days_count || 1,
        reason: validBody.reason,
        status: initialStatus,
        auto_reject_at: initialStatus === 'approved' ? null : autoRejectAt,
        requester_role: requesterRole,
        reviewed_by: initialStatus === 'approved' ? 'CEO' : null,
    }]).select();
    if (error) throw new Error(error.message);

    // Routing: employee → notify their manager. Manager or no manager → notify CEO/admin
    let notifyUserId = null;
    if (requesterRole === 'employee' && body.employee_id) {
        const { data: subs } = await db.from('manager_subordinates')
            .select('manager_user_id').eq('employee_id', body.employee_id).limit(1);
        notifyUserId = subs?.[0]?.manager_user_id || null;
    }
    if (!notifyUserId) {
        const { data: admins } = await db.from('app_users').select('id').eq('role', 'admin').limit(1);
        notifyUserId = admins?.[0]?.id || null;
    }
    if (notifyUserId && body.employee_id) {
        const { data: empArr } = await db.from('employees')
            .select('first_name, last_name').eq('id', body.employee_id).limit(1);
        const empData = empArr?.[0];
        const empName = empData ? `${empData.first_name} ${empData.last_name}` : 'An employee';
        const leaveLabels = {
            annual: 'Annual Leave', emergency: 'Emergency Leave', exam: 'Exam Leave',
            sport: 'Sport Leave', national_day: 'National Day', foundation_day: 'Foundation Day',
            eid_fitr: 'Eid Al-Fitr', eid_adha: 'Eid Al-Adha', sick: 'Sick Leave', unpaid: 'Unpaid Leave',
        };
        await db.from('notifications').insert([{
            user_id: notifyUserId,
            title: 'New Leave Request',
            message: `${empName} submitted a ${leaveLabels[body.leave_type] || body.leave_type} request (${body.days_count || 1} day${body.days_count > 1 ? 's' : ''}).`,
            type: 'leave_submitted',
            link: '/leaves',
        }]);
    }
    return wrap(data[0]);
};

export const getCEOLeaves = async () => {
    // 1. Get all leaves where requester_role is 'admin' or 'CEO'
    const { data: ceoLeaves, error: err1 } = await db.from('leave_requests')
        .select('*, employees(first_name, last_name, employee_number, department)')
        .or('requester_role.eq.admin,requester_role.eq.CEO')
        .order('created_at', { ascending: false });

    if (err1) return wrap([]);

    // 2. Also get leaves where employee_id belongs to an admin/CEO (fallback)
    const { data: adminUsers } = await db.from('app_users').select('employee_id').or('role.eq.admin,role.eq.CEO');
    const empIds = (adminUsers || []).map(u => u.employee_id).filter(Boolean);
    
    let combined = ceoLeaves || [];
    if (empIds.length > 0) {
        const { data: extraLeaves } = await db.from('leave_requests')
            .select('*, employees(first_name, last_name, employee_number, department)')
            .in('employee_id', empIds);
        
        // Merge without duplicates
        const existingIds = new Set(combined.map(c => c.id));
        (extraLeaves || []).forEach(l => {
            if (!existingIds.has(l.id)) combined.push(l);
        });
    }

    return wrap(combined.map(r => ({ ...r, ...r.employees, employees: undefined })));
};

export const approveLeaveRequest = async (id, reviewedBy = 'Admin', reqData = null) => {
    // Step 1: update leave_requests status
    const { data, error } = await db.from('leave_requests').update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
    }).eq('id', String(id)).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Approval failed: leave request not updated (check the UUID)');

    // Use whichever gives us the most complete leave info
    const req = data[0]?.employee_id ? data[0] : (reqData || data[0]);
    // Step 2: notify employee (best-effort)
    try {
        const empId = req?.employee_id ?? reqData?.employee_id;
        if (empId) {
            const { data: userArr } = await db.from('app_users').select('id').eq('employee_id', String(empId)).limit(1);
            const userId = userArr?.[0]?.id;
            if (userId) {
                await db.from('notifications').insert([{
                    user_id: userId,
                    title: 'Leave Request Approved',
                    message: `Your ${req.leave_type} leave request (${req.days_count} day${req.days_count > 1 ? 's' : ''}) has been approved by ${reviewedBy}.`,
                    type: 'leave_approved',
                    link: '/portal/leaves',
                }]);
            }
        }
    } catch (e) { console.warn('[approve] notify failed:', e.message); }

    // Step 3: auto-create attendance records (best-effort)
    try {
        const empId = req?.employee_id ?? reqData?.employee_id;
        const startDate = req?.start_date ?? reqData?.start_date;
        const endDate = req?.end_date ?? reqData?.end_date;
        const leaveType = req?.leave_type ?? reqData?.leave_type;
        if (empId && startDate && endDate) {
            const leaveTypeMap = { annual: 'annual_leave', sick: 'sick_leave', emergency: 'emergency_leave', unpaid: 'excused' };
            const attStatus = leaveTypeMap[leaveType] || 'excused';
            for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const { data: existing } = await db.from('attendance').select('id').eq('employee_id', empId).eq('date', dateStr).limit(1);
                if (!existing?.[0]) {
                    await db.from('attendance').insert([{ employee_id: empId, date: dateStr, status: attStatus }]);
                } else {
                    await db.from('attendance').update({ status: attStatus }).eq('id', existing[0].id);
                }
            }
        }
    } catch (e) { console.warn('[approve] attendance update failed:', e.message); }

    // Step 4: update leave balance (best-effort)
    try {
        const empId = req?.employee_id ?? reqData?.employee_id;
        const leaveType = req?.leave_type ?? reqData?.leave_type;
        const daysCount = req?.days_count ?? reqData?.days_count;
        const startDate = req?.start_date ?? reqData?.start_date;
        if (empId && startDate && ['annual', 'sick', 'emergency'].includes(leaveType)) {
            const year = new Date(startDate).getFullYear();
            const { data: lbArr } = await db.from('leave_balance').select('*').eq('employee_id', empId).eq('year', year).limit(1);
            const lb = lbArr?.[0];
            if (lb) {
                const field = `${leaveType}_leave_used`;
                await db.from('leave_balance').update({ [field]: (lb[field] || 0) + daysCount }).eq('id', lb.id);
            }
        }
    } catch (e) { console.warn('[approve] leave balance update failed:', e.message); }

    return wrap(data[0]);
};

export const rejectLeaveRequest = async (id, reviewedBy = 'Admin', notes = '', reqData = null) => {
    const { data, error } = await db.from('leave_requests').update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: notes,
    }).eq('id', String(id)).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Rejection failed: leave request not updated (check the UUID)');

    // Notify the employee (best-effort)
    try {
        const empId = data[0]?.employee_id ?? reqData?.employee_id;
        const req = data[0]?.leave_type ? data[0] : (reqData || {});
        if (empId) {
            const { data: userArr } = await db.from('app_users').select('id').eq('employee_id', String(empId)).limit(1);
            const userId = userArr?.[0]?.id;
            if (userId) {
                await db.from('notifications').insert([{
                    user_id: userId,
                    title: 'Leave Request Rejected',
                    message: `Your ${req.leave_type} leave request (${req.days_count} day${req.days_count > 1 ? 's' : ''}) was rejected by ${reviewedBy}${notes ? ': ' + notes : '.'}`,
                    type: 'leave_rejected',
                    link: '/portal/leaves',
                }]);
            }
        }
    } catch (e) { console.warn('[reject] notify failed:', e.message); }

    return wrap(data[0]);
};

export const getLeaveBalance = async (employee_id) => {
    const year = new Date().getFullYear();
    const { data: lb, error } = await db.from('leave_balance').select('*').eq('employee_id', employee_id).eq('year', year).maybeSingle();
    if (error) throw new Error(error.message);

    // Get employee hire date for service years calculation
    const { data: emp } = await db.from('employees').select('hire_date').eq('id', employee_id).single();
    const hireDate = emp?.hire_date ? new Date(emp.hire_date) : new Date();
    const serviceYears = Math.floor((new Date() - hireDate) / (1000 * 60 * 60 * 24 * 365.25));

    // Saudi Labor Law: 21 days for < 5 years, 30 days for >= 5 years
    const annualTotal = serviceYears >= 5 ? 30 : 21;
    const annualUsed = Number(lb?.annual_leave_used || 0);

    // Emergency leave: 10 days
    const emergencyTotal = 10;
    const emergencyUsed = Number(lb?.emergency_leave_used || 0);

    // Sick leave tiers per Article 117: 30 days full, 60 days 75%, 30 days 50%, beyond = HR decision
    const sickUsed = Number(lb?.sick_leave_used || 0);
    const sickTotal = 120;
    const tier1Used = Math.min(sickUsed, 30);
    const tier2Used = Math.min(Math.max(sickUsed - 30, 0), 60);
    const tier3Used = Math.min(Math.max(sickUsed - 90, 0), 30);
    const tier4Used = Math.max(sickUsed - 120, 0);

    return wrap({
        service_years: serviceYears,
        annual_leave: { total: annualTotal, used: annualUsed, remaining: Math.max(0, annualTotal - annualUsed) },
        emergency_leave: { total: emergencyTotal, used: emergencyUsed, remaining: Math.max(0, emergencyTotal - emergencyUsed) },
        sick_leave: {
            total: sickTotal, used: sickUsed, remaining: Math.max(0, sickTotal - sickUsed),
            tiers: [
                { label: 'First 30 days (100% pay)', label_ar: 'أول 30 يوم (100% راتب)', days: 30, used: tier1Used, remaining: 30 - tier1Used, pay_pct: 100 },
                { label: 'Next 60 days (75% pay)', label_ar: '60 يوم التالية (75% راتب)', days: 60, used: tier2Used, remaining: 60 - tier2Used, pay_pct: 75 },
                { label: 'Last 30 days (50% pay)', label_ar: 'آخر 30 يوم (50% راتب)', days: 30, used: tier3Used, remaining: 30 - tier3Used, pay_pct: 50 },
                { label: 'Beyond (HR Decision)', label_ar: 'تجاوز (قرار الموارد البشرية)', days: null, used: tier4Used, remaining: 0, pay_pct: 0 },
            ],
        },
        // Legacy fallback fields
        annual_leave_total: annualTotal, annual_leave_used: annualUsed,
        sick_leave_total: sickTotal, sick_leave_used: sickUsed,
        emergency_leave_total: emergencyTotal, emergency_leave_used: emergencyUsed,
    });
};

export const calculateEOSB = (employee) => {
    if (!employee?.hire_date) return wrap({ years: 0, benefit: 0, breakdown: [] });
    const hireDate = new Date(employee.hire_date);
    const today = new Date();
    const years = (today - hireDate) / (1000 * 60 * 60 * 24 * 365.25);
    const baseSalary = Number(employee.base_salary || 0);
    const monthSalary = baseSalary;

    let benefit = 0;
    const breakdown = [];

    if (years < 2) {
        breakdown.push({ label: 'Less than 2 years — No benefit', amount: 0 });
    } else if (years <= 5) {
        benefit = (monthSalary / 2) * Math.floor(years);
        breakdown.push({ label: `${Math.floor(years)} years × ½ month salary`, amount: benefit });
    } else {
        const first5 = (monthSalary / 2) * 5;
        const remaining = monthSalary * (Math.floor(years) - 5);
        benefit = first5 + remaining;
        breakdown.push({ label: '5 years × ½ month salary', amount: first5 });
        breakdown.push({ label: `${Math.floor(years) - 5} years × 1 month salary`, amount: remaining });
    }

    return wrap({ years: Math.round(years * 10) / 10, benefit: Math.round(benefit), breakdown });
};

// ─── OKR ──────────────────────────────────────────────────────────────────────

export const getObjectives = async ({ quarter, year } = {}) => {
    // Fetch objectives and key_results separately to avoid schema cache issues
    let q = db.from('objectives').select('*').order('created_at', { ascending: false });
    if (quarter) q = q.eq('quarter', quarter);
    if (year) q = q.eq('year', year);
    const { data: objs, error } = await q;
    if (error) throw new Error(error.message);
    if (!objs || objs.length === 0) return wrap([]);
    const ids = objs.map(o => o.id);
    const { data: krs } = await db.from('key_results').select('*').in('objective_id', ids);
    const krMap = {};
    (krs || []).forEach(kr => { (krMap[kr.objective_id] = krMap[kr.objective_id] || []).push(kr); });
    return wrap(objs.map(o => ({ ...o, key_results: krMap[o.id] || [] })));
};

export const createObjective = async (body) => {
    const { data, error } = await db.from('objectives').insert([body]).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteObjective = async (id) => {
    await db.from('key_results').delete().eq('objective_id', id);
    const { error } = await db.from('objectives').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap(null);
};

export const createKeyResult = async (body) => {
    const { data, error } = await db.from('key_results').insert([body]).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const updateKeyResult = async (id, body) => {
    const { data, error } = await db.from('key_results').update(body).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteKeyResult = async (id) => {
    const { error } = await db.from('key_results').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap(null);
};

// ─── KPI ──────────────────────────────────────────────────────────────────────

export const getKPIs = async ({ employee_id, month, year } = {}) => {
    let q = db.from('kpis').select('*').order('created_at', { ascending: false });
    if (employee_id) q = q.eq('employee_id', employee_id);
    if (month) q = q.eq('month', month);
    if (year) q = q.eq('year', year);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const createKPI = async (body) => {
    const { data, error } = await db.from('kpis').insert([body]).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const updateKPI = async (id, body) => {
    const { data, error } = await db.from('kpis').update(body).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteKPI = async (id) => {
    const { error } = await db.from('kpis').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap(null);
};

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

export const getOnboardingTasks = async (employee_id) => {
    const { data, error } = await db.from('onboarding_tasks').select('*').eq('employee_id', employee_id).order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const createOnboardingTasks = async (employee_id, tasks) => {
    const rows = tasks.map(task_name => ({ employee_id, task_name, completed: false }));
    const { data, error } = await db.from('onboarding_tasks').insert(rows).select();
    if (error) throw new Error(error.message);
    return wrap(data);
};

export const completeOnboardingTask = async (id, completed_by) => {
    const { data, error } = await db.from('onboarding_tasks').update({ completed: true, completed_by, completed_at: new Date().toISOString() }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const uncompleteOnboardingTask = async (id) => {
    const { data, error } = await db.from('onboarding_tasks').update({ completed: false, completed_by: null, completed_at: null }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export const getReportPayroll = async ({ month, year, employeeIds } = {}) => {
    if (employeeIds && employeeIds.length === 0) return wrap({ summary: { total_employees: 0, total_gross: 0, total_deductions: 0, total_net: 0 }, byDept: [], records: [] });
    let q = db.from('payroll').select('*').eq('month', month).eq('year', year).order('net_pay', { ascending: false });
    if (employeeIds && employeeIds.length > 0) q = q.in('employee_id', employeeIds);
    const { data: records, error } = await q;
    if (error) throw new Error(error.message);

    const byDeptMap = {};
    (records || []).forEach(r => {
        if (!byDeptMap[r.department]) byDeptMap[r.department] = { department: r.department, total_gross: 0, total_net: 0, count: 0 };
        byDeptMap[r.department].total_gross += Number(r.gross_pay || 0);
        byDeptMap[r.department].total_net += Number(r.net_pay || 0);
        byDeptMap[r.department].count++;
    });
    const byDept = Object.values(byDeptMap).sort((a, b) => b.total_net - a.total_net);
    const summary = {
        total_employees: records?.length || 0,
        total_gross: records?.reduce((s, r) => s + Number(r.gross_pay || 0), 0) || 0,
        total_deductions: records?.reduce((s, r) => s + Number(r.absence_deduction || 0), 0) || 0,
        total_net: records?.reduce((s, r) => s + Number(r.net_pay || 0), 0) || 0,
    };
    return wrap({ summary, byDept, records: records || [] });
};

export const getReportAttendance = async ({ month, year, employeeIds } = {}) => {
    if (employeeIds && employeeIds.length === 0) return wrap({ summary: { total: 0, present: 0, absent: 0, on_leave: 0, excused: 0 }, byEmployee: [] });
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let q = db.from('attendance').select('*').gte('date', startDate).lte('date', endDate);
    if (employeeIds && employeeIds.length > 0) q = q.in('employee_id', employeeIds);
    const { data: records, error } = await q;
    if (error) throw new Error(error.message);

    const { data: emps } = await db.from('employees').select('id, first_name, last_name, department').eq('status', 'active');
    const empMap = {};
    (emps || []).forEach(e => { empMap[e.id] = e; });

    const byEmpMap = {};
    (records || []).forEach(r => {
        if (!byEmpMap[r.employee_id]) {
            const emp = empMap[r.employee_id] || {};
            byEmpMap[r.employee_id] = { name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(), department: emp.department || '', present_days: 0, absent_days: 0, leave_days: 0, excused_days: 0, total_days: 0 };
        }
        byEmpMap[r.employee_id].total_days++;
        if (r.status === 'present') byEmpMap[r.employee_id].present_days++;
        else if (r.status === 'absent') byEmpMap[r.employee_id].absent_days++;
        else if (['annual_leave', 'sick_leave', 'emergency_leave', 'unpaid_leave'].includes(r.status)) byEmpMap[r.employee_id].leave_days++;
        else if (r.status === 'excused') byEmpMap[r.employee_id].excused_days++;
    });
    const byEmployee = Object.values(byEmpMap).sort((a, b) => b.present_days - a.present_days);
    const summary = {
        total: records?.length || 0,
        present: records?.filter(r => r.status === 'present').length || 0,
        absent: records?.filter(r => r.status === 'absent').length || 0,
        on_leave: records?.filter(r => ['annual_leave', 'sick_leave', 'emergency_leave'].includes(r.status)).length || 0,
        excused: records?.filter(r => r.status === 'excused').length || 0,
    };
    return wrap({ summary, byEmployee });
};

export const getReportLeave = async ({ month, year, employeeIds } = {}) => {
    if (employeeIds && employeeIds.length === 0) return wrap({ summary: { total: 0, approved: 0, pending: 0, rejected: 0 }, byType: [], byEmployee: [] });
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let q = db.from('leave_requests').select('*').gte('start_date', startDate).lte('start_date', endDate).order('created_at', { ascending: false });
    if (employeeIds && employeeIds.length > 0) q = q.in('employee_id', employeeIds);
    const { data: leaves, error } = await q;
    if (error) throw new Error(error.message);

    if ((leaves || []).length > 0) {
        const ids = [...new Set((leaves || []).map(l => l.employee_id).filter(Boolean))];
        const { data: emps } = await db.from('employees').select('id, first_name, last_name').in('id', ids);
        const empMap = {};
        (emps || []).forEach(e => { empMap[e.id] = e; });
        leaves.forEach(l => { Object.assign(l, empMap[l.employee_id] || {}); });
    }

    const typeMap = {};
    (leaves || []).forEach(l => {
        if (!typeMap[l.leave_type]) typeMap[l.leave_type] = { leave_type: l.leave_type, count: 0, total_days: 0 };
        typeMap[l.leave_type].count++;
        typeMap[l.leave_type].total_days += Number(l.days_count || 0);
    });
    const byType = Object.values(typeMap);
    const summary = {
        total: leaves?.length || 0,
        approved: leaves?.filter(l => l.status === 'approved').length || 0,
        pending: leaves?.filter(l => l.status === 'pending').length || 0,
        rejected: leaves?.filter(l => l.status === 'rejected').length || 0,
    };
    return wrap({ summary, byType, byEmployee: leaves || [] });
};

export const getReportPerformance = async ({ month, year, employeeIds } = {}) => {
    if (employeeIds && employeeIds.length === 0) return wrap({ summary: { total: 0, avg_score: 0, max_score: 0, excellent_count: 0 }, rankings: [] });
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let q = db.from('performance').select('*').gte('period_start', periodStart).lte('period_end', periodEnd).order('total_score', { ascending: false });
    if (employeeIds && employeeIds.length > 0) q = q.in('employee_id', employeeIds);
    const { data: rankings, error } = await q;
    if (error) throw new Error(error.message);

    const scores = (rankings || []).map(r => Number(r.total_score || 0));
    const summary = {
        total: scores.length,
        avg_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        max_score: scores.length ? Math.max(...scores) : 0,
        excellent_count: scores.filter(s => s >= 90).length,
    };
    return wrap({ summary, rankings: rankings || [] });
};

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────

export const getScheduleEmployees = async ({ ids } = {}) => {
    let q = db.from('employees').select('id, employee_number, first_name, last_name, department, shift_type, shift_start, shift_end, days_off_count, day_off_1, day_off_2').eq('status', 'active');
    if (ids && ids.length === 0) return wrap([]);
    if (ids && ids.length > 0) q = q.in('id', ids);
    const { data, error } = await q.order('first_name', { ascending: true });
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const updateEmployeeDaysOff = async (id, { days_off_count, day_off_1, day_off_2 }) => {
    const { data, error } = await db.from('employees').update({
        days_off_count: Number(days_off_count) || 2,
        day_off_1: day_off_1 || 'friday',
        day_off_2: Number(days_off_count) === 1 ? null : (day_off_2 || 'saturday'),
    }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

// ─── RECRUITMENT ──────────────────────────────────────────────────────────────

export const getJobPostings = async () => {
    const { data, error } = await db.from('job_postings').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const createJobPosting = async (body) => {
    const { data, error } = await db.from('job_postings').insert([body]).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const updateJobPosting = async (id, body) => {
    const { data, error } = await db.from('job_postings').update(body).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteJobPosting = async (id) => {
    const { error } = await db.from('job_postings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap(null);
};

export const getApplicants = async (jobId) => {
    const { data, error } = await db.from('applicants').select('*').eq('job_id', jobId).order('applied_at', { ascending: false });
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const createApplicant = async (body) => {
    const { data, error } = await db.from('applicants').insert([{ ...body, applied_at: new Date().toISOString() }]).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const updateApplicant = async (id, body) => {
    const { data, error } = await db.from('applicants').update(body).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteApplicant = async (id) => {
    const { error } = await db.from('applicants').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return wrap(null);
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const getNotifications = async (appUserId, { limit = 30 } = {}) => {
    if (!appUserId) return wrap([]);
    const { data, error } = await db.from('notifications')
        .select('*')
        .eq('user_id', appUserId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const markNotificationRead = async (id) => {
    const { error } = await db.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw new Error(error.message);
    return wrap({ success: true });
};

export const markAllNotificationsRead = async (appUserId) => {
    if (!appUserId) return wrap({ success: true });
    const { error } = await db.from('notifications').update({ is_read: true }).eq('user_id', appUserId).eq('is_read', false);
    if (error) throw new Error(error.message);
    return wrap({ success: true });
};

export const autoRejectOldLeaves = async () => {
    const now = new Date().toISOString();
    const { data, error } = await db.from('leave_requests')
        .update({ status: 'rejected', reviewer_notes: 'Auto-rejected: no response within 7 days', reviewed_at: now })
        .eq('status', 'pending')
        .lt('auto_reject_at', now)
        .select();
    if (error) throw new Error(error.message);
    return wrap({ rejected: (data || []).length });
};

export const updateSettings = async (body) => {
    const keys = Object.keys(body).filter(k => body[k] !== undefined && body[k] !== null);
    for (const key of keys) {
        const { data: existing } = await db.from('app_settings').select('key').eq('key', key).maybeSingle();
        if (existing) {
            await db.from('app_settings').update({ value: String(body[key]) }).eq('key', key);
        } else {
            await db.from('app_settings').insert([{ key, value: String(body[key]) }]);
        }
    }
    return wrap({ message: 'Settings saved' });
};

// ─── SALARY LADDER ────────────────────────────────────────────────────────────

export const getSalaryLadder = async (grade) => {
    let q = db.from('salary_ladder').select('*');
    if (grade) q = q.eq('grade', grade);
    const { data, error } = await q.order('grade', { ascending: true }).order('year_number', { ascending: true });
    if (error) throw new Error(error.message);
    return wrap(data || []);
};

export const getSalaryLadderGrades = async () => {
    const { data, error } = await db.from('salary_ladder').select('grade');
    if (error) throw new Error(error.message);
    const unique = [...new Set((data || []).map(r => r.grade))].sort();
    return wrap(unique);
};

export const createSalaryLadderEntry = async (body) => {
    const { grade, year_number, min_salary, max_salary, annual_increment } = body;
    // Upsert: check if exists
    const { data: existing } = await db.from('salary_ladder')
        .select('id').eq('grade', grade).eq('year_number', year_number).maybeSingle();
    if (existing) {
        const { data, error } = await db.from('salary_ladder').update({
            min_salary: min_salary || 0, max_salary: max_salary || 0, annual_increment: annual_increment || 0,
        }).eq('id', existing.id).select();
        if (error) throw new Error(error.message);
        return wrap(data[0]);
    } else {
        const { data, error } = await db.from('salary_ladder').insert([{
            grade, year_number, min_salary: min_salary || 0, max_salary: max_salary || 0, annual_increment: annual_increment || 0,
        }]).select();
        if (error) throw new Error(error.message);
        return wrap(data[0]);
    }
};

export const generateSalaryLadder = async ({ grade, start_min, start_max, annual_increment, years = 10 }) => {
    if (!grade || start_min == null || start_max == null) throw new Error('grade, start_min, and start_max are required');
    const increment = annual_increment || 0;
    const entries = [];
    for (let y = 1; y <= years; y++) {
        const minSal = Math.round((start_min + increment * (y - 1)) * 100) / 100;
        const maxSal = Math.round((start_max + increment * (y - 1)) * 100) / 100;
        await createSalaryLadderEntry({ grade, year_number: y, min_salary: minSal, max_salary: maxSal, annual_increment: increment });
        entries.push({ grade, year_number: y, min_salary: minSal, max_salary: maxSal, annual_increment: increment });
    }
    return wrap({ grade, years: entries.length, entries });
};

export const updateSalaryLadderEntry = async (id, body) => {
    const { min_salary, max_salary, annual_increment } = body;
    const { data, error } = await db.from('salary_ladder').update({
        min_salary, max_salary, annual_increment,
    }).eq('id', id).select();
    if (error) throw new Error(error.message);
    return wrap(data[0]);
};

export const deleteSalaryLadderGrade = async (grade) => {
    const { error } = await db.from('salary_ladder').delete().eq('grade', grade);
    if (error) throw new Error(error.message);
    return wrap({ message: `Deleted entries for ${grade}` });
};
