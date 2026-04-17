import React, { useEffect, useState } from 'react';
import { TrendingUp, Calculator, Target, Plus, X, ChevronDown, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getRankings, calculatePerformance, getObjectives, createObjective, deleteObjective, createKeyResult, updateKeyResult, deleteKeyResult } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const getRatingMeta = (r) => ({
    Excellent:           { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    Good:                { color: '#4f46e5', bg: 'rgba(79,70,229,0.15)' },
    Average:             { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    'Needs Improvement': { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    Poor:                { color: '#b91c1c', bg: 'rgba(185,28,28,0.15)' },
}[r] || { color: '#64748b', bg: 'rgba(100,116,139,0.15)' });

const getScoreColor = (s) => s >= 90 ? '#10b981' : s >= 75 ? '#4f46e5' : s >= 60 ? '#f59e0b' : '#ef4444';

const STATUS_META = {
    on_track:  { en: 'On Track', ar: 'في المسار', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    at_risk:   { en: 'At Risk',  ar: 'في خطر',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    behind:    { en: 'Behind',   ar: 'متأخر',      color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    completed: { en: 'Done',     ar: 'مكتمل',      color: '#4f46e5', bg: 'rgba(79,70,229,0.15)' },
};

const RANK_GRAD = [
    'linear-gradient(135deg,#92400e,#f59e0b)',
    'linear-gradient(135deg,#374151,#9ca3af)',
    'linear-gradient(135deg,#78350f,#d97706)',
];

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

    const [objectives, setObjectives] = useState([]);
    const [okrLoading, setOkrLoading] = useState(false);
    const [objModal, setObjModal] = useState(false);
    const [objForm, setObjForm] = useState(EMPTY_OBJ);
    const [krModal, setKrModal] = useState(null);
    const [krForm, setKrForm] = useState(EMPTY_KR);
    const [expandedObj, setExpandedObj] = useState({});
    const [okrQuarter, setOkrQuarter] = useState('Q2');
    const [okrYear, setOkrYear] = useState(now.getFullYear());

    const loadRankings = () => {
        setLoading(true);
        getRankings({ period, month, year, employeeIds: subordinateIds })
            .then(r => setRankings(r.data || [])).catch(() => {}).finally(() => setLoading(false));
    };

    const loadOKRs = async () => {
        setOkrLoading(true);
        try { const r = await getObjectives({ quarter: okrQuarter, year: okrYear }); setObjectives(r.data || []); }
        catch (e) { toast.error(e.message); }
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
            toast.success(t('perf.successCalc')); loadRankings();
        } catch { toast.error(t('perf.errorCalc')); }
        finally { setCalculating(false); }
    };

    const handleCreateObj = async () => {
        if (!objForm.title) return toast.error(tl('Title required', 'العنوان مطلوب'));
        try {
            await createObjective({ ...objForm, year: okrYear, quarter: okrQuarter });
            toast.success(tl('Objective created', 'تم إنشاء الهدف'));
            setObjModal(false); setObjForm(EMPTY_OBJ); loadOKRs();
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
            setKrModal(null); setKrForm(EMPTY_KR); loadOKRs();
        } catch (e) { toast.error(e.message); }
    };

    const handleUpdateKR = async (id, updates) => {
        try { await updateKeyResult(id, updates); loadOKRs(); } catch (e) { toast.error(e.message); }
    };

    const handleDeleteKR = async (id) => {
        try { await deleteKeyResult(id); loadOKRs(); } catch (e) { toast.error(e.message); }
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
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 20 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('perf.title')}</p>
                    <h2 className="esshub-hero-value">
                        {rankings.length}
                        <span className="esshub-hero-unit"> {isAr ? 'موظف' : 'Ranked'}</span>
                    </h2>
                    {tab === 'rankings' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            {['daily', 'weekly', 'monthly'].map(p => (
                                <button key={p} onClick={() => setPeriod(p)} style={{
                                    background: period === p ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                                    border: `1px solid rgba(255,255,255,${period === p ? '0.4' : '0.15'})`,
                                    borderRadius: 8, padding: '4px 10px', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                }}>
                                    {p === 'daily' ? t('perf.daily') : p === 'weekly' ? t('perf.weekly') : t('perf.monthly')}
                                </button>
                            ))}
                            <select value={month} onChange={e => setMonth(Number(e.target.value))}
                                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', color: 'white', fontSize: '0.72rem', outline: 'none' }}>
                                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1} style={{ color: '#111' }}>{new Date(2024, i).toLocaleString(locale, { month: 'short' })}</option>)}
                            </select>
                            <select value={year} onChange={e => setYear(Number(e.target.value))}
                                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', color: 'white', fontSize: '0.72rem', outline: 'none' }}>
                                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y} style={{ color: '#111' }}>{y}</option>)}
                            </select>
                            {role === 'admin' && (
                                <button onClick={handleCalculate} disabled={calculating}
                                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '4px 10px', color: 'white', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Calculator size={12} />{calculating ? t('perf.calculating') : t('perf.calculate')}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="esshub-hero-pills" style={{ marginTop: 10 }}>
                        {[
                            { label: isAr ? 'أعلى درجة' : 'Top', count: `${topScore.toFixed(1)}%`, dot: '#34d399' },
                            { label: isAr ? 'المتوسط' : 'Avg', count: `${avgScore.toFixed(1)}%`, dot: '#60a5fa' },
                            { label: isAr ? 'ممتاز' : 'Excellent', count: excellent, dot: '#fbbf24' },
                        ].map(({ label, count, dot }) => (
                            <span key={label} className="esshub-pill">
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                                {label} {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                {[{ id: 'rankings', label: t('perf.title'), icon: TrendingUp }, { id: 'okr', label: tl('OKR Goals', 'أهداف OKR'), icon: Target }].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 10px', borderRadius: 7,
                        border: 'none', background: tab === id ? 'var(--primary)' : 'transparent',
                        color: tab === id ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {/* ── RANKINGS CARDS ── */}
            {tab === 'rankings' && (
                loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('common.loading')}</div>
                ) : rankings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <TrendingUp size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ fontSize: '0.9rem' }}>{t('perf.noData')}</p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: 4 }}>{t('perf.clickCalc')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {rankings.map((r, i) => {
                            const rm = getRatingMeta(r.rating);
                            const scoreColor = getScoreColor(r.total_score);
                            return (
                                <div key={r.id || i} style={{
                                    background: 'var(--surface)', borderRadius: 18, padding: '14px 16px',
                                    border: i < 3 ? `1px solid ${scoreColor}40` : '1px solid var(--border)',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {/* Rank badge */}
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                                            background: i < 3 ? RANK_GRAD[i] : 'var(--bg2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.1rem', fontWeight: 800, color: i < 3 ? 'white' : 'var(--text-muted)',
                                            boxShadow: i < 3 ? '0 4px 12px rgba(0,0,0,0.25)' : 'none',
                                        }}>
                                            {i + 1}
                                        </div>
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.first_name} {r.last_name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                                                {r.employee_number}{r.department ? ` · ${r.department}` : ''}
                                            </div>
                                            {/* Score bar */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ width: `${r.total_score}%`, height: '100%', background: scoreColor, borderRadius: 3, transition: 'width 0.4s' }} />
                                                </div>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: scoreColor, flexShrink: 0 }}>{r.total_score?.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        {/* Rating badge */}
                                        <div style={{ flexShrink: 0 }}>
                                            <span style={{ background: rm.bg, color: rm.color, fontSize: '0.68rem', fontWeight: 700, borderRadius: 8, padding: '3px 8px', display: 'block', textAlign: 'center' }}>
                                                {r.rating}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Sub-scores */}
                                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                        {[
                                            { label: isAr ? 'حضور' : 'Att', val: r.attendance_score?.toFixed(0), max: 40, color: '#4f46e5' },
                                            { label: isAr ? 'توقيت' : 'Punc', val: r.punctuality_score?.toFixed(0), max: 25, color: '#0ea5e9' },
                                            { label: isAr ? 'إجازة' : 'Leave', val: r.leave_score?.toFixed(0), max: 20, color: '#10b981' },
                                            { label: isAr ? 'انضباط' : 'Disc', val: r.discipline_score?.toFixed(0), max: 15, color: '#f59e0b' },
                                        ].map(({ label, val, max, color }) => (
                                            <div key={label} style={{ flex: 1, background: 'var(--bg2)', borderRadius: 8, padding: '5px 4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color }}>{val || 0}</div>
                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-dim)', lineHeight: 1.2 }}>{label}/{max}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* ── OKR TAB ── */}
            {tab === 'okr' && (
                <div>
                    {/* OKR controls */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <select className="form-control" style={{ flex: 1 }} value={okrQuarter} onChange={e => setOkrQuarter(e.target.value)}>
                            {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                        <select className="form-control" style={{ flex: 1 }} value={okrYear} onChange={e => setOkrYear(Number(e.target.value))}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={() => { setObjForm({ ...EMPTY_OBJ, quarter: okrQuarter, year: okrYear }); setObjModal(true); }}>
                            <Plus size={14} /> {tl('Add Objective', 'إضافة هدف')}
                        </button>
                    </div>

                    {okrLoading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('common.loading')}</div>}
                    {!okrLoading && objectives.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                            <Target size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <p style={{ fontSize: '0.9rem' }}>{tl('No objectives for this quarter.', 'لا توجد أهداف لهذا الربع.')}</p>
                        </div>
                    )}
                    {!okrLoading && objectives.map(obj => {
                        const prog = objProgress(obj);
                        const meta = STATUS_META[obj.status] || STATUS_META.on_track;
                        const isExpanded = expandedObj[obj.id] !== false;
                        return (
                            <div key={obj.id} style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                                {/* Header */}
                                <div style={{ padding: '14px 16px', background: 'var(--bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                                    onClick={() => setExpandedObj(p => ({ ...p, [obj.id]: !isExpanded }))}>
                                    <ChevronDown size={15} style={{ transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)', transition: '0.2s', color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700 }}>{obj.title}</span>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: meta.bg, color: meta.color }}>{meta[lang] || meta.en}</span>
                                        </div>
                                        {obj.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{obj.description}</div>}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                                <div style={{ width: `${prog}%`, height: '100%', background: prog >= 75 ? '#10b981' : prog >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />
                                            </div>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{prog}%</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                                            onClick={e => { e.stopPropagation(); setKrForm(EMPTY_KR); setKrModal(obj.id); }}>
                                            <Plus size={11} /> {tl('KR', 'نتيجة')}
                                        </button>
                                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                            onClick={e => { e.stopPropagation(); handleDeleteObj(obj.id); }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                {/* Key Results */}
                                {isExpanded && (
                                    <div style={{ padding: '10px 16px 14px' }}>
                                        {(!obj.key_results || obj.key_results.length === 0) ? (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '6px 0' }}>
                                                {tl('No key results yet.', 'لا توجد نتائج رئيسية بعد.')}
                                            </div>
                                        ) : obj.key_results.map(kr => {
                                            const kp = krProgress(kr);
                                            const krMeta = STATUS_META[kr.status] || STATUS_META.on_track;
                                            return (
                                                <div key={kr.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>{kr.title}</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                                                                    <div style={{ width: `${kp}%`, height: '100%', background: kp >= 75 ? '#10b981' : kp >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{kp}%</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{kr.current_value}/{kr.target_value} {kr.unit}</span>
                                                            </div>
                                                        </div>
                                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '3px 5px', flexShrink: 0 }} onClick={() => handleDeleteKR(kr.id)}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                        <select value={kr.status} onChange={e => handleUpdateKR(kr.id, { status: e.target.value })}
                                                            style={{ flex: 1, fontSize: '0.7rem', fontWeight: 700, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: krMeta.bg, color: krMeta.color, cursor: 'pointer', outline: 'none' }}>
                                                            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                                                        </select>
                                                        <input type="number" value={kr.current_value} min={0} max={kr.target_value}
                                                            onChange={e => handleUpdateKR(kr.id, { current_value: Number(e.target.value) })}
                                                            style={{ width: 70, fontSize: '0.82rem', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'center', outline: 'none' }} />
                                                    </div>
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
                        <div className="form-group">
                            <label className="form-label">{tl('Objective Title', 'عنوان الهدف')} *</label>
                            <input className="form-control" value={objForm.title} onChange={e => setObjForm(p => ({ ...p, title: e.target.value }))} placeholder={tl('e.g. Improve Customer Satisfaction', 'مثال: تحسين رضا العملاء')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{tl('Description', 'الوصف')}</label>
                            <textarea className="form-control" rows={2} value={objForm.description} onChange={e => setObjForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{tl('Status', 'الحالة')}</label>
                            <select className="form-control" value={objForm.status} onChange={e => setObjForm(p => ({ ...p, status: e.target.value }))}>
                                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                            </select>
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
                        <div className="form-group">
                            <label className="form-label">{tl('Key Result Title', 'عنوان النتيجة')} *</label>
                            <input className="form-control" value={krForm.title} onChange={e => setKrForm(p => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
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
                                <input className="form-control" value={krForm.unit} onChange={e => setKrForm(p => ({ ...p, unit: e.target.value }))} placeholder="%" />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                                <label className="form-label">{tl('Due Date', 'الاستحقاق')}</label>
                                <input className="form-control" type="date" value={krForm.due_date} onChange={e => setKrForm(p => ({ ...p, due_date: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{tl('Status', 'الحالة')}</label>
                                <select className="form-control" value={krForm.status} onChange={e => setKrForm(p => ({ ...p, status: e.target.value }))}>
                                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                                </select>
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
