import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, XCircle, Clock, Filter, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest, autoRejectOldLeaves } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const LEAVE_TYPES = {
    annual:         { en: 'Annual Leave',    ar: 'إجازة سنوية',        color: '#4f46e5', bg: 'rgba(79,70,229,0.12)' },
    emergency:      { en: 'Emergency Leave', ar: 'إجازة طارئة',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    exam:           { en: 'Exam Leave',      ar: 'إجازة امتحانات',     color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
    sport:          { en: 'Sport Leave',     ar: 'إجازة رياضية',       color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    national_day:   { en: 'National Day',    ar: 'اليوم الوطني',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    foundation_day: { en: 'Foundation Day',  ar: 'يوم التأسيس',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    eid_fitr:       { en: 'Eid Al-Fitr',     ar: 'عيد الفطر',          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    eid_adha:       { en: 'Eid Al-Adha',     ar: 'عيد الأضحى',         color: '#d97706', bg: 'rgba(217,119,6,0.12)'  },
    // legacy
    sick:           { en: 'Sick Leave',      ar: 'إجازة مرضية',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    unpaid:         { en: 'Unpaid Leave',    ar: 'إجازة بدون راتب',    color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const STATUS_META = {
    pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', en: 'Pending',  ar: 'قيد الانتظار' },
    approved: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', en: 'Approved', ar: 'مقبول' },
    rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', en: 'Rejected', ar: 'مرفوض' },
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

    const t = (en, ar) => isAr ? ar : en;

    const load = async () => {
        setLoading(true);
        try {
            // Auto-reject any pending requests past their 7-day deadline
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
            console.log('APPROVE id:', id, '| type:', typeof id, '| reqData:', reqData);
            console.log('All request ids:', requests.map(r => ({ id: r.id, type: typeof r.id })));
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

    const counts = { pending: 0, approved: 0, rejected: 0 };
    requests.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

    const leaveLabel = (type) => LEAVE_TYPES[type]?.[lang] || type;
    const statusLabel = (s) => STATUS_META[s]?.[lang] || s;

    return (
        <div dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <CalendarDays size={22} style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {t('Leave Management', 'إدارة الإجازات')}
                    </h1>
                    <p className="page-subtitle">{t('Review and manage employee leave requests', 'مراجعة وإدارة طلبات إجازة الموظفين')}</p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="stat-grid" style={{ marginBottom: 20 }}>
                {Object.entries(STATUS_META).map(([status, meta]) => (
                    <div key={status} className="stat-card" style={{ cursor: 'pointer', outline: filterStatus === status ? `2px solid ${meta.color}` : 'none' }}
                        onClick={() => setFilterStatus(filterStatus === status ? '' : status)}>
                        <div className="stat-icon" style={{ background: meta.bg }}>
                            {status === 'pending' ? <Clock size={20} color={meta.color} />
                                : status === 'approved' ? <CheckCircle size={20} color={meta.color} />
                                    : <XCircle size={20} color={meta.color} />}
                        </div>
                        <div className="stat-info">
                            <h3 style={{ color: meta.color }}>{counts[status]}</h3>
                            <p>{statusLabel(status)}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, flex: 1 }}>{t('Leave Requests', 'طلبات الإجازة')}</span>
                    <Filter size={14} color="var(--text-muted)" />
                    <select className="form-control" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">{t('All', 'الكل')}</option>
                        <option value="pending">{t('Pending', 'قيد الانتظار')}</option>
                        <option value="approved">{t('Approved', 'مقبول')}</option>
                        <option value="rejected">{t('Rejected', 'مرفوض')}</option>
                    </select>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Employee', 'الموظف')}</th>
                                <th>{t('Leave Type', 'نوع الإجازة')}</th>
                                <th>{t('Period', 'الفترة')}</th>
                                <th>{t('Days', 'الأيام')}</th>
                                <th>{t('Reason', 'السبب')}</th>
                                <th>{t('Status', 'الحالة')}</th>
                                <th>{t('Reviewed By', 'تمت المراجعة بواسطة')}</th>
                                <th>{t('Actions', 'الإجراءات')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('Loading...', 'جاري التحميل...')}</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan={8}>
                                    <div className="empty-state">
                                        <CalendarDays size={40} />
                                        <p>{t('No leave requests found', 'لا توجد طلبات إجازة')}</p>
                                    </div>
                                </td></tr>
                            ) : requests.map(req => {
                                const lt = LEAVE_TYPES[req.leave_type] || LEAVE_TYPES.annual;
                                const sm = STATUS_META[req.status] || STATUS_META.pending;
                                return (
                                    <tr key={req.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{req.first_name} {req.last_name}</div>
                                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{req.employee_number} · {req.department}</div>
                                        </td>
                                        <td>
                                            <span style={{ background: lt.bg, color: lt.color, fontWeight: 700, fontSize: '0.78rem', borderRadius: 6, padding: '3px 8px' }}>
                                                {leaveLabel(req.leave_type)}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            {req.start_date} → {req.end_date}
                                        </td>
                                        <td style={{ fontWeight: 700, textAlign: 'center' }}>{req.days_count}</td>
                                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                                            {req.reason}
                                        </td>
                                        <td>
                                            <span style={{ background: sm.bg, color: sm.color, fontWeight: 700, fontSize: '0.78rem', borderRadius: 6, padding: '3px 8px' }}>
                                                {statusLabel(req.status)}
                                            </span>
                                            {req.reviewer_notes && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{req.reviewer_notes}</div>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            {req.reviewed_by || '—'}
                                            {req.reviewed_at && <div style={{ fontSize: '0.7rem' }}>{req.reviewed_at.slice(0, 10)}</div>}
                                        </td>
                                        <td>
                                            {req.status === 'pending' && (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleApprove(req.id)}
                                                        disabled={actionLoading === req.id}
                                                    >
                                                        <CheckCircle size={13} />
                                                        {t('Approve', 'قبول')}
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => { setRejectModal(req.id); setRejectNotes(''); }}
                                                        disabled={actionLoading === req.id}
                                                    >
                                                        <XCircle size={13} />
                                                        {t('Reject', 'رفض')}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

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
