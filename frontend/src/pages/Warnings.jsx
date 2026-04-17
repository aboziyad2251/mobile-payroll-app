import React, { useEffect, useState } from 'react';
import { AlertTriangle, Plus, FileText, Award, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWarnings, getEmployees, createWarning, getNextWarningType, generateWarningPDF, deleteWarning } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function Warnings() {
    const { t, lang } = useLanguage();
    const isAr = lang === 'ar';
    const { subordinateIds } = useAuth();

    const TYPE_META = {
        first:       { label: t('warn.first'),       color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  grad: 'linear-gradient(135deg,#92400e,#f59e0b)' },
        second:      { label: t('warn.second'),      color: '#e97316', bg: 'rgba(233,115,22,0.15)',  grad: 'linear-gradient(135deg,#7c2d12,#ea580c)' },
        third:       { label: t('warn.third'),       color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   grad: 'linear-gradient(135deg,#7f1d1d,#dc2626)' },
        final:       { label: t('warn.final'),       color: '#b91c1c', bg: 'rgba(185,28,28,0.15)',   grad: 'linear-gradient(135deg,#450a0a,#991b1b)' },
        recognition: { label: t('warn.recognition'), color: '#10b981', bg: 'rgba(16,185,129,0.15)', grad: 'linear-gradient(135deg,#065f46,#10b981)' },
    };

    const [warnings, setWarnings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [filterType, setFilterType] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ employee_id: '', warning_type: '', reason: '', details: '', issued_by: 'HR Manager', issued_date: new Date().toISOString().split('T')[0] });
    const [nextType, setNextType] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

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
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 20 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('warn.title')}</p>
                    <h2 className="esshub-hero-value">
                        {warnings.length}
                        <span className="esshub-hero-unit"> {isAr ? 'سجل' : 'Records'}</span>
                    </h2>
                    <button onClick={() => setShowModal(true)} style={{
                        marginTop: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                        borderRadius: 10, padding: '6px 14px', color: 'white', fontSize: '0.8rem',
                        fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                        <Plus size={14} />
                        {t('warn.issueWarning')}
                    </button>
                </div>
            </div>

            {/* Type stats strip */}
            <div className="esshub-stats-strip" style={{ marginBottom: 16 }}>
                {Object.entries(TYPE_META).map(([type, meta]) => (
                    <div key={type} className="esshub-stat-chip"
                        style={{ '--chip-color': meta.color, cursor: 'pointer', outline: filterType === type ? `2px solid ${meta.color}` : 'none' }}
                        onClick={() => setFilterType(filterType === type ? '' : type)}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: meta.color }}>{counts[type]}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.3 }}>{meta.label}</span>
                    </div>
                ))}
            </div>

            {/* Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('common.loading')}</div>
            ) : warnings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <AlertTriangle size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: '0.9rem' }}>{t('warn.noFound')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {warnings.map(w => {
                        const tm = TYPE_META[w.warning_type] || TYPE_META.first;
                        const isExpanded = expandedId === w.id;
                        return (
                            <div key={w.id} style={{
                                background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
                                border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                            }}>
                                <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : w.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {/* Icon avatar */}
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                                            background: tm.grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                        }}>
                                            {w.warning_type === 'recognition'
                                                ? <Award size={20} color="white" />
                                                : <AlertTriangle size={20} color="white" />}
                                        </div>
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                {w.first_name} {w.last_name}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                {w.employee_number}{w.department ? ` · ${w.department}` : ''}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={{ background: tm.bg, color: tm.color, fontSize: '0.68rem', fontWeight: 700, borderRadius: 8, padding: '2px 8px' }}>
                                                    {tm.label}
                                                </span>
                                                <span style={{
                                                    background: w.acknowledged ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                                    color: w.acknowledged ? '#10b981' : '#f59e0b',
                                                    fontSize: '0.68rem', fontWeight: 700, borderRadius: 8, padding: '2px 8px'
                                                }}>
                                                    {w.acknowledged ? t('warn.acknowledged') : t('warn.pending')}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Date + chevron */}
                                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{w.issued_date}</div>
                                            <div style={{ marginTop: 4 }}>
                                                {isExpanded ? <ChevronUp size={13} color="var(--text-dim)" /> : <ChevronDown size={13} color="var(--text-dim)" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reason preview */}
                                    <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--bg2)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                                        {w.reason}
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && w.details && (
                                    <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                                                {t('warn.details')}
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{w.details}</div>
                                        </div>
                                        <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                            {isAr ? 'صادر من' : 'Issued by'}: <span style={{ color: 'var(--text-muted)' }}>{w.issued_by}</span>
                                            {w.warning_number && <> · #{w.warning_number}</>}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ borderTop: '1px solid var(--border)', display: 'flex' }}>
                                    <button
                                        onClick={() => handlePDF(w)}
                                        disabled={generatingPdf === w.id}
                                        style={{
                                            flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                            color: 'var(--primary)', fontWeight: 700, fontSize: '0.78rem',
                                            borderRight: isAr ? 'none' : '1px solid var(--border)',
                                            borderLeft: isAr ? '1px solid var(--border)' : 'none',
                                            opacity: generatingPdf === w.id ? 0.5 : 1,
                                        }}>
                                        <FileText size={13} />
                                        {generatingPdf === w.id ? '…' : t('common.pdf')}
                                    </button>
                                    <button onClick={() => handleDelete(w)} style={{
                                        flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        color: '#ef4444', fontWeight: 700, fontSize: '0.78rem',
                                    }}>
                                        <Trash2 size={13} />
                                        {t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Issue Warning Modal */}
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
