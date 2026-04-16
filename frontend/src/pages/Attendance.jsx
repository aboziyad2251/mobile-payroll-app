import React, { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAttendance, getEmployees, markAttendance, checkIn, updateAttendance } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function Attendance() {
    const { t, lang } = useLanguage();
    const isAr = lang === 'ar';
    const { subordinateIds } = useAuth();

    const STATUS_OPTIONS = [
        { value: 'present',          label: t('att.present'),        cls: 'badge-present',   deducts: false },
        { value: 'absent',           label: t('att.absent'),         cls: 'badge-absent',    deducts: true  },
        { value: 'in_assignment',    label: isAr ? 'في مهمة' : 'In Assignment', cls: 'badge-info', deducts: false },
        { value: 'excused',          label: t('att.excused'),        cls: 'badge-excused',   deducts: false },
        { value: 'annual_leave',     label: t('att.annualLeave'),    cls: 'badge-annual',    deducts: false },
        { value: 'sick_leave',       label: t('att.sickLeave'),      cls: 'badge-sick',      deducts: false },
        { value: 'emergency_leave',  label: t('att.emergencyLeave'), cls: 'badge-emergency', deducts: false },
    ];
    const statusInfo = (s) => STATUS_OPTIONS.find(o => o.value === s) || { label: s, cls: 'badge-info' };

    const [records, setRecords] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [markModal, setMarkModal] = useState({ open: false, emp: null });
    const [markForm, setMarkForm] = useState({ status: 'present', check_in: '08:00', check_out: '16:00', break_start: '12:00', break_end: '12:40', notes: '' });
    const [checkinModal, setCheckinModal] = useState({ open: false });
    const [checkinForm, setCheckinForm] = useState({ employee_id: '', check_in: '', notes: '' });

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
        // For non-present statuses, clear time fields
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

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('att.title')}</h1>
                    <p className="page-subtitle">{t('att.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
                    <button className="btn btn-primary" onClick={() => setCheckinModal({ open: true })}><LogIn size={16} />{t('att.checkIn')}</button>
                </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: 20 }}>
                {[
                    { label: t('att.present'), value: totalPresent, color: '#10b981', icon: CheckCircle },
                    { label: t('att.absent'), value: totalAbsent, color: '#ef4444', icon: XCircle },
                    { label: t('dash.onLeave'), value: totalLeave, color: '#f59e0b', icon: Calendar },
                    { label: t('att.notMarked'), value: uncheckedEmployees.length, color: '#64748b', icon: Clock },
                ].map(({ label, value, color, icon: Icon }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-icon" style={{ background: `${color}22` }}><Icon size={20} color={color} /></div>
                        <div className="stat-info"><h3 style={{ color }}>{value}</h3><p>{label}</p></div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>{t('att.title')} — {date}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{records.length} {t('att.records')}</span>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>{t('common.employee')}</th><th>{t('common.status')}</th><th>{t('att.checkIn')}</th>
                            <th>{t('att.breakTime')}</th><th>{t('att.checkOut')}</th><th>{t('att.overtime')}</th>
                            <th>{t('common.notes')}</th><th>{t('common.actions')}</th>
                        </tr></thead>
                        <tbody>
                            {loading
                                ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                                : [...records, ...uncheckedEmployees.map(e => ({ employee_id: e.id, first_name: e.first_name, last_name: e.last_name, employee_number: e.employee_number, department: e.department, status: null }))].map((rec, i) => {
                                    const si = statusInfo(rec.status);
                                    return (
                                        <tr key={rec.id || `unm-${rec.employee_id}`}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{rec.first_name} {rec.last_name}</div>
                                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{rec.employee_number} · {rec.department}</div>
                                            </td>
                                            <td>
                                                {rec.status
                                                    ? <span className={`badge ${si.cls}`}>{si.label}</span>
                                                    : <span className="badge" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>{t('att.notMarked')}</span>
                                                }
                                            </td>
                                            <td>{rec.check_in || '—'}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {rec.break_start ? `${rec.break_start}–${rec.break_end || '?'} (${rec.total_break_minutes || 0}m)` : '—'}
                                            </td>
                                            <td>{rec.check_out || '—'}</td>
                                            <td>{rec.overtime_minutes > 0 ? <span className="badge badge-info">{Math.round(rec.overtime_minutes / 60 * 10) / 10}h</span> : '—'}</td>
                                            <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{rec.notes || '—'}</td>
                                            <td><button className="btn btn-sm btn-secondary" onClick={() => openMark(rec)}>{t('att.mark')}</button></td>
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </table>
                </div>
            </div>

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
