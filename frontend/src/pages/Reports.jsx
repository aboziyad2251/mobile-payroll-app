import React, { useEffect, useState } from 'react';
import { BarChart2, FileText, Download, TrendingUp, Users, DollarSign, CalendarDays, Filter } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getReportPayroll, getReportAttendance, getReportLeave, getReportPerformance } from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#8b5cf6'];

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString();

function exportCSV(rows, filename) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

export default function Reports() {
    const { lang } = useLanguage();
    const { subordinateIds } = useAuth();
    const isAr = lang === 'ar';
    const t = (en, ar) => isAr ? ar : en;

    const now = new Date();
    const [tab, setTab] = useState('payroll');
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const locale = isAr ? 'ar-SA' : 'en-US';

    const load = async () => {
        setLoading(true);
        setData(null);
        try {
            let res;
            if (tab === 'payroll') res = await getReportPayroll({ month, year, employeeIds: subordinateIds });
            else if (tab === 'attendance') res = await getReportAttendance({ month, year, employeeIds: subordinateIds });
            else if (tab === 'leave') res = await getReportLeave({ month, year, employeeIds: subordinateIds });
            else res = await getReportPerformance({ month, year, employeeIds: subordinateIds });
            setData(res.data);
        } catch (e) { toast.error(e.message || 'Error loading report'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [tab, month, year]);

    const tabs = [
        { id: 'payroll', label: t('Payroll', 'الرواتب'), icon: DollarSign },
        { id: 'attendance', label: t('Attendance', 'الحضور'), icon: CalendarDays },
        { id: 'leave', label: t('Leave', 'الإجازات'), icon: CalendarDays },
        { id: 'performance', label: t('Performance', 'الأداء'), icon: TrendingUp },
    ];

    return (
        <div dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <BarChart2 size={22} style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {t('Reports & Analytics', 'التقارير والتحليلات')}
                    </h1>
                    <p className="page-subtitle">{t('Visual insights and exportable HR reports', 'رؤى مرئية وتقارير موارد بشرية قابلة للتصدير')}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString(locale, { month: 'long' })}</option>
                        ))}
                    </select>
                    <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(Number(e.target.value))}>
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7,
                        border: 'none', background: tab === id ? 'var(--primary)' : 'transparent',
                        color: tab === id ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{t('Loading report…', 'جاري تحميل التقرير…')}</div>
            )}

            {!loading && data && tab === 'payroll' && <PayrollReport data={data} month={month} year={year} locale={locale} t={t} fmt={fmt} exportCSV={exportCSV} />}
            {!loading && data && tab === 'attendance' && <AttendanceReport data={data} t={t} fmtN={fmtN} exportCSV={exportCSV} />}
            {!loading && data && tab === 'leave' && <LeaveReport data={data} t={t} exportCSV={exportCSV} />}
            {!loading && data && tab === 'performance' && <PerformanceReport data={data} t={t} fmt={fmt} exportCSV={exportCSV} />}
        </div>
    );
}

