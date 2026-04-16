import React, { useEffect, useState } from 'react';
import { AlertTriangle, Plus, FileText, Award, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWarnings, getEmployees, createWarning, getNextWarningType, generateWarningPDF, deleteWarning } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function Warnings() {
    const { t } = useLanguage();
    const { subordinateIds } = useAuth();

    const TYPE_META = {
        first: { label: t('warn.first'), cls: 'badge-warning', color: '#f59e0b' },
        second: { label: t('warn.second'), cls: 'badge-warning', color: '#e97316' },
        third: { label: t('warn.third'), cls: 'badge-danger', color: '#ef4444' },
        final: { label: t('warn.final'), cls: 'badge-danger', color: '#b91c1c' },
        recognition: { label: t('warn.recognition'), cls: 'badge-success', color: '#10b981' },
    };

    const [warnings, setWarnings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [filterType, setFilterType] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ employee_id: '', warning_type: '', reason: '', details: '', issued_by: 'HR Manager', issued_date: new Date().toISOString().split('T')[0] });
    const [nextType, setNextType] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(null);

    const load = () => {
        getWarnings(filterType ? { warning_type: filterType } : {})
            .then(r => setWarnings(r.data)).catch(() => { }).finally(() => setLoading(false));
    };
    useEffect(load, [filterType]);
    useEffect(() => { getEmployees({ status: 'active', ids: subordinateIds }).then(r => setEmployees(r.data)).catch(() => { }); }, [subordinateIds]);

    const onSelectEmployee = async (empId) => {
        setForm(f => ({ ...f, employee_id: empId, warning_type: '' }));
        if (empId) {
            const r = await getNextWarningType(empId);
            setNextType(r.data);
            setForm(f => ({ ...f, warning_type: r.data.next_type }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createWarning(form);
            toast.success(t('warn.successIssue'));
            setShowModal(false); setNextType(null); load();
        } catch { toast.error(t('warn.errorIssue')); }
    };

    const handlePDF = async (w) => {
        setGeneratingPdf(w.id);
        try {
            await generateWarningPDF(w.id, w);
            toast.success(t('warn.successPDF'));
        } catch { toast.error(t('warn.errorPDF')); }
        finally { setGeneratingPdf(null); }
    };

    const handleDelete = async (w) => {
        if (!window.confirm(t('warn.deleteConfirm'))) return;
        try { await deleteWarning(w.id); toast.success(t('common.delete')); load(); }
        catch { toast.error('Error'); }
    };

    const counts = { first: 0, second: 0, third: 0, final: 0, recognition: 0 };
    warnings.forEach(w => { if (counts[w.warning_type] !== undefined) counts[w.warning_type]++; });

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('warn.title')}</h1>
                    <p className="page-subtitle">{t('warn.subtitle')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} />{t('warn.issueWarning')}</button>
            </div>

            <div className="stat-grid" style={{ marginBottom: 20 }}>
                {Object.entries(TYPE_META).map(([type, meta]) => (
                    <div className="stat-card" key={type} style={{ cursor: 'pointer' }} onClick={() => setFilterType(filterType === type ? '' : type)}>
                        <div className="stat-icon" style={{ background: `${meta.color}22` }}>
                            {type === 'recognition' ? <Award size={20} color={meta.color} /> : <AlertTriangle size={20} color={meta.color} />}
                        </div>
                        <div className="stat-info">
                            <h3 style={{ color: meta.color }}>{counts[type]}</h3>
                            <p>{meta.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, flex: 1 }}>{t('warn.history')}</span>
                    <select className="form-control" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="">{t('warn.allTypes')}</option>
                        {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                    </select>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>{t('common.employee')}</th><th>{t('warn.type')}</th><th>{t('warn.number')}</th>
                            <th>{t('warn.reason')}</th><th>{t('warn.issuedBy')}</th><th>{t('common.date')}</th>
                            <th>{t('common.status')}</th><th>{t('common.actions')}</th>
                        </tr></thead>
                        <tbody>
                            {loading
                                ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                                : warnings.length === 0
                                    ? <tr><td colSpan={8}><div className="empty-state"><AlertTriangle size={40} /><p>{t('warn.noFound')}</p></div></td></tr>
                                    : warnings.map(w => {
                                        const tm = TYPE_META[w.warning_type] || { label: w.warning_type, cls: 'badge-info' };
                                        return (
                                            <tr key={w.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{w.first_name} {w.last_name}</div>
                                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{w.employee_number} · {w.department}</div>
                                                </td>
                                                <td><span className={`badge ${tm.cls}`}>{tm.label}</span></td>
                                                <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{w.warning_number || '—'}</td>
                                                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.reason}</td>
                                                <td>{w.issued_by}</td>
                                                <td>{w.issued_date}</td>
                                                <td>{w.acknowledged ? <span className="badge badge-success">{t('warn.acknowledged')}</span> : <span className="badge badge-warning">{t('warn.pending')}</span>}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => handlePDF(w)} disabled={generatingPdf === w.id}>
                                                            <FileText size={13} />{generatingPdf === w.id ? '…' : t('common.pdf')}
                                                        </button>
                                                        <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(w)}><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                            }
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="modal-title"><AlertTriangle size={18} /> {t('warn.issueWarning')}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group"><label className="form-label">{t('common.employee')} *</label>
                                <select className="form-control" required value={form.employee_id} onChange={e => onSelectEmployee(e.target.value)}>
                                    <option value="">{t('att.selectEmployee')}</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>)}
                                </select>
                            </div>
                            {nextType && (
                                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', color: '#fbbf24' }}>
                                    ⚠️ {t('warn.previousWarnings').replace('{count}', nextType.total_issued)} <strong>{TYPE_META[nextType.next_type]?.label}</strong>
                                </div>
                            )}
                            <div className="form-group"><label className="form-label">{t('warn.warningType')} *</label>
                                <select className="form-control" required value={form.warning_type} onChange={e => setForm(f => ({ ...f, warning_type: e.target.value }))}>
                                    <option value="">{t('warn.selectType')}</option>
                                    {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label className="form-label">{t('warn.reason')} *</label>
                                <input className="form-control" required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('warn.reasonPlaceholder')} /></div>
                            <div className="form-group"><label className="form-label">{t('warn.details')}</label>
                                <textarea className="form-control" rows={3} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} placeholder={t('warn.detailsPlaceholder')} /></div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('warn.issuedBy')}</label>
                                    <input className="form-control" value={form.issued_by} onChange={e => setForm(f => ({ ...f, issued_by: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">{t('common.date')}</label>
                                    <input className="form-control" type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="btn btn-danger"><AlertTriangle size={15} />{t('warn.issueWarning')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
