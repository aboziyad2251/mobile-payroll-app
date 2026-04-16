import React, { useEffect, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Edit2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getScheduleEmployees, updateEmployeeDaysOff } from '../services/api';
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

// Returns the weekday name ('sunday', 'monday', ...) for a Date object
const getDayName = (date) => WEEKDAYS_FULL[date.getDay()].value;

// Get all days in a month as Date objects
const getDaysInMonth = (year, month) => {
    const days = [];
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
};

// Is a given date a day off for this employee?
// Uses weekday NAME so it recurs every week automatically.
const isDayOff = (emp, date) => {
    const name = getDayName(date);
    const count = Number(emp.days_off_count || 2);
    if (name === emp.day_off_1) return true;
    if (count >= 2 && emp.day_off_2 && name === emp.day_off_2) return true;
    return false;
};

const DEPT_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
let deptColorMap = {};
let colorIdx = 0;
const deptColor = (dept) => {
    if (!deptColorMap[dept]) { deptColorMap[dept] = DEPT_COLORS[colorIdx++ % DEPT_COLORS.length]; }
    return deptColorMap[dept];
};

export default function Schedule() {
    const { role, subordinateIds, user } = useAuth();
    const { lang } = useLanguage();
    const isAr = lang === 'ar';
    const t = (en, ar) => isAr ? ar : en;
    const isAdmin = role === 'admin';

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edit modal state
    const [editEmp, setEditEmp] = useState(null);
    const [editForm, setEditForm] = useState({ days_off_count: 2, day_off_1: 'friday', day_off_2: 'saturday' });
    const [saving, setSaving] = useState(false);

    // For employee role: only their own row
    const [selfId, setSelfId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            let ids = null;
            if (role === 'manager') ids = subordinateIds;
            else if (role === 'employee') ids = subordinateIds; // subordinateIds = [own employee id] for employee role
            const r = await getScheduleEmployees({ ids });
            setEmployees(r.data || []);
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [subordinateIds]);

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

    // Summary stats
    const totalWork = (emp) => days.filter(d => !isDayOff(emp, d)).length;
    const totalOff = (emp) => days.filter(d => isDayOff(emp, d)).length;

    return (
        <div dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <CalendarRange size={22} style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {t('Work Schedule', 'جدول العمل')}
                    </h1>
                    <p className="page-subtitle">{t('Monthly schedule overview with days off per employee', 'نظرة شهرية على جدول العمل وأيام الإجازة لكل موظف')}</p>
                </div>
                {/* Month navigator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
                    <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 160, textAlign: 'center' }}>{monthName}</span>
                    <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: t('Working Day', 'يوم عمل') },
                    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: t('Day Off', 'يوم إجازة') },
                    { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: t('Weekend', 'عطلة أسبوعية') },
                ].map(({ color, bg, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `2px solid ${color}` }} />
                        {label}
                    </div>
                ))}
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
                                {/* Sticky employee column */}
                                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface2)', padding: '10px 16px', textAlign: isAr ? 'right' : 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)', minWidth: 180 }}>
                                    {t('Employee', 'الموظف')}
                                </th>
                                <th style={{ padding: '10px 8px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontWeight: 600, minWidth: 56, textAlign: 'center' }}>
                                    {t('Work', 'عمل')}
                                </th>
                                <th style={{ padding: '10px 8px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontWeight: 600, minWidth: 46, textAlign: 'center' }}>
                                    {t('Off', 'إجازة')}
                                </th>
                                {/* One column per day */}
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
                            {employees.map((emp, ei) => {
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
                                        {/* Work days count */}
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981', padding: '8px 4px' }}>{totalWork(emp)}</td>
                                        {/* Off days count */}
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#ef4444', padding: '8px 4px' }}>{totalOff(emp)}</td>
                                        {/* Day cells */}
                                        {days.map(d => {
                                            const off = isDayOff(emp, d);
                                            const dayName = getDayName(d);
                                            const isWeekend = dayName === 'friday' || dayName === 'saturday';
                                            return (
                                                <td key={d.getDate()} style={{
                                                    textAlign: 'center', padding: '6px 2px',
                                                    background: isWeekend ? 'rgba(148,163,184,0.06)' : undefined,
                                                }}>
                                                    <div style={{
                                                        width: 24, height: 24, borderRadius: 4, margin: '0 auto',
                                                        background: off ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)',
                                                        border: `1px solid ${off ? '#ef444440' : '#10b98140'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <div style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: off ? '#ef4444' : '#10b981',
                                                        }} />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        {/* Edit button — admin only */}
                                        {isAdmin && (
                                            <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                                                <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => openEdit(emp)} title={t('Edit schedule', 'تعديل الجدول')}>
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

            {/* Edit Days Off Modal — admin only */}
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
                                    setEditForm(f => ({
                                        ...f, days_off_count: count,
                                        day_off_1: count === 2 ? 'friday' : f.day_off_1,
                                        day_off_2: count === 2 ? 'saturday' : null,
                                    }));
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
                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                        {t('Every', 'كل')} <strong>{isAr ? WEEKDAYS_FULL.find(d => d.value === editForm.day_off_1)?.ar : WEEKDAYS_FULL.find(d => d.value === editForm.day_off_1)?.en}</strong> {t('will be marked as day off', 'سيُحدد كيوم إجازة')}
                                    </div>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">{t('Days Off (repeats every week)', 'أيام الإجازة (تتكرر أسبوعياً)')}</label>
                                    <input className="form-control" value={t('Friday & Saturday', 'الجمعة والسبت')} disabled style={{ color: 'var(--text-muted)' }} />
                                </div>
                            )}

                            {/* Preview */}
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
