import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../context/ThemeContext';
import Logo from '../components/Logo';
import {
    LogOut, Globe, User, DollarSign, Clock, TrendingUp, CalendarDays, Plus, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../lib/insforge';
import { submitLeaveRequest, getLeaveRequests, getLeaveBalance } from '../services/api';

const db = client.database;

export default function EmployeePortal() {
    const { employeeId, fullName, logout, appUserId } = useAuth();
    const { lang, toggleLang } = useLanguage();
    const { theme, setTheme, themes } = useTheme();
    const [tab, setTab] = useState('salary');
    const [employee, setEmployee] = useState(null);
    const [payroll, setPayroll] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [performance, setPerformance] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [leaveBalance, setLeaveBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    const [submittingLeave, setSubmittingLeave] = useState(false);

    const isAr = lang === 'ar';

    useEffect(() => {
        if (!employeeId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [empRes, payRes, attRes, perfRes, leaveRes, balanceRes] = await Promise.all([
                    db.from('employees').select('*').eq('id', employeeId).single(),
                    db.from('payroll').select('*').eq('employee_id', employeeId).order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(6),
                    db.from('attendance').select('*').eq('employee_id', employeeId).order('date', { ascending: false }).limit(30),
                    db.from('performance').select('*').eq('employee_id', employeeId).order('period_start', { ascending: false }).limit(6),
                    getLeaveRequests({ employee_id: employeeId }),
                    getLeaveBalance(employeeId),
                ]);
                setEmployee(empRes.data);
                setPayroll(payRes.data || []);
                setAttendance(attRes.data || []);
                setPerformance(perfRes.data || []);
                setLeaveRequests(leaveRes.data || []);
                setLeaveBalance(balanceRes.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [employeeId]);

    const labels = {
        salary: isAr ? 'الراتب' : 'My Salary',
        attendance: isAr ? 'الحضور' : 'Attendance',
        performance: isAr ? 'الأداء' : 'Performance',
        logout: isAr ? 'تسجيل الخروج' : 'Logout',
        welcome: isAr ? 'مرحباً' : 'Welcome',
        noData: isAr ? 'لا توجد بيانات' : 'No data available',
        month: isAr ? 'الشهر' : 'Month',
        net: isAr ? 'الراتب الصافي' : 'Net Pay',
        gross: isAr ? 'الراتب الإجمالي' : 'Gross Pay',
        deductions: isAr ? 'الاستقطاعات' : 'Deductions',
        date: isAr ? 'التاريخ' : 'Date',
        status: isAr ? 'الحالة' : 'Status',
        checkIn: isAr ? 'وقت الدخول' : 'Check In',
        checkOut: isAr ? 'وقت الخروج' : 'Check Out',
        score: isAr ? 'الدرجة' : 'Score',
        rating: isAr ? 'التقييم' : 'Rating',
        period: isAr ? 'الفترة' : 'Period',
    };

    const monthNames = isAr
        ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const tabs = [
        { id: 'salary', label: labels.salary, icon: DollarSign },
        { id: 'attendance', label: labels.attendance, icon: Clock },
        { id: 'performance', label: labels.performance, icon: TrendingUp },
        { id: 'leaves', label: isAr ? 'إجازاتي' : 'My Leaves', icon: CalendarDays },
    ];

    const statusBadge = (s) => {
        const map = {
            present: { label: isAr ? 'حاضر' : 'Present', cls: 'badge-present' },
            absent: { label: isAr ? 'غائب' : 'Absent', cls: 'badge-absent' },
            annual_leave: { label: isAr ? 'إجازة سنوية' : 'Annual Leave', cls: 'badge-annual' },
            sick_leave: { label: isAr ? 'إجازة مرضية' : 'Sick Leave', cls: 'badge-sick' },
            emergency_leave: { label: isAr ? 'طارئ' : 'Emergency', cls: 'badge-emergency' },
            excused: { label: isAr ? 'معذور' : 'Excused', cls: 'badge-excused' },
        };
        const m = map[s] || { label: s, cls: '' };
        return <span className={`badge ${m.cls}`}>{m.label}</span>;
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', direction: isAr ? 'rtl' : 'ltr' }}>
            {/* Top Header */}
            <header style={{
                background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
                padding: '0 24px', height: 60,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <Logo lang={lang} size="sm" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Theme pills */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        {themes.map(th => (
                            <button key={th.id} onClick={() => setTheme(th.id)} title={th.label}
                                style={{
                                    width: 28, height: 28, borderRadius: 6,
                                    border: theme === th.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                                    background: theme === th.id ? 'rgba(79,70,229,0.15)' : 'var(--surface2)',
                                    cursor: 'pointer', fontSize: '0.75rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >{th.icon}</button>
                        ))}
                    </div>
                    <button onClick={toggleLang} className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
                        <Globe size={14} /> {isAr ? 'EN' : 'ع'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <User size={16} color="white" />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{fullName}</span>
                    </div>
                    <button onClick={logout} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', gap: 4 }}>
                        <LogOut size={14} /> {labels.logout}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
                {/* Welcome banner */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    borderRadius: 16, padding: '24px 28px', marginBottom: 28,
                    display: 'flex', alignItems: 'center', gap: 16,
                }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <User size={28} color="white" />
                    </div>
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>{labels.welcome}</div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: '1.3rem' }}>{fullName}</div>
                        {employee && (
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem', marginTop: 2 }}>
                                {employee.position} · {employee.department}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab bar */}
                <div style={{
                    display: 'flex', gap: 4, background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 12,
                    padding: 4, marginBottom: 24,
                }}>
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 7, padding: '10px', borderRadius: 9, border: 'none',
                                background: tab === id ? 'var(--primary)' : 'transparent',
                                color: tab === id ? 'white' : 'var(--text-muted)',
                                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                fontFamily: 'inherit', transition: 'all 0.2s',
                            }}
                        >
                            <Icon size={16} /> {label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                        {isAr ? 'جاري التحميل...' : 'Loading...'}
                    </div>
                ) : (
                    <>
                        {/* SALARY TAB */}
                        {tab === 'salary' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {payroll.length === 0 ? (
                                    <div className="empty-state"><p>{labels.noData}</p></div>
                                ) : payroll.map(p => (
                                    <div key={p.id} className="card" style={{ padding: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                                                    {monthNames[(p.period_month || 1) - 1]} {p.period_year}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                    {isAr ? `أيام العمل: ${p.days_worked || 0}` : `Days worked: ${p.days_worked || 0}`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 20 }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{labels.gross}</div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{Number(p.gross_pay || 0).toLocaleString()} SAR</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{labels.deductions}</div>
                                                    <div style={{ fontWeight: 700, color: 'var(--danger)' }}>-{Number(p.deductions || 0).toLocaleString()} SAR</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{labels.net}</div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)' }}>{Number(p.net_pay || 0).toLocaleString()} SAR</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ATTENDANCE TAB */}
                        {tab === 'attendance' && (
                            <div className="card" style={{ padding: 0 }}>
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr>
                                            <th>{labels.date}</th>
                                            <th>{labels.status}</th>
                                            <th>{labels.checkIn}</th>
                                            <th>{labels.checkOut}</th>
                                        </tr></thead>
                                        <tbody>
                                            {attendance.length === 0
                                                ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{labels.noData}</td></tr>
                                                : attendance.map(a => (
                                                    <tr key={a.id}>
                                                        <td>{a.date}</td>
                                                        <td>{statusBadge(a.status)}</td>
                                                        <td style={{ color: 'var(--text-muted)' }}>{a.check_in || '—'}</td>
                                                        <td style={{ color: 'var(--text-muted)' }}>{a.check_out || '—'}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* LEAVES TAB */}
                        {tab === 'leaves' && (
                            <div>
                                {/* Balance cards */}
                                {leaveBalance && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                                        {[
                                            { label: isAr ? 'السنوية' : 'Annual', used: leaveBalance.annual_leave_used, total: leaveBalance.annual_leave_total, color: '#4f46e5' },
                                            { label: isAr ? 'المرضية' : 'Sick', used: leaveBalance.sick_leave_used, total: leaveBalance.sick_leave_total, color: '#ef4444' },
                                            { label: isAr ? 'الطارئة' : 'Emergency', used: leaveBalance.emergency_leave_used, total: leaveBalance.emergency_leave_total, color: '#f59e0b' },
                                        ].map(b => (
                                            <div key={b.label} className="card" style={{ padding: 16, textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: b.color }}>{b.total - b.used}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{b.label}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{b.used}/{b.total} {isAr ? 'مستخدم' : 'used'}</div>
                                                <div style={{ marginTop: 8, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                                                    <div style={{ height: 4, width: `${Math.min(100, (b.used / b.total) * 100)}%`, background: b.color, borderRadius: 2, transition: 'width 0.5s' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Request button */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                    <button className="btn btn-primary" onClick={() => setShowLeaveForm(true)}>
                                        <Plus size={15} /> {isAr ? 'طلب إجازة' : 'Request Leave'}
                                    </button>
                                </div>

                                {/* Leave request history */}
                                <div className="card" style={{ padding: 0 }}>
                                    <div className="table-wrapper">
                                        <table>
                                            <thead><tr>
                                                <th>{isAr ? 'النوع' : 'Type'}</th>
                                                <th>{isAr ? 'الفترة' : 'Period'}</th>
                                                <th>{isAr ? 'الأيام' : 'Days'}</th>
                                                <th>{isAr ? 'السبب' : 'Reason'}</th>
                                                <th>{isAr ? 'الحالة' : 'Status'}</th>
                                            </tr></thead>
                                            <tbody>
                                                {leaveRequests.length === 0 ? (
                                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{labels.noData}</td></tr>
                                                ) : leaveRequests.map(req => {
                                                    const statusColor = req.status === 'approved' ? '#10b981' : req.status === 'rejected' ? '#ef4444' : '#f59e0b';
                                                    const statusLabel = req.status === 'approved' ? (isAr ? 'مقبول' : 'Approved')
                                                        : req.status === 'rejected' ? (isAr ? 'مرفوض' : 'Rejected')
                                                            : (isAr ? 'قيد الانتظار' : 'Pending');
                                                    return (
                                                        <tr key={req.id}>
                                                            <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{req.leave_type}</td>
                                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{req.start_date} → {req.end_date}</td>
                                                            <td style={{ fontWeight: 700, textAlign: 'center' }}>{req.days_count}</td>
                                                            <td style={{ fontSize: '0.8rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</td>
                                                            <td><span style={{ background: `${statusColor}22`, color: statusColor, fontWeight: 700, fontSize: '0.75rem', borderRadius: 6, padding: '3px 8px' }}>{statusLabel}</span></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Leave request form modal */}
                                {showLeaveForm && (
                                    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowLeaveForm(false)}>
                                        <div className="modal" style={{ maxWidth: 440 }}>
                                            <div className="modal-header">
                                                <h3 className="modal-title"><CalendarDays size={18} style={{ marginInlineEnd: 8 }} />{isAr ? 'طلب إجازة جديدة' : 'New Leave Request'}</h3>
                                                <button className="modal-close" onClick={() => setShowLeaveForm(false)}><X size={18} /></button>
                                            </div>
                                            <form onSubmit={async (e) => {
                                                e.preventDefault();
                                                if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) return;
                                                setSubmittingLeave(true);
                                                try {
                                                    const start = new Date(leaveForm.start_date);
                                                    const end = new Date(leaveForm.end_date);
                                                    const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
                                                    await submitLeaveRequest({ ...leaveForm, employee_id: employeeId, days_count: days, requester_role: 'employee' });
                                                    toast.success(isAr ? 'تم إرسال الطلب' : 'Request submitted');
                                                    setShowLeaveForm(false);
                                                    setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
                                                    const r = await getLeaveRequests({ employee_id: employeeId });
                                                    setLeaveRequests(r.data || []);
                                                } catch (err) { toast.error(err.message); }
                                                finally { setSubmittingLeave(false); }
                                            }} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
                                                <div className="form-group">
                                                    <label className="form-label">{isAr ? 'نوع الإجازة' : 'Leave Type'}</label>
                                                    <select className="form-control" value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}>
                                                        <option value="annual">{isAr ? 'إجازة سنوية' : 'Annual Leave'}</option>
                                                        <option value="emergency">{isAr ? 'إجازة طارئة' : 'Emergency Leave'}</option>
                                                        <option value="exam">{isAr ? 'إجازة امتحانات' : 'Exam Leave'}</option>
                                                        <option value="sport">{isAr ? 'إجازة رياضية' : 'Sport Leave'}</option>
                                                        <option value="national_day">{isAr ? 'اليوم الوطني' : 'National Day'}</option>
                                                        <option value="foundation_day">{isAr ? 'يوم التأسيس' : 'Foundation Day'}</option>
                                                        <option value="eid_fitr">{isAr ? 'عيد الفطر' : 'Eid Al-Fitr'}</option>
                                                        <option value="eid_adha">{isAr ? 'عيد الأضحى' : 'Eid Al-Adha'}</option>
                                                    </select>
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label className="form-label">{isAr ? 'من' : 'From'} *</label>
                                                        <input type="date" className="form-control" required value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">{isAr ? 'إلى' : 'To'} *</label>
                                                        <input type="date" className="form-control" required value={leaveForm.end_date} min={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">{isAr ? 'السبب' : 'Reason'} *</label>
                                                    <textarea className="form-control" rows={3} required value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder={isAr ? 'اذكر سبب الإجازة...' : 'Describe the reason for leave...'} />
                                                </div>
                                                <div className="modal-footer">
                                                    <button type="button" className="btn btn-secondary" onClick={() => setShowLeaveForm(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                                                    <button type="submit" className="btn btn-primary" disabled={submittingLeave}>
                                                        <Plus size={15} />{submittingLeave ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال الطلب' : 'Submit Request')}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PERFORMANCE TAB */}
                        {tab === 'performance' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {performance.length === 0 ? (
                                    <div className="empty-state"><p>{labels.noData}</p></div>
                                ) : performance.map(p => (
                                    <div key={p.id} className="card" style={{ padding: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{p.period_start} → {p.period_end}</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {isAr ? `الترتيب: #${p.rank_position || '—'}` : `Rank: #${p.rank_position || '—'}`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: p.total_score >= 75 ? 'var(--success)' : p.total_score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                                        {p.total_score}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{labels.score}</div>
                                                </div>
                                                <span className={`badge badge-${p.rating?.toLowerCase() === 'excellent' ? 'excellent' : p.rating?.toLowerCase() === 'good' ? 'good' : p.rating?.toLowerCase() === 'average' ? 'average' : 'poor'}`}>
                                                    {p.rating}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 14 }}>
                                            <div className="score-bar">
                                                <div className={`score-fill score-${p.total_score >= 75 ? 'excellent' : p.total_score >= 50 ? 'average' : 'poor'}`}
                                                    style={{ width: `${p.total_score}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
