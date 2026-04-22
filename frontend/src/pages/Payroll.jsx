import React, { useEffect, useRef, useState } from 'react';
import { DollarSign, Calculator, FileText, TrendingDown, Printer, X, Gift, ChevronDown, ChevronUp, ShieldCheck, Download, AlertTriangle, Building2, Save, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayroll, calculatePayroll, getPayrollSummary, generatePayslipPDF, getEmployees, calculateEOSB, updatePayrollStatus, updatePayrollBonus, getEstablishment, saveEstablishment, generateWPSSIF, getSalaryLadder, getSalaryLadderGrades, generateSalaryLadder, deleteSalaryLadderGrade } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const PAYROLL_STATUSES = [
    { value: 'processed',   label: 'Processed',   labelAr: 'محسوب',       color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
    { value: 'in_progress', label: 'In Progress',  labelAr: 'قيد التنفيذ', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    { value: 'on_hold',     label: 'On Hold',      labelAr: 'معلق',        color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
    { value: 'paid',        label: 'Paid',         labelAr: 'مدفوع',       color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    { value: 'cancelled',   label: 'Cancelled',    labelAr: 'ملغى',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
];

const statusMeta = (val) => PAYROLL_STATUSES.find(s => s.value === val) || PAYROLL_STATUSES[0];

export default function Payroll() {
    const { t, lang } = useLanguage();
    const { subordinateIds, role } = useAuth();
    const isAr = lang === 'ar';
    const [tab, setTab] = useState('payroll');
    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(null);
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [payslip, setPayslip] = useState(null);
    const payslipRef = useRef(null);
    const [bonusModal, setBonusModal] = useState(null);
    const [bonusType, setBonusType] = useState('none');
    const [bonusValue, setBonusValue] = useState('');
    const [updatingBonus, setUpdatingBonus] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [eosbEmpId, setEosbEmpId] = useState('');
    const [eosbResult, setEosbResult] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // WPS state
    const [estab, setEstab] = useState({ employer_id: '', cr_number: '', bank_iban: '', bank_name: '', company_name_en: '', company_name_ar: '' });
    const [estabSaving, setEstabSaving] = useState(false);
    const [wpsGenerating, setWpsGenerating] = useState(false);
    const [wpsViolations, setWpsViolations] = useState([]);

    // Salary Ladder state
    const [ladderData, setLadderData] = useState([]);
    const [ladderGrades, setLadderGrades] = useState([]);
    const [ladderFilter, setLadderFilter] = useState('');
    const [ladderLoading, setLadderLoading] = useState(false);
    const [showGenerate, setShowGenerate] = useState(false);
    const [genForm, setGenForm] = useState({ grade: '', start_min: '', start_max: '', annual_increment: '', years: 10 });

    const load = () => {
        setLoading(true);
        Promise.all([
            getPayroll({ month, year }),
            getPayrollSummary({ month, year })
        ]).then(([p, s]) => { setRecords(p.data); setSummary(s.data); })
            .catch(() => { }).finally(() => setLoading(false));
    };
    useEffect(load, [month, year]);
    useEffect(() => { getEmployees({ status: 'active', ids: subordinateIds }).then(r => setEmployees(r.data || [])).catch(e => console.error('Employees fetch failed:', e)); }, [subordinateIds]);
    useEffect(() => { getEstablishment().then(r => { if (r.data) setEstab(e => ({ ...e, ...r.data })); }).catch(e => console.error('Establishment fetch failed:', e)); }, []);

    // Load salary ladder data
    const loadLadder = () => {
        setLadderLoading(true);
        Promise.all([getSalaryLadder(ladderFilter || undefined), getSalaryLadderGrades()])
            .then(([d, g]) => { setLadderData(d.data || []); setLadderGrades(g.data || []); })
            .catch(() => {})
            .finally(() => setLadderLoading(false));
    };
    useEffect(() => { if (tab === 'ladder') loadLadder(); }, [tab, ladderFilter]);

    const handleSaveEstab = async () => {
        setEstabSaving(true);
        try {
            await saveEstablishment(estab);
            toast.success(isAr ? 'تم حفظ بيانات المنشأة' : 'Establishment saved');
        } catch (err) { toast.error(err.message); }
        finally { setEstabSaving(false); }
    };

    const handleGenerateSIF = async () => {
        setWpsGenerating(true);
        setWpsViolations([]);
        try {
            const { data } = await generateWPSSIF({ month, year });
            setWpsViolations(data.violations || []);
            // Download the file
            const blob = new Blob([data.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `WPS_SIF_${year}_${String(month).padStart(2, '0')}.sif`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(isAr
                ? `تم توليد ملف SIF — ${data.count} موظف، صافي: ${Number(data.total).toLocaleString()} ر.س`
                : `SIF generated — ${data.count} employees, net: SAR ${Number(data.total).toLocaleString()}`);
        } catch (err) { toast.error(err.message); }
        finally { setWpsGenerating(false); }
    };

    const handleEOSB = () => {
        const emp = employees.find(e => String(e.id) === String(eosbEmpId));
        if (!emp) return;
        setEosbResult({ ...calculateEOSB(emp).data, employee: emp });
    };

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            const r = await calculatePayroll({ month, year });
            toast.success(t('pay.successCalc').replace('{count}', r.data.processed));
            load();
        } catch (err) { toast.error(err.message || t('pay.errorCalc')); }
        finally { setCalculating(false); }
    };

    const openBonusModal = (rec) => {
        const existing = Number(rec.annual_incentive || 0);
        if (existing > 0) { setBonusType('fixed'); setBonusValue(String(existing)); }
        else { setBonusType('none'); setBonusValue(''); }
        setBonusModal({ record: rec });
    };

    const computedBonusAmount = () => {
        if (bonusType === 'none') return 0;
        const val = Number(bonusValue || 0);
        if (bonusType === 'fixed') return val;
        if (bonusType === 'multiplier') return Math.round(Number(bonusModal?.record?.base_salary || 0) * val * 100) / 100;
        return 0;
    };

    const handleSaveBonus = async () => {
        const rec = bonusModal?.record;
        if (!rec) return;
        setUpdatingBonus(rec.id);
        try {
            const bonusAmount = computedBonusAmount();
            await updatePayrollBonus(rec.id, bonusAmount, rec.base_salary, rec.absence_deduction, rec.gross_pay);
            setRecords(prev => prev.map(r => r.id === rec.id
                ? { ...r, annual_incentive: bonusAmount, net_pay: Math.round((Number(r.gross_pay) - Number(r.absence_deduction || 0) + bonusAmount) * 100) / 100 }
                : r
            ));
            if (payslip?.id === rec.id) setPayslip(p => ({ ...p, annual_incentive: bonusAmount, net_pay: Math.round((Number(p.gross_pay) - Number(p.absence_deduction || 0) + bonusAmount) * 100) / 100 }));
            toast.success(isAr ? 'تم حفظ المكافأة' : 'Bonus saved');
            setBonusModal(null);
        } catch (err) { toast.error(err.message); }
        finally { setUpdatingBonus(null); }
    };

    const handleStatusChange = async (id, newStatus) => {
        setUpdatingStatus(id);
        try {
            await updatePayrollStatus(id, newStatus);
            setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
            toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
        } catch (err) { toast.error(err.message || 'Error'); }
        finally { setUpdatingStatus(null); }
    };

    const handlePayslip = (r) => {
        setPayslip(r);
        setTimeout(() => payslipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    const handlePrint = () => {
        const el = payslipRef.current;
        if (!el) return;
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Payslip</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}.label{color:#555}.val{font-weight:700}</style></head><body>${el.innerHTML}</body></html>`);
        win.document.close(); win.focus(); win.print(); win.close();
    };

    const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const locale = isAr ? 'ar-SA' : 'en-US';
    const monthName = new Date(year, month - 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 20 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('pay.title')}</p>
                    <h2 className="esshub-hero-value">
                        {summary?.total_employees || 0}
                        <span className="esshub-hero-unit"> {isAr ? 'موظف' : 'Employees'}</span>
                    </h2>
                    <p className="esshub-hero-date">{monthName}</p>
                    {/* Month/Year pickers */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <select value={month} onChange={e => setMonth(Number(e.target.value))}
                            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '5px 10px', color: 'white', fontSize: '0.78rem', outline: 'none' }}>
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1} style={{ color: '#111' }}>{new Date(2024, i).toLocaleString(locale, { month: 'long' })}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(Number(e.target.value))}
                            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '5px 10px', color: 'white', fontSize: '0.78rem', outline: 'none' }}>
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y} style={{ color: '#111' }}>{y}</option>)}
                        </select>
                        {role === 'admin' && (
                            <button onClick={handleCalculate} disabled={calculating}
                                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '5px 12px', color: 'white', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Calculator size={13} />{calculating ? t('pay.calculating') : t('pay.calculate')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                {[
                    { id: 'payroll', label: t('pay.title'), icon: DollarSign },
                    { id: 'eosb', label: isAr ? 'نهاية خدمة' : 'EOSB', icon: TrendingDown },
                    { id: 'wps', label: 'WPS / SIF', icon: ShieldCheck },
                    ...((role === 'admin' || role === 'manager') ? [{ id: 'ladder', label: isAr ? 'سلم الرواتب' : 'Salary Ladder', icon: Layers }] : []),
                ].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 6px', borderRadius: 7,
                        border: 'none', background: tab === id ? 'var(--primary)' : 'transparent',
                        color: tab === id ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        <Icon size={13} /> {label}
                    </button>
                ))}
            </div>

            {/* Summary chips */}
            {tab === 'payroll' && summary && (
                <div className="esshub-stats-strip" style={{ marginBottom: 16 }}>
                    {[
                        { label: isAr ? 'الموظفون' : 'Employees', value: summary.total_employees, color: '#4f46e5' },
                        { label: isAr ? 'إجمالي' : 'Gross', value: fmt(summary.total_gross), color: '#0ea5e9' },
                        { label: isAr ? 'الخصومات' : 'Deductions', value: fmt(summary.total_deductions), color: '#ef4444' },
                        { label: isAr ? 'الصافي' : 'Net', value: fmt(summary.total_net), color: '#10b981' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="esshub-stat-chip" style={{ '--chip-color': color }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color }}>{value}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── EOSB TAB ── */}
            {tab === 'eosb' && (
                <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
                    <h3 style={{ marginBottom: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingDown size={18} color="var(--primary)" />
                        {isAr ? 'حساب مكافأة نهاية الخدمة' : 'EOSB Calculator'}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                        {isAr ? 'يحسب المكافأة وفق نظام العمل السعودي' : 'Calculated per Saudi Labor Law'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <select className="form-control" style={{ flex: 1 }} value={eosbEmpId} onChange={e => { setEosbEmpId(e.target.value); setEosbResult(null); }}>
                            <option value="">{isAr ? 'اختر موظفاً' : 'Select Employee'}</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={handleEOSB} disabled={!eosbEmpId}>
                            <Calculator size={15} />
                        </button>
                    </div>
                    {eosbResult && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{eosbResult.employee.first_name} {eosbResult.employee.last_name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                {isAr ? 'تاريخ التعيين:' : 'Hire date:'} {eosbResult.employee.hire_date}
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                                <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{eosbResult.years}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isAr ? 'سنوات الخدمة' : 'Years of Service'}</div>
                                </div>
                                <div style={{ flex: 1, background: 'rgba(16,185,129,0.1)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>{fmt(eosbResult.benefit)}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي المكافأة' : 'Total (SAR)'}</div>
                                </div>
                            </div>
                            {eosbResult.breakdown.map((b, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
                                    <span style={{ fontWeight: 700 }}>{fmt(b.amount)} SAR</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── WPS TAB ── */}
            {tab === 'wps' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Establishment Card */}
                    <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={17} color="var(--primary)" />
                            {isAr ? 'بيانات المنشأة (WPS)' : 'Establishment Info (WPS)'}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                            {isAr ? 'هذه البيانات تُستخدم في رأس ملف SIF المرسل للبنك' : 'Used in the SIF file header sent to the bank'}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'رقم المنشأة (MOL 10 أرقام)' : 'Employer MOL ID (10 digits)'}</label>
                                    <input className="form-control" value={estab.employer_id} maxLength={10}
                                        onChange={e => setEstab(s => ({ ...s, employer_id: e.target.value }))}
                                        placeholder="1234567890" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'رقم السجل التجاري' : 'CR Number'}</label>
                                    <input className="form-control" value={estab.cr_number}
                                        onChange={e => setEstab(s => ({ ...s, cr_number: e.target.value }))}
                                        placeholder="1010XXXXXXX" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{isAr ? 'IBAN الشركة (للدفع)' : 'Company IBAN (payer)'}</label>
                                <input className="form-control" value={estab.bank_iban}
                                    onChange={e => setEstab(s => ({ ...s, bank_iban: e.target.value }))}
                                    placeholder="SA00 0000 0000 0000 0000 0000" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'اسم الشركة (إنجليزي)' : 'Company Name (EN)'}</label>
                                    <input className="form-control" value={estab.company_name_en}
                                        onChange={e => setEstab(s => ({ ...s, company_name_en: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'اسم الشركة (عربي)' : 'Company Name (AR)'}</label>
                                    <input className="form-control" value={estab.company_name_ar}
                                        onChange={e => setEstab(s => ({ ...s, company_name_ar: e.target.value }))} />
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={handleSaveEstab} disabled={estabSaving}
                                style={{ alignSelf: 'flex-start', display: 'flex', gap: 6 }}>
                                <Save size={15} />
                                {estabSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ بيانات المنشأة' : 'Save Establishment')}
                            </button>
                        </div>
                    </div>

                    {/* Generate SIF */}
                    <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldCheck size={17} color="#10b981" />
                            {isAr ? 'توليد ملف WPS SIF' : 'Generate WPS SIF File'}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                            {isAr
                                ? `سيتم توليد ملف SIF للفترة: ${monthName} — يشمل السجلات ذات الحالة "محسوب" أو "مدفوع"`
                                : `Generates SIF for: ${monthName} — includes records with status "Processed" or "Paid"`}
                        </p>

                        {/* 80% rule warning */}
                        {wpsViolations.length > 0 && (
                            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 700, fontSize: '0.82rem', color: '#ef4444' }}>
                                    <AlertTriangle size={15} />
                                    {isAr ? 'تحذير: انتهاك قاعدة 80% (WPS)' : '80% Rule Violations (MHRSD Alert)'}
                                </div>
                                <p style={{ fontSize: '0.73rem', color: '#f87171', marginBottom: 8 }}>
                                    {isAr ? 'هؤلاء الموظفون سيحصلون على أقل من 80% من راتبهم المسجل في التأمينات الاجتماعية:' : 'These employees will receive less than 80% of their GOSI-registered salary:'}
                                </p>
                                {wpsViolations.map((v, i) => (
                                    <div key={i} style={{ fontSize: '0.78rem', color: '#f87171', padding: '3px 0' }}>⚠ {v}</div>
                                ))}
                            </div>
                        )}

                        <button onClick={handleGenerateSIF} disabled={wpsGenerating}
                            style={{
                                width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                            }}>
                            <Download size={18} />
                            {wpsGenerating
                                ? (isAr ? 'جاري التوليد...' : 'Generating...')
                                : (isAr ? `تنزيل ملف SIF — ${monthName}` : `Download SIF File — ${monthName}`)}
                        </button>

                        {/* Compliance notes */}
                        <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 12, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                            <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>📋 {isAr ? 'متطلبات WPS (SAMA/MHRSD)' : 'WPS Compliance Notes (SAMA/MHRSD)'}</div>
                            <div>• {isAr ? 'تأكد من إدخال IBAN وبيانات الهوية الوطنية لكل موظف في صفحة الموظفين' : 'Ensure each employee has IBAN + National ID filled in the Employees page'}</div>
                            <div>• {isAr ? 'صافي الراتب يجب ألا يقل عن 80% من الراتب المسجل في التأمينات (GOSI)' : 'Net salary must be ≥ 80% of GOSI-registered salary or MHRSD flags a violation'}</div>
                            <div>• {isAr ? 'أرسل الملف للبنك قبل نهاية الشهر لتجنب غرامات حماية الأجور' : 'Submit the file to your bank before month-end to avoid WPS penalties'}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PAYROLL CARDS ── */}
            {tab === 'payroll' && (
                loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('common.loading')}</div>
                ) : records.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <DollarSign size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ fontSize: '0.9rem' }}>{t('pay.noData')}</p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: 4 }}>{t('pay.clickCalc')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {records.map(r => {
                            const sm = statusMeta(r.status);
                            const isExpanded = expandedId === r.id;
                            const hasBonus = Number(r.annual_incentive || 0) > 0;
                            return (
                                <div key={r.id} style={{
                                    background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
                                    border: payslip?.id === r.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                                }}>
                                    <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {/* Avatar */}
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                                                background: 'linear-gradient(135deg, #065f46, #10b981)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.1rem', fontWeight: 800, color: 'white',
                                            }}>
                                                {(r.first_name || '?')[0].toUpperCase()}
                                            </div>
                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.first_name} {r.last_name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                    {r.employee_number}{r.department ? ` · ${r.department}` : ''}
                                                </div>
                                                <select
                                                    value={r.status || 'processed'}
                                                    disabled={updatingStatus === r.id}
                                                    onClick={e => e.stopPropagation()}
                                                    onChange={e => handleStatusChange(r.id, e.target.value)}
                                                    style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, border: `1px solid ${sm.color}40`, background: sm.bg, color: sm.color, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                                                    {PAYROLL_STATUSES.map(s => <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.label}</option>)}
                                                </select>
                                            </div>
                                            {/* Net pay */}
                                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{fmt(r.net_pay)}</div>
                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: 4 }}>SAR {isAr ? 'صافي' : 'Net'}</div>
                                                {isExpanded ? <ChevronUp size={13} color="var(--text-dim)" /> : <ChevronDown size={13} color="var(--text-dim)" />}
                                            </div>
                                        </div>

                                        {/* Quick row: days worked + deduction */}
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                            <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 8, padding: '5px 8px', fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{isAr ? 'حضور' : 'Days'}</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.days_worked}/{r.working_days}</span>
                                            </div>
                                            <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 8, padding: '5px 8px', fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{isAr ? 'إجمالي' : 'Gross'}</span>
                                                <span style={{ fontWeight: 700, color: '#0ea5e9' }}>{fmt(r.gross_pay)}</span>
                                            </div>
                                            {r.absence_deduction > 0 && (
                                                <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '5px 8px', fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#ef4444' }}>{isAr ? 'خصم' : 'Ded.'}</span>
                                                    <span style={{ fontWeight: 700, color: '#ef4444' }}>-{fmt(r.absence_deduction)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded earnings detail */}
                                    {isExpanded && (
                                        <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                                                {[
                                                    { label: isAr ? 'الراتب الأساسي' : 'Base Salary', val: fmt(r.base_salary), color: 'var(--text)' },
                                                    { label: isAr ? 'البدلات' : 'Allowances', val: fmt(Number(r.housing_allowance || 0) + Number(r.transport_allowance || 0) + Number(r.other_allowance || 0)), color: '#0ea5e9' },
                                                    { label: isAr ? 'الأجر الإضافي' : 'Overtime', val: r.overtime_hours > 0 ? `${fmt(r.overtime_pay)} (${r.overtime_hours}h)` : '—', color: '#8b5cf6' },
                                                    { label: isAr ? 'مكافأة' : 'Bonus', val: hasBonus ? `+${fmt(r.annual_incentive)}` : '—', color: '#10b981' },
                                                ].map(({ label, val, color }) => (
                                                    <div key={label} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px' }}>
                                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{val}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ borderTop: '1px solid var(--border)', display: 'flex' }}>
                                        <button onClick={() => openBonusModal(r)} style={{
                                            flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                            color: '#10b981', fontWeight: 700, fontSize: '0.75rem',
                                            borderRight: isAr ? 'none' : '1px solid var(--border)',
                                            borderLeft: isAr ? '1px solid var(--border)' : 'none',
                                        }}>
                                            <Gift size={13} />{isAr ? 'مكافأة' : 'Bonus'}
                                        </button>
                                        <button onClick={() => payslip?.id === r.id ? setPayslip(null) : handlePayslip(r)} style={{
                                            flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                            color: payslip?.id === r.id ? 'var(--danger)' : 'var(--primary)', fontWeight: 700, fontSize: '0.75rem',
                                        }}>
                                            <FileText size={13} />
                                            {payslip?.id === r.id ? (isAr ? 'إغلاق' : 'Close') : t('pay.slip')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* ── BONUS MODAL ── */}
            {bonusModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBonusModal(null)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Gift size={18} color="#10b981" />
                                {isAr ? 'تعيين المكافأة' : 'Set Bonus'} — {bonusModal.record.first_name} {bonusModal.record.last_name}
                            </h2>
                            <button className="modal-close" onClick={() => setBonusModal(null)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{isAr ? 'نوع المكافأة' : 'Bonus Type'}</label>
                            <select className="form-control" value={bonusType} onChange={e => { setBonusType(e.target.value); setBonusValue(''); }}>
                                <option value="none">{isAr ? 'بدون مكافأة' : 'No Bonus'}</option>
                                <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
                                <option value="multiplier">{isAr ? 'مضاعف الراتب' : 'Salary Multiplier'}</option>
                            </select>
                        </div>
                        {bonusType !== 'none' && (
                            <div className="form-group">
                                <label className="form-label">
                                    {bonusType === 'fixed' ? (isAr ? 'المبلغ (SAR)' : 'Amount (SAR)') : (isAr ? 'المضاعف' : 'Multiplier')}
                                </label>
                                <input className="form-control" type="number" min="0" step={bonusType === 'multiplier' ? '0.01' : '1'}
                                    value={bonusValue} onChange={e => setBonusValue(e.target.value)}
                                    placeholder={bonusType === 'multiplier' ? '0.5' : '1000'} />
                            </div>
                        )}
                        {bonusType !== 'none' && bonusValue && (
                            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)', marginBottom: 16 }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{isAr ? 'المكافأة المحسوبة:' : 'Computed bonus:'} </span>
                                <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{fmt(computedBonusAmount())} SAR</span>
                            </div>
                        )}
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setBonusModal(null)}>{t('common.cancel')}</button>
                            <button type="button" className="btn btn-primary" onClick={handleSaveBonus} disabled={updatingBonus === bonusModal.record.id}>
                                <Gift size={14} />{isAr ? 'حفظ المكافأة' : 'Save Bonus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PAYSLIP PANEL ── */}
            {tab === 'payroll' && payslip && (
                <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 16 }} ref={payslipRef}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} color="var(--primary)" />
                            {isAr ? 'قسيمة الراتب' : 'Payslip'} — {payslip.first_name} {payslip.last_name}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Printer size={13} /> {isAr ? 'طباعة' : 'Print'}
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setPayslip(null)}><X size={16} /></button>
                        </div>
                    </div>
                    <div style={{ padding: 20 }} id="payslip-content">
                        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '2px solid var(--border)' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 2 }}>{isAr ? 'قسيمة الراتب' : 'PAYSLIP'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'الفترة:' : 'Period:'} {monthName}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 16 }}>
                            {[
                                [isAr ? 'الاسم' : 'Name', `${payslip.first_name} ${payslip.last_name}`],
                                [isAr ? 'الرقم' : 'ID', payslip.employee_number],
                                [isAr ? 'القسم' : 'Dept', payslip.department],
                                [isAr ? 'الوظيفة' : 'Position', payslip.position || '—'],
                                [isAr ? 'الدرجة' : 'Grade', payslip.grade || '—'],
                            ].map(([label, value]) => (
                                <div key={label} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>{label}</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{value}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>{isAr ? 'الاستحقاقات' : 'EARNINGS'}</div>
                            {[
                                [isAr ? 'الراتب الأساسي' : 'Base Salary', payslip.base_salary],
                                [isAr ? 'بدل السكن' : 'Housing', payslip.housing_allowance],
                                [isAr ? 'بدل المواصلات' : 'Transport', payslip.transport_allowance],
                                [isAr ? 'بدلات أخرى' : 'Other', payslip.other_allowance],
                                [isAr ? 'أجر إضافي' : 'Overtime', payslip.overtime_pay],
                                [isAr ? 'مكافأة' : 'Bonus', payslip.annual_incentive],
                            ].filter(([, v]) => Number(v || 0) > 0).map(([label, value]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                    <span style={{ fontWeight: 600 }}>{fmt(value)} SAR</span>
                                </div>
                            ))}
                            {Number(payslip.absence_deduction || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                                    <span style={{ color: '#ef4444' }}>{isAr ? 'خصم الغياب' : 'Absence Deduction'}</span>
                                    <span style={{ fontWeight: 600, color: '#ef4444' }}>-{fmt(payslip.absence_deduction)} SAR</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                            {[
                                [isAr ? 'أيام العمل' : 'Working', payslip.working_days],
                                [isAr ? 'حضور' : 'Present', payslip.days_worked],
                                [isAr ? 'غياب' : 'Absent', payslip.days_absent],
                                [isAr ? 'أجر إضافي' : 'OT Hrs', payslip.overtime_hours],
                            ].map(([label, value]) => (
                                <div key={label} style={{ flex: 1, minWidth: 60, textAlign: 'center', padding: '8px 4px', background: 'var(--bg2)', borderRadius: 8 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{value ?? 0}</div>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(16,185,129,0.1)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{isAr ? 'صافي الراتب' : 'NET PAY'}</span>
                            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#10b981' }}>{fmt(payslip.net_pay)} SAR</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SALARY LADDER TAB ── */}
            {tab === 'ladder' && (role === 'admin' || role === 'manager') && (
                <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Layers size={18} color="var(--primary)" />
                                {isAr ? 'سلم الرواتب (10 سنوات)' : 'Salary Ladder (10-Year Progression)'}
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {isAr ? 'تعريف الحد الأدنى والأقصى لكل درجة' : 'Define min/max salary per grade per year of service'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select className="form-control" value={ladderFilter} onChange={e => setLadderFilter(e.target.value)} style={{ minWidth: 140 }}>
                                <option value="">{isAr ? 'كل الدرجات' : 'All Grades'}</option>
                                {ladderGrades.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>
                                <Calculator size={14} /> {isAr ? 'توليد سلم' : 'Generate'}
                            </button>
                        </div>
                    </div>

                    {ladderLoading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
                    ) : ladderData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                            <Layers size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <p style={{ fontSize: '0.88rem' }}>{isAr ? 'لا توجد بيانات بعد' : 'No salary ladder defined yet'}</p>
                            <p style={{ fontSize: '0.75rem', marginTop: 4 }}>{isAr ? 'اضغط توليد سلم للبدء' : 'Click Generate to create one'}</p>
                        </div>
                    ) : (
                        <div>
                            {/* Group by grade */}
                            {[...new Set(ladderData.map(d => d.grade))].map(grade => {
                                const rows = ladderData.filter(d => d.grade === grade);
                                return (
                                    <div key={grade} style={{ marginBottom: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>{grade}</span>
                                            <button onClick={async () => {
                                                if (!window.confirm(isAr ? `حذف سلم ${grade}؟` : `Delete ladder for ${grade}?`)) return;
                                                try { await deleteSalaryLadderGrade(grade); toast.success(isAr ? 'تم الحذف' : 'Deleted'); loadLadder(); } catch (e) { toast.error(e.message); }
                                            }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                                                {isAr ? 'حذف' : 'Delete'}
                                            </button>
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg2)' }}>
                                                        <th style={{ padding: '8px 10px', textAlign: isAr ? 'right' : 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{isAr ? 'السنة' : 'Year'}</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{isAr ? 'الحد الأدنى' : 'Min Salary'}</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{isAr ? 'الحد الأقصى' : 'Max Salary'}</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{isAr ? 'الزيادة السنوية' : 'Increment'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map(r => (
                                                        <tr key={r.id || r.year_number} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{isAr ? `السنة ${r.year_number}` : `Year ${r.year_number}`}</td>
                                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{Number(r.min_salary).toLocaleString()}</td>
                                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#4f46e5', fontWeight: 700 }}>{Number(r.max_salary).toLocaleString()}</td>
                                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{Number(r.annual_increment).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Generate Salary Ladder Modal */}
            {showGenerate && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowGenerate(false)}>
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><Layers size={17} style={{ marginInlineEnd: 8 }} />{isAr ? 'توليد سلم رواتب' : 'Generate Salary Ladder'}</h3>
                            <button className="modal-close" onClick={() => setShowGenerate(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                await generateSalaryLadder({
                                    grade: genForm.grade,
                                    start_min: Number(genForm.start_min),
                                    start_max: Number(genForm.start_max),
                                    annual_increment: Number(genForm.annual_increment),
                                    years: Number(genForm.years) || 10,
                                });
                                toast.success(isAr ? 'تم توليد السلم' : 'Ladder generated');
                                setShowGenerate(false);
                                setGenForm({ grade: '', start_min: '', start_max: '', annual_increment: '', years: 10 });
                                loadLadder();
                            } catch (err) { toast.error(err.message); }
                        }} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
                            <div className="form-group">
                                <label className="form-label">{isAr ? 'الدرجة' : 'Grade'} *</label>
                                <select className="form-control" required value={genForm.grade} onChange={e => setGenForm(f => ({ ...f, grade: e.target.value }))}>
                                    <option value="">{isAr ? 'اختر درجة' : 'Select Grade'}</option>
                                    {['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10'].map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'الحد الأدنى (سنة 1)' : 'Min Salary (Year 1)'} *</label>
                                    <input className="form-control" type="number" step="0.01" required value={genForm.start_min} onChange={e => setGenForm(f => ({ ...f, start_min: e.target.value }))} placeholder="3000" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'الحد الأقصى (سنة 1)' : 'Max Salary (Year 1)'} *</label>
                                    <input className="form-control" type="number" step="0.01" required value={genForm.start_max} onChange={e => setGenForm(f => ({ ...f, start_max: e.target.value }))} placeholder="5000" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'الزيادة السنوية' : 'Annual Increment'}</label>
                                    <input className="form-control" type="number" step="0.01" value={genForm.annual_increment} onChange={e => setGenForm(f => ({ ...f, annual_increment: e.target.value }))} placeholder="500" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'عدد السنوات' : 'Years'}</label>
                                    <input className="form-control" type="number" min="1" max="20" value={genForm.years} onChange={e => setGenForm(f => ({ ...f, years: e.target.value }))} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerate(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                                <button type="submit" className="btn btn-primary"><Layers size={14} /> {isAr ? 'توليد' : 'Generate'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
