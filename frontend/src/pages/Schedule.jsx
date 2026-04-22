import React, { useEffect, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Edit2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getScheduleEmployees, updateEmployeeDaysOff, getLeaveRequests } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const WEEKDAYS = [
    { value: 'sunday',    en: 'Sun', ar: 'أحد' },
    { value: 'monday',    en: 'Mon', ar: 'اثن' },
    { value: 'tuesday',   en: 'Tue', ar: 'ثلا' },
    { value: 'wednesday', en: 'Wed', ar: 'أرب' },
    { value: 'thursday',  en: 'Thu', ar: 'خمي' },
    { value: 'friday',    en: 'Fri', ar: 'جمع' },
    { value: 'saturday',  en: 'Sat', ar: 'سبت' },
];

const WEEKDAYS_FULL = [
    { value: 'sunday',    en: 'Sunday',    ar: 'الأحد' },
    { value: 'monday',    en: 'Monday',    ar: 'الاثنين' },
    { value: 'tuesday',   en: 'Tuesday',   ar: 'الثلاثاء' },
    { value: 'wednesday', en: 'Wednesday', ar: 'الأربعاء' },
    { value: 'thursday',  en: 'Thursday',  ar: 'الخميس' },
    { value: 'friday',    en: 'Friday',    ar: 'الجمعة' },
    { value: 'saturday',  en: 'Saturday',  ar: 'السبت' },
];

const LEAVE_TYPES = {
    annual:         { en: 'Annual',       ar: 'سنوية',      color: '#4f46e5', bg: 'rgba(79,70,229,0.25)' },
    emergency:      { en: 'Emergency',    ar: 'طارئة',       color: '#ef4444', bg: 'rgba(239,68,68,0.25)' },
    sick:           { en: 'Sick',         ar: 'مرضية',       color: '#f43f5e', bg: 'rgba(244,63,94,0.25)' },
    exam:           { en: 'Exam',         ar: 'امتحانات',    color: '#0ea5e9', bg: 'rgba(14,165,233,0.25)' },
    sport:          { en: 'Sport',        ar: 'رياضية',      color: '#10b981', bg: 'rgba(16,185,129,0.25)' },
    national_day:   { en: 'National Day', ar: 'وطني',        color: '#6366f1', bg: 'rgba(99,102,241,0.25)' },
    foundation_day: { en: 'Foundation',   ar: 'تأسيس',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.25)' },
    eid_fitr:       { en: 'Eid Fitr',     ar: 'الفطر',       color: '#f59e0b', bg: 'rgba(245,158,11,0.25)' },
    eid_adha:       { en: 'Eid Adha',     ar: 'الأضحى',      color: '#d97706', bg: 'rgba(217,119,6,0.25)'  },
    unpaid:         { en: 'Unpaid',       ar: 'بدون راتب',   color: '#64748b', bg: 'rgba(100,116,139,0.25)' },
    death:          { en: 'Death',        ar: 'وفاة',         color: '#475569', bg: 'rgba(71,85,105,0.25)'  },
    business_trip:  { en: 'Business Trip',ar: 'مأمورية',     color: '#0891b2', bg: 'rgba(8,145,178,0.25)'  },
};

const getDayName = (date) => WEEKDAYS_FULL[date.getDay()].value;

const getDaysInMonth = (year, month) => {
    const days = [];
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
};

const isDayOff = (emp, date) => {
    const name = getDayName(date);
    const count = Number(emp.days_off_count || 2);
    if (name === emp.day_off_1) return true;
    if (count >= 2 && emp.day_off_2 && name === emp.day_off_2) return true;
    return false;
};

const toDateStr = (d) => d.toISOString().split('T')[0];

const DEPT_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
let deptColorMap = {};
let colorIdx = 0;
const deptColor = (dept) => {
    if (!deptColorMap[dept]) { deptColorMap[dept] = DEPT_COLORS[colorIdx++ % DEPT_COLORS.length]; }
    return deptColorMap[dept];
};

