import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, XCircle, Clock, Filter, X, ChevronDown, ChevronUp, Plus, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, autoRejectOldLeaves, submitLeaveRequest, getCEOLeaves } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const LEAVE_TYPES = {
    annual:         { en: 'Annual Leave',    ar: 'إجازة سنوية',        color: '#4f46e5', bg: 'rgba(79,70,229,0.15)' },
    emergency:      { en: 'Emergency Leave', ar: 'إجازة طارئة',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    exam:           { en: 'Exam Leave',      ar: 'إجازة امتحانات',     color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
    sport:          { en: 'Sport Leave',     ar: 'إجازة رياضية',       color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    national_day:   { en: 'National Day',    ar: 'اليوم الوطني',       color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
    foundation_day: { en: 'Foundation Day',  ar: 'يوم التأسيس',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
    eid_fitr:       { en: 'Eid Al-Fitr',     ar: 'عيد الفطر',          color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    eid_adha:       { en: 'Eid Al-Adha',     ar: 'عيد الأضحى',         color: '#d97706', bg: 'rgba(217,119,6,0.15)'  },
    sick:           { en: 'Sick Leave',       ar: 'إجازة مرضية',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    unpaid:         { en: 'Unpaid Leave',     ar: 'إجازة بدون راتب',    color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
    death:          { en: 'Death Leave',      ar: 'إجازة وفاة',          color: '#475569', bg: 'rgba(71,85,105,0.15)'  },
    business_trip:  { en: 'Business Trip',    ar: 'مأمورية عمل',         color: '#0891b2', bg: 'rgba(8,145,178,0.15)'  },
};

const STATUS_META = {
    pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', en: 'Pending',  ar: 'قيد الانتظار' },
    approved: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', en: 'Approved', ar: 'مقبول' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', en: 'Rejected', ar: 'مرفوض' },
};

const EMPTY_REQ_FORM = { leave_type: 'annual', start_date: '', end_date: '', days_count: 1, reason: '' };

export default function LeaveManagement() {
    const { fullName, subordinateIds, role, employeeId, canDo } = useAuth();
    const { lang } = useLanguage();
    const isAr = lang === 'ar';

    const [activeTab, setActiveTab] = useState('team');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // My Leave tab
    const [myLeaves, setMyLeaves] = useState([]);
    const [myLeavesLoading, setMyLeavesLoading] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [reqForm, setReqForm] = useState(EMPTY_REQ_FORM);
    const [submitting, setSubmitting] = useState(false);

    // CEO Schedule tab
    const [ceoLeaves, setCeoLeaves] = useState([]);
    const [ceoLeavesLoading, setCeoLeavesLoading] = useState(false);

    const t = (en, ar) => isAr ? ar : en;
    const isCEO = role === 'admin';
    const isManager = role === 'manager';
    const canApproveAll = isCEO || canDo('approve_leaves');

    const load = async () => {
        setLoading(true);
        try {
            await autoRejectOldLeaves().catch(e => console.error('Auto-reject failed:', e));
            // If CEO or delegated manager: see all. Otherwise filter by subordinates.
            const filter = canApproveAll ? {} : (subordinateIds ? { employeeIds: subordinateIds } : {});
            const r = await getLeaveRequests({ ...(filterStatus ? { status: filterStatus } : {}), ...filter });
            setRequests(r.data || []);
        } catch { toast.error(t('Failed to load leave requests', 'فشل تحميل طلبات الإجازة')); }
        finally { setLoading(false); }
    };

    const loadMyLeaves = async () => {
        if (!employeeId) return;
        setMyLeavesLoading(true);
        try {
            const r = await getLeaveRequests({ employeeIds: [employeeId] });
            setMyLeaves(r.data || []);
        } catch {}
        finally { setMyLeavesLoading(false); }
    };

    const loadCeoLeaves = async () => {
        setCeoLeavesLoading(true);
        try {
            const r = await getCEOLeaves();
            setCeoLeaves(r.data || []);
        } catch {}
        finally { setCeoLeavesLoading(false); }
    };

    useEffect(() => { load(); }, [filterStatus]);
    useEffect(() => { if (activeTab === 'my') loadMyLeaves(); }, [activeTab]);
    useEffect(() => { if (activeTab === 'ceo') loadCeoLeaves(); }, [activeTab]);

    const handleSubmitMyLeave = async (e) => {
        e.preventDefault();
        if (!employeeId && !isCEO) return toast.error(t('Link your employee record in Users page first', 'ربط سجل الموظف أولاً من صفحة المستخدمين'));
        if (!reqForm.start_date || !reqForm.end_date) return toast.error(t('Select start and end dates', 'حدد تاريخ البداية والنهاية'));
        setSubmitting(true);
        try {
            await submitLeaveRequest({
                employee_id: employeeId,
                leave_type: reqForm.leave_type,
                start_date: reqForm.start_date,
                end_date: reqForm.end_date,
                days_count: reqForm.days_count,
                reason: reqForm.reason,
                requester_role: role,
            });
            toast.success(isCEO
                ? t('Leave posted (auto-approved)', 'تم نشر الإجازة تلقائياً')
                : t('Leave request submitted — awaiting CEO approval', 'تم إرسال طلب الإجازة — بانتظار موافقة الرئيس'));
            setShowRequestModal(false);
            setReqForm(EMPTY_REQ_FORM);
            loadMyLeaves();
        } catch (e) { toast.error(e.message); }
        finally { setSubmitting(false); }
    };

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            const reqData = requests.find(r => r.id === id);
            await approveLeaveRequest(id, fullName, reqData);
            toast.success(t('Leave request approved', 'تمت الموافقة على الإجازة'));
            load();
        } catch (e) { toast.error(e.message); }
        finally { setActionLoading(null); }
    };

    const handleReject = async () => {
        setActionLoading(rejectModal);
        try {
            const reqData = requests.find(r => r.id === rejectModal);
            await rejectLeaveRequest(rejectModal, fullName, rejectNotes, reqData);
            toast.success(t('Leave request rejected', 'تم رفض طلب الإجازة'));
            setRejectModal(null);
            setRejectNotes('');
            load();
        } catch (e) { toast.error(e.message); }
        finally { setActionLoading(null); }
    };

    const allCounts = { pending: 0, approved: 0, rejected: 0 };
    requests.forEach(r => { if (allCounts[r.status] !== undefined) allCounts[r.status]++; });

    const leaveLabel = (type) => LEAVE_TYPES[type]?.[lang] || type;
    const statusLabel = (s) => STATUS_META[s]?.[lang] || s;

    // Reusable leave card (used in both Team and My Leave tabs)
    const LeaveCard = ({ req, showActions }) => {
        const lt = LEAVE_TYPES[req.leave_type] || LEAVE_TYPES.annual;
        const sm = STATUS_META[req.status] || STATUS_META.pending;
        const isExpanded = expandedId === req.id;
        return (
            <div style={{
                background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
                border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}>
                <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                            background: `linear-gradient(135deg, ${lt.color}33, ${lt.color}66)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem', fontWeight: 800, color: lt.color,
                        }}>
                            {(req.first_name || req.employee_number || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                                {req.first_name} {req.last_name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                                {req.employee_number}{req.department ? ` · ${req.department}` : ''}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <span style={{ background: lt.bg, color: lt.color, fontSize: '0.7rem', fontWeight: 700, borderRadius: 8, padding: '2px 8px' }}>
                                    {leaveLabel(req.leave_type)}
                                </span>
                                <span style={{ background: sm.bg, color: sm.color, fontSize: '0.7rem', fontWeight: 700, borderRadius: 8, padding: '2px 8px' }}>
                                    {statusLabel(req.status)}
                                </span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lt.color, lineHeight: 1 }}>{req.days_count}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t('days', 'أيام')}</div>
                            <div style={{ marginTop: 4 }}>
                                {isExpanded ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 10 }}>
                        <CalendarDays size={13} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                            {req.start_date} → {req.end_date}
                        </span>
                    </div>
                </div>

                {isExpanded && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                        {req.reason && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                                    {t('Reason', 'السبب')}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{req.reason}</div>
                            </div>
                        )}
                        {req.reviewed_by && (
                            <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                                        {t('Reviewed By', 'راجعه')}
                                    </div>
                                    <div style={{ fontSize: '0.82rem' }}>{req.reviewed_by}</div>
                                </div>
                                {req.reviewed_at && (
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                                            {t('Date', 'التاريخ')}
                                        </div>
                                        <div style={{ fontSize: '0.82rem' }}>{req.reviewed_at.slice(0, 10)}</div>
                                    </div>
                                )}
                            </div>
                        )}
                        {req.reviewer_notes && (
                            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: '0.78rem', color: '#ef4444' }}>
                                {req.reviewer_notes}
                            </div>
                        )}
                    </div>
                )}

                {showActions && req.status === 'pending' && (
                    <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                        <button onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id}
                            style={{
                                flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                color: '#10b981', fontWeight: 700, fontSize: '0.82rem',
                                borderRight: isAr ? 'none' : '1px solid var(--border)',
                                borderLeft: isAr ? '1px solid var(--border)' : 'none',
                                opacity: actionLoading === req.id ? 0.5 : 1,
                            }}>
                            <CheckCircle size={15} />{t('Approve', 'قبول')}
                        </button>
                        <button onClick={() => { setRejectModal(req.id); setRejectNotes(''); }} disabled={actionLoading === req.id}
                            style={{
                                flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                color: '#ef4444', fontWeight: 700, fontSize: '0.82rem',
                                opacity: actionLoading === req.id ? 0.5 : 1,
                            }}>
                            <XCircle size={15} />{t('Reject', 'رفض')}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Tabs config
    const TABS = [
        ...(canApproveAll || isManager ? [{ id: 'team', label: t('Team', 'الفريق'), icon: '👥' }] : []),
        { id: 'my', label: t('My Leave', 'إجازتي'), icon: '📋' },
        { id: 'ceo', label: t('CEO Schedule', 'جدول المدير'), icon: '👑' },
    ];

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 16 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('Leave Management', 'إدارة الإجازات')}</p>
                    <h2 className="esshub-hero-value">
                        {activeTab === 'team' ? requests.length : activeTab === 'my' ? myLeaves.length : ceoLeaves.length}
                        <span className="esshub-hero-unit"> {t('requests', 'طلب')}</span>
                    </h2>
                    <div className="esshub-hero-pills">
                        {Object.entries(STATUS_META).map(([s, m]) => (
                            <span key={s} className="esshub-pill" style={{ cursor: 'pointer', outline: filterStatus === s ? `2px solid ${m.color}` : 'none' }}
                                onClick={() => setFilterStatus(filterStatus === s ? '' : s)}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                                {statusLabel(s)} {allCounts[s]}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 16,
                background: 'var(--surface)', borderRadius: 16, padding: 4,
                border: '1px solid var(--border)',
            }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1, padding: '8px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.2s',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ── TEAM TAB ── */}
            {activeTab === 'team' && (
                <>
                    {/* Filter bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                        <Filter size={14} color="var(--text-muted)" />
                        {['', 'pending', 'approved', 'rejected'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                                    background: filterStatus === s ? (STATUS_META[s]?.bg || 'var(--primary)') : 'var(--surface)',
                                    color: filterStatus === s ? (STATUS_META[s]?.color || 'var(--primary)') : 'var(--text-muted)',
                                    boxShadow: filterStatus === s ? `0 0 0 1.5px ${STATUS_META[s]?.color || 'var(--primary)'}` : 'none',
                                }}>
                                {s ? statusLabel(s) : t('All', 'الكل')}
                            </button>
                        ))}
                    </div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>{t('Loading...', 'جاري التحميل...')}</div>
                    ) : requests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                            <CalendarDays size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <p style={{ fontSize: '0.9rem' }}>{t('No leave requests found', 'لا توجد طلبات إجازة')}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {requests.map(req => <LeaveCard key={req.id} req={req} showActions={canApproveAll} />)}
                        </div>
                    )}
                </>
            )}

            {/* ── MY LEAVE TAB ── */}
            {activeTab === 'my' && (
                <>
                    {/* Submit button */}
                    <button onClick={() => setShowRequestModal(true)}
                        style={{
                            width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                            color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                        }}>
                        <Plus size={18} />
                        {isCEO ? t('Post Leave (Auto-Approved)', 'نشر إجازة (تلقائي)') : t('Request Leave', 'طلب إجازة')}
                    </button>

                    {/* My leave history */}
                    {myLeavesLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>{t('Loading...', 'جاري التحميل...')}</div>
                    ) : myLeaves.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                            <CalendarDays size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                            <p style={{ fontSize: '0.85rem' }}>{t('No leave history yet', 'لا يوجد سجل إجازات بعد')}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {myLeaves.map(req => <LeaveCard key={req.id} req={req} showActions={false} />)}
                        </div>
                    )}
                </>
            )}

            {/* ── CEO SCHEDULE TAB ── */}
            {activeTab === 'ceo' && (
                <>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                        background: 'rgba(245,158,11,0.1)', borderRadius: 12, marginBottom: 14,
                        border: '1px solid rgba(245,158,11,0.25)',
                    }}>
                        <Crown size={16} color="#f59e0b" />
                        <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>
                            {t('CEO approved leave schedule — visible to all managers', 'جدول إجازات الرئيس التنفيذي — مرئي لجميع المديرين')}
                        </span>
                    </div>
                    {ceoLeavesLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>{t('Loading...', 'جاري التحميل...')}</div>
                    ) : ceoLeaves.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                            <Crown size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                            <p style={{ fontSize: '0.85rem' }}>{t('No CEO leaves scheduled', 'لا توجد إجازات مجدولة للرئيس')}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {ceoLeaves.map(req => <LeaveCard key={req.id} req={req} showActions={false} />)}
                        </div>
                    )}
                </>
            )}

            {/* ── REQUEST LEAVE MODAL ── */}
            {showRequestModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRequestModal(false)}>
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <CalendarDays size={18} style={{ marginInlineEnd: 8 }} />
                                {isCEO ? t('Post Leave', 'نشر إجازة') : t('Request Leave', 'طلب إجازة')}
                            </h3>
                            <button className="modal-close" onClick={() => setShowRequestModal(false)}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSubmitMyLeave}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
                                {/* Leave type */}
                                <div className="form-group">
                                    <label className="form-label">{t('Leave Type', 'نوع الإجازة')}</label>
                                    <select className="form-control" value={reqForm.leave_type}
                                        onChange={e => setReqForm(f => ({ ...f, leave_type: e.target.value }))}>
                                        {Object.entries(LEAVE_TYPES).map(([k, v]) => (
                                            <option key={k} value={k}>{v[lang] || v.en}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Dates */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div className="form-group">
                                        <label className="form-label">{t('Start Date', 'تاريخ البدء')}</label>
                                        <input type="date" className="form-control" value={reqForm.start_date}
                                            onChange={e => setReqForm(f => ({ ...f, start_date: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('End Date', 'تاريخ الانتهاء')}</label>
                                        <input type="date" className="form-control" value={reqForm.end_date}
                                            onChange={e => setReqForm(f => ({ ...f, end_date: e.target.value }))} required />
                                    </div>
                                </div>
                                {/* Days count */}
                                <div className="form-group">
                                    <label className="form-label">{t('Number of Days', 'عدد الأيام')}</label>
                                    <input type="number" className="form-control" min={1} value={reqForm.days_count}
                                        onChange={e => setReqForm(f => ({ ...f, days_count: parseInt(e.target.value) || 1 }))} required />
                                </div>
                                {/* Reason */}
                                <div className="form-group">
                                    <label className="form-label">{t('Reason (optional)', 'السبب (اختياري)')}</label>
                                    <textarea className="form-control" rows={3} value={reqForm.reason}
                                        onChange={e => setReqForm(f => ({ ...f, reason: e.target.value }))}
                                        placeholder={t('Brief reason for leave...', 'سبب الإجازة باختصار...')} />
                                </div>

                                {!isCEO && (
                                    <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.1)', borderRadius: 10, fontSize: '0.78rem', color: '#d97706' }}>
                                        ℹ️ {t('Your request will be sent to the CEO for approval.', 'سيتم إرسال طلبك إلى الرئيس التنفيذي للموافقة.')}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer" style={{ marginTop: 16 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>
                                    {t('Cancel', 'إلغاء')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}
                                    style={{ background: 'linear-gradient(135deg, var(--primary), #6366f1)' }}>
                                    <CalendarDays size={15} />
                                    {submitting ? t('Submitting...', 'جاري الإرسال...') : isCEO ? t('Post Leave', 'نشر الإجازة') : t('Submit Request', 'إرسال الطلب')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── REJECT MODAL ── */}
            {rejectModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRejectModal(null)}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><XCircle size={18} color="var(--danger)" style={{ marginInlineEnd: 8 }} />{t('Reject Leave Request', 'رفض طلب الإجازة')}</h3>
                            <button className="modal-close" onClick={() => setRejectModal(null)}><X size={18} /></button>
                        </div>
                        <div className="form-group" style={{ padding: '16px 0 0' }}>
                            <label className="form-label">{t('Reason for rejection (optional)', 'سبب الرفض (اختياري)')}</label>
                            <textarea className="form-control" rows={3} value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
                                placeholder={t('Add a note for the employee...', 'أضف ملاحظة للموظف...')} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-danger" onClick={handleReject} disabled={!!actionLoading}>
                                <XCircle size={15} />{t('Confirm Reject', 'تأكيد الرفض')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
