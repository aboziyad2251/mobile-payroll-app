import React, { useEffect, useState } from 'react';
import { TrendingUp, Calculator, Target, Plus, X, ChevronDown, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getRankings, calculatePerformance, getObjectives, createObjective, deleteObjective, createKeyResult, updateKeyResult, deleteKeyResult } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const getRatingClass = (r) => ({
    Excellent: 'badge-excellent', Good: 'badge-good', Average: 'badge-average',
    'Needs Improvement': 'badge-poor', Poor: 'badge-poor'
}[r] || 'badge-info');

const getScoreClass = (s) => s >= 90 ? 'score-excellent' : s >= 75 ? 'score-good' : s >= 60 ? 'score-average' : 'score-poor';

const STATUS_META = {
    on_track: { en: 'On Track', ar: 'في المسار', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    at_risk:  { en: 'At Risk',  ar: 'في خطر',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    behind:   { en: 'Behind',   ar: 'متأخر',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    completed:{ en: 'Done',     ar: 'مكتمل',      color: '#4f46e5', bg: 'rgba(79,70,229,0.12)' },
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const EMPTY_OBJ = { title: '', description: '', quarter: 'Q2', year: new Date().getFullYear(), status: 'on_track' };
const EMPTY_KR  = { title: '', target_value: '', current_value: '', unit: '', due_date: '', status: 'on_track' };

export default function Performance() {
    const { t, lang } = useLanguage();
    const { subordinateIds, role } = useAuth();
    const isAr = lang === 'ar';
    const tl = (en, ar) => isAr ? ar : en;

    const [tab, setTab] = useState('rankings');
    const [rankings, setRankings] = useState([]);
    const [period, setPeriod] = useState('monthly');
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    // OKR state
    const [objectives, setObjectives] = useState([]);
    const [okrLoading, setOkrLoading] = useState(false);
    const [objModal, setObjModal] = useState(false);
    const [objForm, setObjForm] = useState(EMPTY_OBJ);
    const [krModal, setKrModal]   = useState(null); // objective id
    const [krForm, setKrForm]     = useState(EMPTY_KR);
    const [expandedObj, setExpandedObj] = useState({});
    const [okrQuarter, setOkrQuarter]   = useState('Q2');
    const [okrYear, setOkrYear]         = useState(now.getFullYear());

    const loadRankings = () => {
        setLoading(true);
        getRankings({ period, month, year, employeeIds: subordinateIds })
            .then(r => setRankings(r.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    const loadOKRs = async () => {
        setOkrLoading(true);
        try {
            const r = await getObjectives({ quarter: okrQuarter, year: okrYear });
            setObjectives(r.data || []);
        } catch (e) { toast.error(e.message); }
        finally { setOkrLoading(false); }
    };

    useEffect(loadRankings, [period, month, year]);
    useEffect(() => { if (tab === 'okr') loadOKRs(); }, [tab, okrQuarter, okrYear]);

    const handleCalculate = async () => {
        setCalculating(true);
        const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        try {
            await calculatePerformance({ period, period_start: periodStart, period_end: periodEnd });
            toast.success(t('perf.successCalc'));
            loadRankings();
        } catch { toast.error(t('perf.errorCalc')); }
        finally { setCalculating(false); }
    };

    const handleCreateObj = async () => {
        if (!objForm.title) return toast.error(tl('Title required', 'العنوان مطلوب'));
        try {
            await createObjective({ ...objForm, year: okrYear, quarter: okrQuarter });
            toast.success(tl('Objective created', 'تم إنشاء الهدف'));
            setObjModal(false); setObjForm(EMPTY_OBJ);
            loadOKRs();
        } catch (e) { toast.error(e.message); }
    };

    const handleDeleteObj = async (id) => {
        if (!window.confirm(tl('Delete this objective?', 'حذف هذا الهدف؟'))) return;
        try { await deleteObjective(id); toast.success(tl('Deleted', 'تم الحذف')); loadOKRs(); }
        catch (e) { toast.error(e.message); }
    };

    const handleCreateKR = async () => {
        if (!krForm.title) return toast.error(tl('Title required', 'العنوان مطلوب'));
        try {
            await createKeyResult({ ...krForm, objective_id: krModal, target_value: Number(krForm.target_value) || 0, current_value: Number(krForm.current_value) || 0 });
            toast.success(tl('Key result added', 'تمت إضافة النتيجة الرئيسية'));
            setKrModal(null); setKrForm(EMPTY_KR);
            loadOKRs();
        } catch (e) { toast.error(e.message); }
    };

    const handleUpdateKR = async (id, updates) => {
        try { await updateKeyResult(id, updates); loadOKRs(); }
        catch (e) { toast.error(e.message); }
    };

    const handleDeleteKR = async (id) => {
        try { await deleteKeyResult(id); loadOKRs(); }
        catch (e) { toast.error(e.message); }
    };

    const topScore = rankings[0]?.total_score || 0;
    const avgScore = rankings.length ? rankings.reduce((s, r) => s + r.total_score, 0) / rankings.length : 0;
    const excellent = rankings.filter(r => r.total_score >= 90).length;
    const locale = isAr ? 'ar-SA' : 'en-US';

    const krProgress = (kr) => kr.target_value > 0 ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100)) : 0;
    const objProgress = (obj) => {
        if (!obj.key_results?.length) return 0;
        return Math.round(obj.key_results.reduce((s, kr) => s + krProgress(kr), 0) / obj.key_results.length);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('perf.title')}</h1>
                    <p className="page-subtitle">{t('perf.subtitle')}</p>
                </div>
                {tab === 'rankings' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <select className="form-control" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
                            <option value="daily">{t('perf.daily')}</option>
                            <option value="weekly">{t('perf.weekly')}</option>
                            <option value="monthly">{t('perf.monthly')}</option>
                        </select>
                        <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString(locale, { month: 'long' })}</option>)}
                        </select>
                        <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(Number(e.target.value))}>
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {role === 'admin' && (
                            <button className="btn btn-primary" onClick={handleCalculate} disabled={calculating}>
                                <Calculator size={15} />{calculating ? t('perf.calculating') : t('perf.calculate')}
                            </button>
                        )}
                    </div>
                )}
                {tab === 'okr' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <select className="form-control" style={{ width: 'auto' }} value={okrQuarter} onChange={e => setOkrQuarter(e.target.value)}>
                            {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                        <select className="form-control" style={{ width: 'auto' }} value={okrYear} onChange={e => setOkrYear(Number(e.target.value))}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={() => { setObjForm({ ...EMPTY_OBJ, quarter: okrQuarter, year: okrYear }); setObjModal(true); }}>
                            <Plus size={15} /> {tl('Add Objective', 'إضافة هدف')}
                        </button>
                    </div>
                )}
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {[{ id: 'rankings', label: t('perf.title'), icon: TrendingUp }, { id: 'okr', label: tl('OKR Goals', 'أهداف OKR'), icon: Target }].map(({ id, label, icon: Icon }) => (
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

            {/* ── RANKINGS TAB ── */}
            {tab === 'rankings' && (
                <>
                    <div className="stat-grid" style={{ marginBottom: 20 }}>
                        {[
                            { label: t('perf.ranked'), value: rankings.length, color: '#4f46e5' },
                            { label: t('perf.highest'), value: `${topScore.toFixed(1)}%`, color: '#10b981' },
                            { label: t('perf.average'), value: `${avgScore.toFixed(1)}%`, color: '#0ea5e9' },
                            { label: t('perf.excellent'), value: excellent, color: '#f59e0b' },
                        ].map(({ label, value, color }) => (
                            <div className="stat-card" key={label}>
                                <div className="stat-icon" style={{ background: `${color}22` }}><TrendingUp size={20} color={color} /></div>
                                <div className="stat-info"><h3 style={{ color }}>{value}</h3><p>{label}</p></div>
                            </div>
                        ))}
                    </div>

                    <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('perf.scoringFormula')}</span>
                            {[{ label: t('perf.att40'), color: '#4f46e5' }, { label: t('perf.punc25'), color: '#0ea5e9' }, { label: t('perf.leave20'), color: '#10b981' }, { label: t('perf.disc15'), color: '#f59e0b' }].map(({ label, color }) => (
                                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />{label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                            {t('perf.title')} — {period === 'daily' ? t('perf.daily') : period === 'weekly' ? t('perf.weekly') : t('perf.monthly')} | {new Date(year, month - 1).toLocaleString(locale, { month: 'long', year: 'numeric' })}
                        </div>
                        <div className="table-wrapper">
                            <table>
                                <thead><tr>
                                    <th>{t('perf.rank')}</th><th>{t('common.employee')}</th><th>{t('common.department')}</th>
                                    <th>{t('perf.attendance')} <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>/40</span></th>
                                    <th>{t('perf.punctuality')} <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>/25</span></th>
                                    <th>{t('perf.leaveMgmt')} <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>/20</span></th>
                                    <th>{t('perf.discipline')} <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>/15</span></th>
                                    <th>{t('perf.totalScore')}</th><th>{t('perf.rating')}</th>
                                </tr></thead>
                                <tbody>
                                    {loading
                                        ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                                        : rankings.length === 0
                                            ? <tr><td colSpan={9}><div className="empty-state"><TrendingUp size={40} /><p>{t('perf.noData')}<br /><strong>{t('perf.clickCalc')}</strong></p></div></td></tr>
                                            : rankings.map((r, i) => (
                                                <tr key={r.id || i}>
                                                    <td><span className={`rank-badge ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other'}`}>{i + 1}</span></td>
                                                    <td><div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div><div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.employee_number}</div></td>
                                                    <td>{r.department}</td>
                                                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="score-bar" style={{ width: 60 }}><div className={`score-fill ${getScoreClass((r.attendance_score / 40) * 100)}`} style={{ width: `${(r.attendance_score / 40) * 100}%` }} /></div><span style={{ fontSize: '0.82rem' }}>{r.attendance_score?.toFixed(1)}</span></div></td>
                                                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="score-bar" style={{ width: 60 }}><div className={`score-fill ${getScoreClass((r.punctuality_score / 25) * 100)}`} style={{ width: `${(r.punctuality_score / 25) * 100}%` }} /></div><span style={{ fontSize: '0.82rem' }}>{r.punctuality_score?.toFixed(1)}</span></div></td>
                                                    <td style={{ fontSize: '0.85rem' }}>{r.leave_score?.toFixed(1)}</td>
                                                    <td style={{ fontSize: '0.85rem' }}>{r.discipline_score?.toFixed(1)}</td>
                                                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="score-bar" style={{ width: 70 }}><div className={`score-fill ${getScoreClass(r.total_score)}`} style={{ width: `${r.total_score}%` }} /></div><strong style={{ fontSize: '0.9rem' }}>{r.total_score?.toFixed(1)}%</strong></div></td>
                                                    <td><span className={`badge ${getRatingClass(r.rating)}`}>{r.rating}</span></td>
                                                </tr>
                                            ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ── OKR TAB ── */}
            {tab === 'okr' && (
                <div>
                    {okrLoading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('common.loading')}</div>}
                    {!okrLoading && objectives.length === 0 && (
                        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
                            <Target size={48} style={{ opacity: 0.3, marginBottom: 12, color: 'var(--text-muted)' }} />
                            <p style={{ color: 'var(--text-muted)' }}>{tl('No objectives for this quarter. Add one to get started.', 'لا توجد أهداف لهذا الربع. أضف هدفاً للبدء.')}</p>
                        </div>
                    )}
                    {!okrLoading && objectives.map(obj => {
                        const prog = objProgress(obj);
                        const meta = STATUS_META[obj.status] || STATUS_META.on_track;
                        const isExpanded = expandedObj[obj.id] !== false;
                        return (
                            <div key={obj.id} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                                {/* Objective header */}
                                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'var(--surface2)' }}
                                    onClick={() => setExpandedObj(p => ({ ...p, [obj.id]: !isExpanded }))}>
                                    <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: '0.2s', color: 'var(--text-muted)' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{obj.title}</span>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: meta.bg, color: meta.color }}>{meta[lang] || meta.en}</span>
                                        </div>
                                        {obj.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{obj.description}</div>}
                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ flex: 1, maxWidth: 200, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                                <div style={{ width: `${prog}%`, height: '100%', background: prog >= 75 ? '#10b981' : prog >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{prog}%</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{obj.key_results?.length || 0} {tl('key results', 'نتائج رئيسية')}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); setKrForm(EMPTY_KR); setKrModal(obj.id); }}>
                                            <Plus size={12} /> {tl('KR', 'نتيجة')}
                                        </button>
                                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); handleDeleteObj(obj.id); }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Key Results */}
                                {isExpanded && (
                                    <div style={{ padding: '12px 20px 16px' }}>
                                        {(!obj.key_results || obj.key_results.length === 0) ? (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '8px 0' }}>{tl('No key results yet. Click "+ KR" to add one.', 'لا توجد نتائج رئيسية بعد. انقر على "+ نتيجة" لإضافة واحدة.')}</div>
                                        ) : obj.key_results.map(kr => {
                                            const kp = krProgress(kr);
                                            const krMeta = STATUS_META[kr.status] || STATUS_META.on_track;
                                            return (
                                                <div key={kr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{kr.title}</span>
                                                            {kr.due_date && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>· {kr.due_date}</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ flex: 1, maxWidth: 160, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                                                                <div style={{ width: `${kp}%`, height: '100%', background: kp >= 75 ? '#10b981' : kp >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{kp}%</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{kr.current_value}/{kr.target_value} {kr.unit}</span>
                                                        </div>
                                                    </div>
                                                    <select value={kr.status} onChange={e => handleUpdateKR(kr.id, { status: e.target.value })}
                                                        style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: krMeta.bg, color: krMeta.color, cursor: 'pointer' }}>
                                                        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                                                    </select>
                                                    <input type="number" value={kr.current_value} min={0} max={kr.target_value}
                                                        onChange={e => handleUpdateKR(kr.id, { current_value: Number(e.target.value) })}
                                                        style={{ width: 60, fontSize: '0.82rem', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'center' }} />
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px 6px' }} onClick={() => handleDeleteKR(kr.id)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Objective Modal */}
            {objModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setObjModal(false)}>
                    <div className="modal" style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><Target size={17} style={{ marginInlineEnd: 8 }} />{tl('New Objective', 'هدف جديد')}</h3>
                            <button className="modal-close" onClick={() => setObjModal(false)}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px' }}>
                            <div className="form-group">
                                <label className="form-label">{tl('Objective Title', 'عنوان الهدف')} *</label>
                                <input className="form-control" value={objForm.title} onChange={e => setObjForm(p => ({ ...p, title: e.target.value }))} placeholder={tl('e.g. Improve Customer Satisfaction', 'مثال: تحسين رضا العملاء')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{tl('Description', 'الوصف')}</label>
                                <textarea className="form-control" rows={2} value={objForm.description} onChange={e => setObjForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{tl('Status', 'الحالة')}</label>
                                    <select className="form-control" value={objForm.status} onChange={e => setObjForm(p => ({ ...p, status: e.target.value }))}>
                                        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setObjModal(false)}>{tl('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" onClick={handleCreateObj}>{tl('Create', 'إنشاء')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Key Result Modal */}
            {krModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setKrModal(null)}>
                    <div className="modal" style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><Check size={17} style={{ marginInlineEnd: 8 }} />{tl('Add Key Result', 'إضافة نتيجة رئيسية')}</h3>
                            <button className="modal-close" onClick={() => setKrModal(null)}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px' }}>
                            <div className="form-group">
                                <label className="form-label">{tl('Key Result Title', 'عنوان النتيجة')} *</label>
                                <input className="form-control" value={krForm.title} onChange={e => setKrForm(p => ({ ...p, title: e.target.value }))} placeholder={tl('e.g. Achieve NPS score of 80', 'مثال: تحقيق درجة NPS 80')} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{tl('Target', 'الهدف')}</label>
                                    <input className="form-control" type="number" value={krForm.target_value} onChange={e => setKrForm(p => ({ ...p, target_value: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{tl('Current', 'الحالي')}</label>
                                    <input className="form-control" type="number" value={krForm.current_value} onChange={e => setKrForm(p => ({ ...p, current_value: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{tl('Unit', 'الوحدة')}</label>
                                    <input className="form-control" value={krForm.unit} onChange={e => setKrForm(p => ({ ...p, unit: e.target.value }))} placeholder="%,  SAR…" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{tl('Due Date', 'تاريخ الاستحقاق')}</label>
                                    <input className="form-control" type="date" value={krForm.due_date} onChange={e => setKrForm(p => ({ ...p, due_date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{tl('Status', 'الحالة')}</label>
                                    <select className="form-control" value={krForm.status} onChange={e => setKrForm(p => ({ ...p, status: e.target.value }))}>
                                        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setKrModal(null)}>{tl('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" onClick={handleCreateKR}>{tl('Add', 'إضافة')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