export default function Schedule() {
    const { role, subordinateIds, user, fullName } = useAuth();
    const { lang } = useLanguage();
    const isAr = lang === 'ar';
    const t = (en, ar) => isAr ? ar : en;
    const isAdmin = role === 'admin';

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [leaves, setLeaves] = useState([]); // approved leaves for the month

    const [editEmp, setEditEmp] = useState(null);
    const [editForm, setEditForm] = useState({ days_off_count: 2, day_off_1: 'friday', day_off_2: 'saturday' });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            let ids = null;
            if (role === 'manager') ids = subordinateIds;
            else if (role === 'employee') ids = subordinateIds;
            const r = await getScheduleEmployees({ ids });
            setEmployees(r.data || []);
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    const loadLeaves = async () => {
        try {
            const r = await getLeaveRequests({ status: 'approved' });
            setLeaves(r.data || []);
        } catch {}
    };

    useEffect(() => { load(); }, [subordinateIds]);
    useEffect(() => { loadLeaves(); }, [month, year]);

    const days = getDaysInMonth(year, month);
    const locale = isAr ? 'ar-SA' : 'en-US';
    const monthName = new Date(year, month - 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

    const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const openEdit = (emp) => {
        setEditEmp(emp);
        setEditForm({ days_off_count: emp.days_off_count || 2, day_off_1: emp.day_off_1 || 'friday', day_off_2: emp.day_off_2 || 'saturday' });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateEmployeeDaysOff(editEmp.id, editForm);
            toast.success(t('Schedule updated', 'تم تحديث الجدول'));
            setEditEmp(null);
            load();
        } catch (e) { toast.error(e.message); }
        finally { setSaving(false); }
    };

    // Get approved leave for an employee or CEO on a specific date
    const getLeaveOnDate = (emp, date) => {
        const dateStr = toDateStr(date);
        return leaves.find(l => {
            if (!l.start_date || !l.end_date) return false;
            if (!(dateStr >= l.start_date && dateStr <= l.end_date)) return false;
            if (emp.__isCEO) return (l.requester_role === 'admin' || l.requester_role === 'CEO') && !l.employee_id;
            return String(l.employee_id) === String(emp.id);
        });
    };

    // Build CEO virtual row if admin has leaves without employee_id
    const ceoLeaves = leaves.filter(l => (l.requester_role === 'admin' || l.requester_role === 'CEO') && !l.employee_id);
    const ceoRow = (role === 'admin' || role === 'CEO') && ceoLeaves.length > 0
        ? { __isCEO: true, id: '__ceo__', first_name: fullName || 'CEO', last_name: '', department: 'Management', days_off_count: 2, day_off_1: 'friday', day_off_2: 'saturday' }
        : null;

    const totalWork = (emp) => days.filter(d => !isDayOff(emp, d) && !getLeaveOnDate(emp, d)).length;
    const totalOff = (emp) => days.filter(d => isDayOff(emp, d)).length;
    const totalLeave = (emp) => days.filter(d => !isDayOff(emp, d) && getLeaveOnDate(emp, d)).length;

    // Unique leave types used this month for legend
    const usedLeaveTypes = [...new Set(leaves.map(l => l.leave_type))].filter(Boolean);

    return (
        <div dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <CalendarRange size={22} style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {t('Work Schedule', 'جدول العمل')}
                    </h1>
                    <p className="page-subtitle">{t('Monthly schedule with approved leaves per employee', 'الجدول الشهري مع الإجازات المعتمدة لكل موظف')}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
                    <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 160, textAlign: 'center' }}>{monthName}</span>
                    <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: t('Working Day', 'يوم عمل') },
                    { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: t('Weekend', 'عطلة أسبوعية') },
                ].map(({ color, bg, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `2px solid ${color}` }} />
                        {label}
                    </div>
                ))}
                {/* Dynamic leave type legend */}
                {usedLeaveTypes.map(type => {
                    const lt = LEAVE_TYPES[type];
                    if (!lt) return null;
                    return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <div style={{ width: 14, height: 14, borderRadius: 3, background: lt.bg, border: `2px solid ${lt.color}` }} />
                            {isAr ? lt.ar : lt.en}
                        </div>
                    );
                })}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{t('Loading…', 'جاري التحميل…')}</div>
            ) : employees.length === 0 ? (
                <div className="card" style={{ padding: 60, textAlign: 'center' }}>
                    <CalendarRange size={48} style={{ opacity: 0.3, marginBottom: 12, color: 'var(--text-muted)' }} />
                    <p style={{ color: 'var(--text-muted)' }}>{t('No employees found.', 'لا يوجد موظفون.')}</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: '0.78rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--surface2)' }}>
                                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface2)', padding: '10px 16px', textAlign: isAr ? 'right' : 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)', minWidth: 180 }}>
                                    {t('Employee', 'الموظف')}
                                </th>
                                <th style={{ padding: '10px 6px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: '#10b981', fontWeight: 700, minWidth: 46, textAlign: 'center' }}>
                                    {t('Work', 'عمل')}
                                </th>
                                <th style={{ padding: '10px 6px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: '#94a3b8', fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
                                    {t('Off', 'أجازة')}
                                </th>
                                <th style={{ padding: '10px 6px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: '#4f46e5', fontWeight: 700, minWidth: 44, textAlign: 'center' }}>
                                    {t('Leave', 'إجازة')}
                                </th>
                                {days.map(d => {
                                    const dayName = getDayName(d);
                                    const isWeekend = dayName === 'friday' || dayName === 'saturday';
                                    const wd = WEEKDAYS.find(w => w.value === dayName);
                                    return (
                                        <th key={d.getDate()} style={{
                                            padding: '6px 4px', borderBottom: '2px solid var(--border)',
                                            textAlign: 'center', minWidth: 32, fontWeight: 600,
                                            color: isWeekend ? '#94a3b8' : 'var(--text-muted)',
                                            background: isWeekend ? 'rgba(148,163,184,0.07)' : undefined,
                                        }}>
                                            <div>{d.getDate()}</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{isAr ? wd.ar : wd.en}</div>
                                        </th>
                                    );
                                })}
                                {isAdmin && <th style={{ padding: '10px 8px', borderBottom: '2px solid var(--border)', minWidth: 60 }} />}
                            </tr>
                        </thead>
                        <tbody>
                            {[...(ceoRow ? [ceoRow] : []), ...employees].map((emp) => {
                                const dc = deptColor(emp.department);
                                return (
                                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        {/* Employee info — sticky */}
                                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', padding: '8px 16px', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 8, height: 28, borderRadius: 3, background: dc, flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{emp.first_name} {emp.last_name}</div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{emp.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981', padding: '8px 4px' }}>{totalWork(emp)}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8', padding: '8px 4px' }}>{totalOff(emp)}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#4f46e5', padding: '8px 4px' }}>{totalLeave(emp)}</td>
                                        {/* Day cells */}
                                        {days.map(d => {
                                            const off = isDayOff(emp, d);
                                            const dayName = getDayName(d);
                                            const isWeekend = dayName === 'friday' || dayName === 'saturday';
                                            const leave = !off ? getLeaveOnDate(emp, d) : null;
                                            const lt = leave ? (LEAVE_TYPES[leave.leave_type] || LEAVE_TYPES.annual) : null;

                                            let bg, border, dot;
                                            if (off) {
                                                bg = 'rgba(148,163,184,0.12)';
                                                border = '#94a3b840';
                                                dot = '#94a3b8';
                                            } else if (lt) {
                                                bg = lt.bg;
                                                border = lt.color + '60';
                                                dot = lt.color;
                                            } else {
                                                bg = 'rgba(16,185,129,0.12)';
                                                border = '#10b98140';
                                                dot = '#10b981';
                                            }

                                            return (
                                                <td key={d.getDate()} style={{
                                                    textAlign: 'center', padding: '6px 2px',
                                                    background: isWeekend ? 'rgba(148,163,184,0.06)' : undefined,
                                                }}>
                                                    <div title={lt ? (isAr ? lt.ar : lt.en) : undefined} style={{
                                                        width: 24, height: 24, borderRadius: 4, margin: '0 auto',
                                                        background: bg, border: `1px solid ${border}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: lt ? 'help' : 'default',
                                                    }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {isAdmin && (
                                            <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                                                <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => openEdit(emp)}>
                                                    <Edit2 size={13} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Days Off Modal */}
            {isAdmin && editEmp && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditEmp(null)}>
                    <div className="modal" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <Edit2 size={16} style={{ marginInlineEnd: 8 }} />
                                {t('Edit Days Off', 'تعديل أيام الإجازة')} — {editEmp.first_name} {editEmp.last_name}
                            </h3>
                            <button className="modal-close" onClick={() => setEditEmp(null)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '16px 0 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">{t('Days Off Per Week', 'أيام الإجازة في الأسبوع')}</label>
                                <select className="form-control" value={editForm.days_off_count} onChange={e => {
                                    const count = Number(e.target.value);
                                    setEditForm(f => ({ ...f, days_off_count: count, day_off_1: count === 2 ? 'friday' : f.day_off_1, day_off_2: count === 2 ? 'saturday' : null }));
                                }}>
                                    <option value={1}>{t('1 Day Off', 'يوم إجازة واحد')}</option>
                                    <option value={2}>{t('2 Days Off (Fri + Sat)', 'يومان (جمعة + سبت)')}</option>
                                </select>
                            </div>
                            {Number(editForm.days_off_count) === 1 ? (
                                <div className="form-group">
                                    <label className="form-label">{t('Day Off (repeats every week)', 'يوم الإجازة (يتكرر أسبوعياً)')}</label>
                                    <select className="form-control" value={editForm.day_off_1} onChange={e => setEditForm(f => ({ ...f, day_off_1: e.target.value }))}>
                                        {WEEKDAYS_FULL.map(d => <option key={d.value} value={d.value}>{isAr ? d.ar : d.en}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">{t('Days Off', 'أيام الإجازة')}</label>
                                    <input className="form-control" value={t('Friday & Saturday', 'الجمعة والسبت')} disabled style={{ color: 'var(--text-muted)' }} />
                                </div>
                            )}
                            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{t('Preview', 'معاينة')}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {WEEKDAYS_FULL.map(d => {
                                        const cnt = Number(editForm.days_off_count);
                                        const isOff = d.value === editForm.day_off_1 || (cnt >= 2 && d.value === editForm.day_off_2);
                                        return (
                                            <div key={d.value} style={{
                                                padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                                                background: isOff ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)',
                                                color: isOff ? '#ef4444' : '#10b981',
                                                border: `1px solid ${isOff ? '#ef444430' : '#10b98130'}`,
                                            }}>
                                                {isAr ? d.ar : d.en}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditEmp(null)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                <Check size={15} />{saving ? t('Saving…', 'جاري الحفظ…') : t('Save', 'حفظ')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
