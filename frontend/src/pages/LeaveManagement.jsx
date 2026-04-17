import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, XCircle, Clock, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, autoRejectOldLeaves } from '../services/api';
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
    sick:           { en: 'Sick Leave',      ar: 'إجازة مرضية',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    unpaid:         { en: 'Unpaid Leave',    ar: 'إجازة بدون راتب',    color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
};

const STATUS_META = {
    pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', en: 'Pending',  ar: 'قيد الانتظار' },
    approved: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', en: 'Approved', ar: 'مقبول' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', en: 'Rejected', ar: 'مرفوض' },
};

export default function LeaveManagement() {
    const { fullName, subordinateIds } = useAuth();
    const { lang } = useLanguage();
    const isAr = lang === 'ar';

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const t = (en, ar) => isAr ? ar : en;

    const load = async () => {
        setLoading(true);
        try {
            await autoRejectOldLeaves().catch(() => {});
            const r = await getLeaveRequests({ ...(filterStatus ? { status: filterStatus } : {}), ...(subordinateIds ? { employeeIds: subordinateIds } : {}) });
            setRequests(r.data || []);
        } catch { toast.error(t('Failed to load leave requests', 'فشل تحميل طلبات الإجازة')); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [filterStatus]);

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

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 20 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('Leave Management', 'إدارة الإجازات')}</p>
                    <h2 className="esshub-hero-value">
                        {requests.length}
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

            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Filter size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flex: 1 }}>
                    {t('Filter', 'تصفية')}:
                </span>
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

            {/* Cards list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('Loading...', 'جاري التحميل...')}
                </div>
            ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <CalendarDays size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: '0.9rem' }}>{t('No leave requests found', 'لا توجد طلبات إجازة')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {requests.map(req => {
                        const lt = LEAVE_TYPES[req.leave_type] || LEAVE_TYPES.annual;
                        const sm = STATUS_META[req.status] || STATUS_META.pending;
                        const isExpanded = expandedId === req.id;
                        return (
                            <div key={req.id} style={{
                                background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
                                border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            }}>
                                {/* Card top: click to expand */}
                                <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                                            background: `linear-gradient(135deg, ${lt.color}33, ${lt.color}66)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.1rem', fontWeight: 800, color: lt.color,
                                        }}>
                                            {(req.first_name || '?')[0].toUpperCase()}
                                        </div>
                                        {/* Name + meta */}
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
                                        {/* Days count + chevron */}
                                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lt.color, lineHeight: 1 }}>{req.days_count}</div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t('days', 'أيام')}</div>
                                            <div style={{ marginTop: 4 }}>
                                                {isExpanded ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Period row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 10 }}>
                                        <CalendarDays size={13} color="var(--text-muted)" />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                                            {req.start_date} → {req.end_date}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded details */}
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

                                {/* Action buttons for pending */}
                                {req.status === 'pending' && (
                                    <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                                        <button
                                            onClick={() => handleApprove(req.id)}
                                            disabled={actionLoading === req.id}
                                            style={{
                                                flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                color: '#10b981', fontWeight: 700, fontSize: '0.82rem',
                                                borderRight: isAr ? 'none' : '1px solid var(--border)',
                                                borderLeft: isAr ? '1px solid var(--border)' : 'none',
                                                opacity: actionLoading === req.id ? 0.5 : 1,
                                            }}>
                                            <CheckCircle size={15} />
                                            {t('Approve', 'قبول')}
                                        </button>
                                        <button
                                            onClick={() => { setRejectModal(req.id); setRejectNotes(''); }}
                                            disabled={actionLoading === req.id}
                                            style={{
                                                flex: 1, padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                color: '#ef4444', fontWeight: 700, fontSize: '0.82rem',
                                                opacity: actionLoading === req.id ? 0.5 : 1,
                                            }}>
                                            <XCircle size={15} />
                                            {t('Reject', 'رفض')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reject modal */}
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
