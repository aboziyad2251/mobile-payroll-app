import React, { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAttendance, getEmployees, markAttendance, checkIn, updateAttendance } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
    present:         { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    absent:          { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    in_assignment:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)' },
    excused:         { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
    annual_leave:    { color: '#4f46e5', bg: 'rgba(79,70,229,0.15)' },
    sick_leave:      { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    emergency_leave: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

export default function Attendance() {
    const { t, lang } = useLanguage();
    const isAr = lang === 'ar';
    const { subordinateIds } = useAuth();

    const STATUS_OPTIONS = [
        { value: 'present',          label: t('att.present'),        deducts: false },
        { value: 'absent',           label: t('att.absent'),         deducts: true  },
        { value: 'in_assignment',    label: isAr ? 'في مهمة' : 'In Assignment', deducts: false },
        { value: 'excused',          label: t('att.excused'),        deducts: false },
        { value: 'annual_leave',     label: t('att.annualLeave'),    deducts: false },
        { value: 'sick_leave',       label: t('att.sickLeave'),      deducts: false },
        { value: 'emergency_leave',  label: t('att.emergencyLeave'), deducts: false },
    ];
    const statusInfo = (s) => STATUS_OPTIONS.find(o => o.value === s) || { label: s };
    const statusMeta = (s) => STATUS_COLORS[s] || { color: '#64748b', bg: 'rgba(100,116,139,0.15)' };

    const [records, setRecords] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [markModal, setMarkModal] = useState({ open: false, emp: null });
    const [markForm, setMarkForm] = useState({ status: 'present', check_in: '08:00', check_out: '16:00', break_start: '12:00', break_end: '12:40', notes: '' });
    const [checkinModal, setCheckinModal] = useState({ open: false });
    const [checkinForm, setCheckinForm] = useState({ employee_id: '', check_in: '', notes: '' });
    const [expandedId, setExpandedId] = useState(null);

    const load = () => {
        setLoading(true);
        getAttendance({ date }).then(r => setRecords(r.data)).catch(() => { }).finally(() => setLoading(false));
    };
    useEffect(load, [date]);
    useEffect(() => { getEmployees({ status: 'active', ids: subordinateIds }).then(r => setEmployees(r.data)).catch(() => { }); }, [subordinateIds]);

    const checkedIds = new Set(records.map(r => r.employee_id));
    const uncheckedEmployees = employees.filter(e => !checkedIds.has(e.id));

    const openMark = (rec) => {
        setMarkForm({
            status: rec.status || 'present',
            check_in: rec.check_in || '08:00',
            check_out: rec.check_out || '16:00',
            break_start: rec.break_start || '12:00',
            break_end: rec.break_end || '12:40',
            notes: rec.notes || ''
        });
        setMarkModal({ open: true, rec });
    };

    const submitMark = async (e) => {
        e.preventDefault();
        const { rec } = markModal;
        const needsTimes = markForm.status === 'present' || markForm.status === 'in_assignment';
        const payload = {
            status: markForm.status,
            check_in: needsTimes ? (markForm.check_in || null) : null,
            check_out: needsTimes ? (markForm.check_out || null) : null,
            break_start: needsTimes ? (markForm.break_start || null) : null,
            break_end: needsTimes ? (markForm.break_end || null) : null,
            notes: markForm.notes || null,
        };
        try {
            if (rec.id) { await updateAttendance(rec.id, payload); }
            else { await markAttendance({ employee_id: rec.employee_id, date, ...payload }); }
            toast.success(t('att.successUpdate'));
            setMarkModal({ open: false });
            load();
        } catch (err) { toast.error(err?.message || t('att.errorUpdate')); }
    };

    const submitCheckin = async (e) => {
        e.preventDefault();
        try {
            await checkIn({ ...checkinForm, date });
            toast.success(t('att.successCheckin'));
            setCheckinModal({ open: false });
            load();
        } catch { toast.error(t('att.errorCheckin')); }
    };

    const totalPresent = records.filter(r => r.status === 'present').length;
    const totalAbsent = records.filter(r => r.status === 'absent').length;
    const totalLeave = records.filter(r => ['annual_leave', 'sick_leave', 'emergency_leave'].includes(r.status)).length;

    const allRows = [...records, ...uncheckedEmployees.map(e => ({
        employee_id: e.id, first_name: e.first_name, last_name: e.last_name,
        employee_number: e.employee_number, department: e.department, status: null
    }))];

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 20 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('att.title')}</p>
                    <h2 className="esshub-hero-value">
                        {allRows.length}
                        <span className="esshub-hero-unit"> {isAr ? 'موظف' : 'Employees'}</span>
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <input
                            type="date" value={date} onChange={e => setDate(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 10, padding: '6px 10px', color: 'white', fontSize: '0.8rem',
                                outline: 'none', cursor: 'pointer',
                            }}
                        />
                        <button onClick={() => setCheckinModal({ open: true })}
                            style={{
                                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: 10, padding: '6px 12px', color: 'white', fontSize: '0.78rem',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                            <LogIn size={13} />
                            {t('att.checkIn')}
                        </button>
                    </div>
                    <div className="esshub-hero-pills" style={{ marginTop: 10 }}>
                        {[
                            { label: isAr ? 'حاضر' : 'Present', count: totalPresent, dot: '#34d399' },
                            { label: isAr ? 'غائب' : 'Absent', count: totalAbsent, dot: '#f87171' },
                            { label: isAr ? 'إجازة' : 'Leave', count: totalLeave, dot: '#60a5fa' },
                            { label: isAr ? 'غير محدد' : 'Unmarked', count: uncheckedEmployees.length, dot: '#94a3b8' },
                        ].map(({ label, count, dot }) => (
                            <span key={label} className="esshub-pill">
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                                {label} {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cards list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('common.loading')}
                </div>
            ) : allRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <Calendar size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: '0.9rem' }}>{isAr ? 'لا توجد سجلات' : 'No records found'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {allRows.map((rec) => {
                        const si = statusInfo(rec.status);
                        const sm = statusMeta(rec.status);
                        const isExpanded = expandedId === (rec.id || `unm-${rec.employee_id}`);
                        const rowKey = rec.id || `unm-${rec.employee_id}`;
                        const unmarked = !rec.status;

                        return (
                            <div key={rowKey} style={{
                                background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
                                border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                            }}>
                                <div style={{ padding: '12px 14px', cursor: 'pointer' }}
                                    onClick={() => setExpandedId(isExpanded ? null : rowKey)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                                            background: unmarked ? 'rgba(100,116,139,0.15)' : sm.bg,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', fontWeight: 800, color: unmarked ? '#64748b' : sm.color,
                                        }}>
                                            {(rec.first_name || '?')[0].toUpperCase()}
                                        </div>
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                                {rec.first_name} {rec.last_name}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {rec.employee_number}{rec.department ? ` · ${rec.department}` : ''}
                                            </div>
                                        </div>
                                        {/* Status badge */}
                                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                            <span style={{
                                                background: unmarked ? 'rgba(100,116,139,0.15)' : sm.bg,
                                                color: unmarked ? '#94a3b8' : sm.color,
                                                fontSize: '0.68rem', fontWeight: 700, borderRadius: 8, padding: '3px 8px',
                                                display: 'block', marginBottom: 4,
                                            }}>
                                                {unmarked ? t('att.notMarked') : si.label}
                                            </span>
                                            {isExpanded ? <ChevronUp size={13} color="var(--text-dim)" /> : <ChevronDown size={13} color="var(--text-dim)" />}
                                        </div>
                                    </div>

                                    {/* Times row for present/in_assignment */}
                                    {rec.check_in && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            {[
                                                { icon: '🟢', label: isAr ? 'دخول' : 'In', val: rec.check_in },
                                                { icon: '🔴', label: isAr ? 'خروج' : 'Out', val: rec.check_out || '—' },
                                                rec.overtime_minutes > 0 && { icon: '⏱', label: 'OT', val: `${Math.round(rec.overtime_minutes / 60 * 10) / 10}h` },
                                            ].filter(Boolean).map(({ icon, label, val }) => (
                                                <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '4px 8px', fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span>{icon}</span><span style={{ color: 'var(--text)' }}>{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Expanded: notes */}
                                {isExpanded && rec.notes && (
                                    <div style={{ padding: '0 14px 10px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg2)', borderRadius: 8 }}>
                                            {rec.notes}
                                        </div>
                                    </div>
                                )}

                                {/* Mark button */}
                                <div style={{ borderTop: '1px solid var(--border)' }}>
                                    <button
                                        onClick={() => openMark(rec)}
                                        style={{
                                            width: '100%', padding: '10px', border: 'none', background: 'transparent',
                                            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                                            color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}>
                                        <Clock size={13} />
                                        {rec.id ? t('att.mark') : (isAr ? 'تسجيل الحضور' : 'Mark Attendance')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Mark modal */}
            {markModal.open && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMarkModal({ open: false })}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="modal-title">{t('att.markAttendance')} — {markModal.rec?.first_name} {markModal.rec?.last_name}</h2>
                            <button className="modal-close" onClick={() => setMarkModal({ open: false })}>✕</button>
                        </div>
                        <form onSubmit={submitMark}>
                            <div className="form-group">
                                <label className="form-label">{t('common.status')}</label>
                                <select className="form-control" value={markForm.status} onChange={e => setMarkForm(f => ({ ...f, status: e.target.value }))}>
                                    {STATUS_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}{o.deducts ? (isAr ? ' ← يخصم يوم' : ' ← deducts 1 day') : ''}
                                        </option>
                                    ))}
                                </select>
                                {STATUS_OPTIONS.find(o => o.value === markForm.status)?.deducts && (
                                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>
                                        ⚠ {isAr ? 'سيتم خصم يوم من الراتب' : 'This will deduct 1 day from salary'}
                                    </div>
                                )}
                            </div>
                            {(markForm.status === 'present' || markForm.status === 'in_assignment') && <>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">{t('att.checkIn')}</label>
                                        <input className="form-control" type="time" value={markForm.check_in} onChange={e => setMarkForm(f => ({ ...f, check_in: e.target.value }))} /></div>
                                    <div className="form-group"><label className="form-label">{t('att.checkOut')}</label>
                                        <input className="form-control" type="time" value={markForm.check_out} onChange={e => setMarkForm(f => ({ ...f, check_out: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">{t('att.breakStart')}</label>
                                        <input className="form-control" type="time" value={markForm.break_start} onChange={e => setMarkForm(f => ({ ...f, break_start: e.target.value }))} /></div>
                                    <div className="form-group"><label className="form-label">{t('att.breakEnd')}</label>
                                        <input className="form-control" type="time" value={markForm.break_end} onChange={e => setMarkForm(f => ({ ...f, break_end: e.target.value }))} /></div>
                                </div>
                            </>}
                            <div className="form-group"><label className="form-label">{t('common.notes')}</label>
                                <textarea className="form-control" rows={2} value={markForm.notes} onChange={e => setMarkForm(f => ({ ...f, notes: e.target.value }))} /></div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setMarkModal({ open: false })}>{t('common.cancel')}</button>
                                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Check-in modal */}
            {checkinModal.open && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCheckinModal({ open: false })}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="modal-title"><LogIn size={18} /> {t('att.employeeCheckIn')}</h2>
                            <button className="modal-close" onClick={() => setCheckinModal({ open: false })}>✕</button>
                        </div>
                        <form onSubmit={submitCheckin}>
                            <div className="form-group"><label className="form-label">{t('common.employee')} *</label>
                                <select className="form-control" required value={checkinForm.employee_id} onChange={e => setCheckinForm(f => ({ ...f, employee_id: e.target.value }))}>
                                    <option value="">{t('att.selectEmployee')}</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label className="form-label">{t('att.checkInTime')} *</label>
                                <input className="form-control" type="time" required value={checkinForm.check_in} onChange={e => setCheckinForm(f => ({ ...f, check_in: e.target.value }))} /></div>
                            <div className="form-group"><label className="form-label">{t('common.notes')}</label>
                                <input className="form-control" value={checkinForm.notes} onChange={e => setCheckinForm(f => ({ ...f, notes: e.target.value }))} /></div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setCheckinModal({ open: false })}>{t('common.cancel')}</button>
                                <button type="submit" className="btn btn-success"><LogIn size={15} />{t('att.checkIn')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