// ─── Payroll Report ──────────────────────────────────────────────────────────
function PayrollReport({ data, month, year, locale, t, fmt, exportCSV }) {
    const { summary, byDept, records } = data;
    return (
        <div>
            {/* Summary cards */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                {[
                    { label: t('Total Employees', 'إجمالي الموظفين'), value: fmtN(summary?.total_employees), color: '#4f46e5' },
                    { label: t('Total Gross', 'إجمالي الرواتب'), value: `${fmt(summary?.total_gross)} SAR`, color: '#0ea5e9' },
                    { label: t('Total Deductions', 'إجمالي الخصومات'), value: `${fmt(summary?.total_deductions)} SAR`, color: '#ef4444' },
                    { label: t('Total Net Pay', 'صافي الرواتب'), value: `${fmt(summary?.total_net)} SAR`, color: '#10b981' },
                ].map(({ label, value, color }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-icon" style={{ background: `${color}22` }}><DollarSign size={20} color={color} /></div>
                        <div className="stat-info"><h3 style={{ color, fontSize: '1.1rem' }}>{value}</h3><p>{label}</p></div>
                    </div>
                ))}
            </div>

            {/* By Department bar chart */}
            {byDept?.length > 0 && (
                <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>{t('Net Pay by Department', 'صافي الراتب حسب القسم')}</div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={byDept}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="department" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            <Bar dataKey="total_net" fill="#4f46e5" radius={[4, 4, 0, 0]} name={t('Net Pay', 'صافي الراتب')} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Detailed table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{t('Employee Payroll Detail', 'تفاصيل رواتب الموظفين')}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(records || [], `payroll_${year}_${month}.csv`)}>
                        <Download size={13} /> {t('Export CSV', 'تصدير CSV')}
                    </button>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>{t('Employee', 'الموظف')}</th><th>{t('Department', 'القسم')}</th>
                            <th>{t('Base Salary', 'الراتب الأساسي')}</th><th>{t('Gross', 'الإجمالي')}</th>
                            <th>{t('Deductions', 'الخصومات')}</th><th>{t('Net Pay', 'الصافي')}</th><th>{t('Status', 'الحالة')}</th>
                        </tr></thead>
                        <tbody>
                            {(records || []).length === 0
                                ? <tr><td colSpan={7}><div className="empty-state"><DollarSign size={36} /><p>{t('No payroll data for this period', 'لا توجد بيانات رواتب لهذه الفترة')}</p></div></td></tr>
                                : (records || []).map(r => (
                                    <tr key={r.id}>
                                        <td><div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div><div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.employee_number}</div></td>
                                        <td style={{ fontSize: '0.83rem' }}>{r.department}</td>
                                        <td>{fmt(r.base_salary)}</td>
                                        <td style={{ fontWeight: 600 }}>{fmt(r.gross_pay)}</td>
                                        <td style={{ color: 'var(--danger)' }}>{r.absence_deduction > 0 ? `-${fmt(r.absence_deduction)}` : '—'}</td>
                                        <td style={{ fontWeight: 700, color: '#10b981' }}>{fmt(r.net_pay)}</td>
                                        <td><span className={`badge ${r.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span></td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Attendance Report ───────────────────────────────────────────────────────
function AttendanceReport({ data, t, fmtN, exportCSV }) {
    const { summary, byEmployee } = data;
    const pieData = summary ? [
        { name: t('Present', 'حاضر'), value: summary.present || 0 },
        { name: t('Absent', 'غائب'), value: summary.absent || 0 },
        { name: t('On Leave', 'في إجازة'), value: summary.on_leave || 0 },
        { name: t('Excused', 'معذور'), value: summary.excused || 0 },
    ].filter(d => d.value > 0) : [];

    return (
        <div>
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                {[
                    { label: t('Total Records', 'إجمالي السجلات'), value: fmtN(summary?.total), color: '#4f46e5' },
                    { label: t('Present', 'حاضر'), value: fmtN(summary?.present), color: '#10b981' },
                    { label: t('Absent', 'غائب'), value: fmtN(summary?.absent), color: '#ef4444' },
                    { label: t('On Leave', 'في إجازة'), value: fmtN(summary?.on_leave), color: '#f59e0b' },
                ].map(({ label, value, color }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-icon" style={{ background: `${color}22` }}><CalendarDays size={20} color={color} /></div>
                        <div className="stat-info"><h3 style={{ color }}>{value}</h3><p>{label}</p></div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {pieData.length > 0 && (
                    <div className="card" style={{ padding: 20 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('Attendance Breakdown', 'توزيع الحضور')}</div>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {byEmployee?.length > 0 && (
                    <div className="card" style={{ padding: 20 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('Days Present by Employee', 'أيام الحضور لكل موظف')}</div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={byEmployee.slice(0, 10)} layout="vertical">
                                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={80} />
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <Bar dataKey="present_days" fill="#10b981" radius={[0, 4, 4, 0]} name={t('Days Present', 'أيام الحضور')} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{t('Employee Attendance Detail', 'تفاصيل حضور الموظفين')}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(byEmployee || [], 'attendance_report.csv')}>
                        <Download size={13} /> {t('Export CSV', 'تصدير CSV')}
                    </button>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>{t('Employee', 'الموظف')}</th><th>{t('Present', 'حاضر')}</th>
                            <th>{t('Absent', 'غائب')}</th><th>{t('Leave', 'إجازة')}</th>
                            <th>{t('Excused', 'معذور')}</th><th>{t('Attendance %', 'نسبة الحضور')}</th>
                        </tr></thead>
                        <tbody>
                            {(byEmployee || []).length === 0
                                ? <tr><td colSpan={6}><div className="empty-state"><CalendarDays size={36} /><p>{t('No attendance data', 'لا توجد بيانات حضور')}</p></div></td></tr>
                                : (byEmployee || []).map((r, i) => {
                                    const pct = r.total_days > 0 ? Math.round((r.present_days / r.total_days) * 100) : 0;
                                    return (
                                        <tr key={i}>
                                            <td><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.department}</div></td>
                                            <td style={{ color: '#10b981', fontWeight: 600 }}>{r.present_days}</td>
                                            <td style={{ color: '#ef4444' }}>{r.absent_days}</td>
                                            <td style={{ color: '#f59e0b' }}>{r.leave_days}</td>
                                            <td style={{ color: '#0ea5e9' }}>{r.excused_days}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: 32 }}>{pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Leave Report ────────────────────────────────────────────────────────────
const LEAVE_COLORS = { annual: '#4f46e5', sick: '#ef4444', emergency: '#f59e0b', unpaid: '#64748b' };
const LEAVE_LABELS = { en: { annual: 'Annual', sick: 'Sick', emergency: 'Emergency', unpaid: 'Unpaid' }, ar: { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' } };

function LeaveReport({ data, t, exportCSV }) {
    const { summary, byType, byEmployee } = data;
    const pieData = (byType || []).map(b => ({ name: b.leave_type, value: b.count }));

    return (
        <div>
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                {[
                    { label: t('Total Requests', 'إجمالي الطلبات'), value: fmtN(summary?.total), color: '#4f46e5' },
                    { label: t('Approved', 'مقبول'), value: fmtN(summary?.approved), color: '#10b981' },
                    { label: t('Pending', 'قيد الانتظار'), value: fmtN(summary?.pending), color: '#f59e0b' },
                    { label: t('Rejected', 'مرفوض'), value: fmtN(summary?.rejected), color: '#ef4444' },
                ].map(({ label, value, color }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-icon" style={{ background: `${color}22` }}><CalendarDays size={20} color={color} /></div>
                        <div className="stat-info"><h3 style={{ color }}>{value}</h3><p>{label}</p></div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {pieData.length > 0 && (
                    <div className="card" style={{ padding: 20 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('Leave Type Distribution', 'توزيع أنواع الإجازات')}</div>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                    {pieData.map((entry, i) => <Cell key={i} fill={LEAVE_COLORS[entry.name] || COLORS[i]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {(byType || []).length > 0 && (
                    <div className="card" style={{ padding: 20 }}>
                        <div style={{ fontWeight: 700, marginBottom: 16 }}>{t('Leave Days by Type', 'أيام الإجازة حسب النوع')}</div>
                        {(byType || []).map(b => (
                            <div key={b.leave_type} style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.83rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{LEAVE_LABELS.en[b.leave_type] || b.leave_type}</span>
                                    <span style={{ fontWeight: 700 }}>{b.total_days} {t('days', 'أيام')}</span>
                                </div>
                                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                    <div style={{ width: `${Math.min(100, (b.count / (summary?.total || 1)) * 100)}%`, height: '100%', background: LEAVE_COLORS[b.leave_type] || '#4f46e5', borderRadius: 3 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{t('Leave Requests Detail', 'تفاصيل طلبات الإجازة')}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(byEmployee || [], 'leave_report.csv')}>
                        <Download size={13} /> {t('Export CSV', 'تصدير CSV')}
                    </button>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>{t('Employee', 'الموظف')}</th><th>{t('Leave Type', 'نوع الإجازة')}</th>
                            <th>{t('Period', 'الفترة')}</th><th>{t('Days', 'الأيام')}</th><th>{t('Status', 'الحالة')}</th>
                        </tr></thead>
                        <tbody>
                            {(byEmployee || []).length === 0
                                ? <tr><td colSpan={5}><div className="empty-state"><CalendarDays size={36} /><p>{t('No leave data', 'لا توجد بيانات إجازة')}</p></div></td></tr>
                                : (byEmployee || []).map((r, i) => (
                                    <tr key={i}>
                                        <td><div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div></td>
                                        <td><span style={{ fontSize: '0.78rem', fontWeight: 700, color: LEAVE_COLORS[r.leave_type] || '#4f46e5' }}>{LEAVE_LABELS.en[r.leave_type] || r.leave_type}</span></td>
                                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.start_date} → {r.end_date}</td>
                                        <td style={{ fontWeight: 700 }}>{r.days_count}</td>
                                        <td><span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{r.status}</span></td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Performance Report ──────────────────────────────────────────────────────
function PerformanceReport({ data, t, fmt, exportCSV }) {
    const { summary, rankings } = data;

    return (
        <div>
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                {[
                    { label: t('Employees Ranked', 'الموظفون المصنفون'), value: fmtN(summary?.total), color: '#4f46e5' },
                    { label: t('Average Score', 'متوسط الدرجات'), value: fmt(summary?.avg_score), color: '#0ea5e9' },
                    { label: t('Highest Score', 'أعلى درجة'), value: fmt(summary?.max_score), color: '#10b981' },
                    { label: t('Excellent Rated', 'تقييم ممتاز'), value: fmtN(summary?.excellent_count), color: '#8b5cf6' },
                ].map(({ label, value, color }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-icon" style={{ background: `${color}22` }}><TrendingUp size={20} color={color} /></div>
                        <div className="stat-info"><h3 style={{ color }}>{value}</h3><p>{label}</p></div>
                    </div>
                ))}
            </div>

            {(rankings || []).length > 0 && (
                <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>{t('Score Distribution (Top 10)', 'توزيع الدرجات (أعلى 10)')}</div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={(rankings || []).slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="first_name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            <Bar dataKey="total_score" radius={[4, 4, 0, 0]} name={t('Score', 'الدرجة')}>
                                {(rankings || []).slice(0, 10).map((r, i) => (
                                    <Cell key={i} fill={r.total_score >= 90 ? '#10b981' : r.total_score >= 75 ? '#4f46e5' : r.total_score >= 60 ? '#f59e0b' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{t('Performance Rankings', 'تصنيفات الأداء')}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(rankings || [], 'performance_report.csv')}>
                        <Download size={13} /> {t('Export CSV', 'تصدير CSV')}
                    </button>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>#</th><th>{t('Employee', 'الموظف')}</th><th>{t('Department', 'القسم')}</th>
                            <th>{t('Attendance', 'الحضور')}</th><th>{t('Discipline', 'الانضباط')}</th>
                            <th>{t('Total Score', 'الدرجة الكلية')}</th><th>{t('Rating', 'التقييم')}</th>
                        </tr></thead>
                        <tbody>
                            {(rankings || []).length === 0
                                ? <tr><td colSpan={7}><div className="empty-state"><TrendingUp size={36} /><p>{t('No performance data', 'لا توجد بيانات أداء')}</p></div></td></tr>
                                : (rankings || []).map((r, i) => (
                                    <tr key={r.id}>
                                        <td style={{ fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)' }}>#{i + 1}</td>
                                        <td><div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div><div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.employee_number}</div></td>
                                        <td style={{ fontSize: '0.83rem' }}>{r.department}</td>
                                        <td>{fmt(r.attendance_score)}</td>
                                        <td>{fmt(r.discipline_score)}</td>
                                        <td><span style={{ fontWeight: 800, color: r.total_score >= 90 ? '#10b981' : r.total_score >= 75 ? '#4f46e5' : r.total_score >= 60 ? '#f59e0b' : '#ef4444' }}>{fmt(r.total_score)}</span></td>
                                        <td><span className={`badge ${r.rating === 'Excellent' ? 'badge-excellent' : r.rating === 'Good' ? 'badge-good' : r.rating === 'Average' ? 'badge-average' : 'badge-poor'}`}>{r.rating}</span></td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
