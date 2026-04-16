import React, { useEffect, useRef, useState } from 'react';
import { DollarSign, Calculator, FileText, TrendingDown, Printer, X, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPayroll, calculatePayroll, getPayrollSummary, generatePayslipPDF, getEmployees, calculateEOSB, updatePayrollStatus, updatePayrollBonus } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const PAYROLL_STATUSES = [
    { value: 'processed',   label: 'Processed',   labelAr: 'محسوب',         color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    { value: 'in_progress', label: 'In Progress',  labelAr: 'قيد التنفيذ',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { value: 'on_hold',     label: 'On Hold',      labelAr: 'معلق',          color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
    { value: 'paid',        label: 'Paid',         labelAr: 'مدفوع',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { value: 'cancelled',   label: 'Cancelled',    labelAr: 'ملغى',          color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
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
    // Payslip preview
    const [payslip, setPayslip] = useState(null);
    const payslipRef = useRef(null);
    // Bonus modal
    const [bonusModal, setBonusModal] = useState(null); // { record }
    const [bonusType, setBonusType] = useState('none'); // none | fixed | multiplier
    const [bonusValue, setBonusValue] = useState('');
    const [updatingBonus, setUpdatingBonus] = useState(null);
    // EOSB state
    const [employees, setEmployees] = useState([]);
    const [eosbEmpId, setEosbEmpId] = useState('');
    const [eosbResult, setEosbResult] = useState(null);

    const load = () => {
        setLoading(true);
        Promise.all([
            getPayroll({ month, year }),
            getPayrollSummary({ month, year })
        ]).then(([p, s]) => { setRecords(p.data); setSummary(s.data); })
            .catch(() => { }).finally(() => setLoading(false));
    };
    useEffect(load, [month, year]);
    useEffect(() => { getEmployees({ status: 'active', ids: subordinateIds }).then(r => setEmployees(r.data || [])).catch(() => {}); }, [subordinateIds]);

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
        if (existing > 0) {
            setBonusType('fixed');
            setBonusValue(String(existing));
        } else {
            setBonusType('none');
            setBonusValue('');
        }
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
        win.document.write(`
            <html><head><title>Payslip</title><style>
                body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
                h2 { margin: 0 0 4px; } .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin-bottom: 24px; }
                .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
                .label { color: #555; } .val { font-weight: 700; }
                .total { font-size: 16px; font-weight: 800; padding: 12px 0; border-top: 2px solid #111; margin-top: 8px; }
                .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
                .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #888; margin: 20px 0 8px; }
            </style></head><body>${el.innerHTML}</body></html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
    };

    const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const locale = isAr ? 'ar-SA' : 'en-US';
    const monthName = new Date(year, month - 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('pay.title')}</h1>
                    <p className="page-subtitle">{t('pay.subtitle')}</p>
                </div>
                {tab === 'payroll' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString(locale, { month: 'long' })}</option>)}
                        </select>
                        <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(Number(e.target.value))}>
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {role === 'admin' && (
                            <button className="btn btn-primary" onClick={handleCalculate} disabled={calculating}>
                                <Calculator size={15} />{calculating ? t('pay.calculating') : t('pay.calculate')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {[{ id: 'payroll', label: t('pay.title'), icon: DollarSign }, { id: 'eosb', label: isAr ? 'مكافأة نهاية الخدمة' : 'EOSB Calculator', icon: TrendingDown }].map(({ id, label, icon: Icon }) => (
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

            {/* ── EOSB TAB ── */}
            {tab === 'eosb' && (
                <div style={{ maxWidth: 600 }}>
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ marginBottom: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingDown size={18} color="var(--primary)" />
                            {isAr ? 'حساب مكافأة نهاية الخدمة' : 'End of Service Benefit Calculator'}
                        </h3>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                            {isAr ? 'يحسب المكافأة وفق نظام العمل السعودي' : 'Calculated per Saudi Labor Law based on years of service'}
                        </p>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                            <select className="form-control" value={eosbEmpId} onChange={e => { setEosbEmpId(e.target.value); setEosbResult(null); }}>
                                <option value="">{isAr ? 'اختر موظفاً' : 'Select Employee'}</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>)}
                            </select>
                            <button className="btn btn-primary" onClick={handleEOSB} disabled={!eosbEmpId}>
                                <Calculator size={15} /> {isAr ? 'احسب' : 'Calculate'}
                            </button>
                        </div>
                        {eosbResult && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                                <div style={{ marginBottom: 12 }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{isAr ? 'الموظف' : 'Employee'}</span>
                                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{eosbResult.employee.first_name} {eosbResult.employee.last_name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'تاريخ التعيين:' : 'Hire date:'} {eosbResult.employee.hire_date}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                    <div className="stat-card" style={{ flex: 1 }}><div className="stat-info"><h3 style={{ color: 'var(--primary)' }}>{eosbResult.years}</h3><p>{isAr ? 'سنوات الخدمة' : 'Years of Service'}</p></div></div>
                                    <div className="stat-card" style={{ flex: 1 }}><div className="stat-info"><h3 style={{ color: '#10b981' }}>{fmt(eosbResult.benefit)} SAR</h3><p>{isAr ? 'إجمالي المكافأة' : 'Total Benefit'}</p></div></div>
                                </div>
                                {eosbResult.breakdown.map((b, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
                                        <span style={{ fontWeight: 700 }}>{fmt(b.amount)} SAR</span>
                                    </div>
                                ))}
                                <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => window.print()}><FileText size={14} /> {isAr ? 'طباعة' : 'Print'}</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── PAYROLL TAB ── */}
            {tab === 'payroll' && summary && (
                <div className="stat-grid" style={{ marginBottom: 20 }}>
                    {[
                        { label: t('pay.totalEmployees'), value: summary.total_employees, color: '#4f46e5' },
                        { label: t('pay.totalGross'), value: fmt(summary.total_gross), color: '#0ea5e9' },
                        { label: t('pay.totalDeductions'), value: fmt(summary.total_deductions), color: '#ef4444' },
                        { label: t('pay.totalNet'), value: fmt(summary.total_net), color: '#10b981' },
                    ].map(({ label, value, color }) => (
                        <div className="stat-card" key={label}>
                            <div className="stat-icon" style={{ background: `${color}22` }}><DollarSign size={20} color={color} /></div>
                            <div className="stat-info"><h3 style={{ color, fontSize: '1.2rem' }}>{value}</h3><p>{label}</p></div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'payroll' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                        {t('pay.title')} — {monthName}
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>{t('common.employee')}</th>
                                <th>{t('pay.baseSalary')}</th>
                                <th>{t('pay.allowances')}</th>
                                <th>{t('pay.overtime')}</th>
                                <th>{t('pay.grossPay')}</th>
                                <th>{t('pay.deductions')}</th>
                                <th>{isAr ? 'مكافأة' : 'Bonus'}</th>
                                <th>{t('pay.netPay')}</th>
                                <th>{t('pay.days')}</th>
                                <th>{t('common.status')}</th>
                                <th>{t('common.actions')}</th>
                            </tr></thead>
                            <tbody>
                                {loading
                                    ? <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                                    : records.length === 0
                                        ? <tr><td colSpan={11}><div className="empty-state"><DollarSign size={40} /><p>{t('pay.noData')}<br /><strong>{t('pay.clickCalc')}</strong></p></div></td></tr>
                                        : records.map(r => {
                                            const sm = statusMeta(r.status);
                                            const hasBonus = Number(r.annual_incentive || 0) > 0;
                                            return (
                                                <tr key={r.id} style={{ background: payslip?.id === r.id ? 'rgba(79,70,229,0.06)' : undefined }}>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                                                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.employee_number} · {r.department}</div>
                                                    </td>
                                                    <td>{fmt(r.base_salary)}</td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                                                        +{fmt(Number(r.housing_allowance || 0) + Number(r.transport_allowance || 0) + Number(r.other_allowance || 0))}
                                                    </td>
                                                    <td style={{ color: '#0ea5e9', fontSize: '0.83rem' }}>{r.overtime_hours > 0 ? `${fmt(r.overtime_pay)} (${r.overtime_hours}h)` : '—'}</td>
                                                    <td style={{ fontWeight: 600 }}>{fmt(r.gross_pay)}</td>
                                                    <td style={{ color: 'var(--danger)' }}>{r.absence_deduction > 0 ? `-${fmt(r.absence_deduction)}` : '—'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {hasBonus
                                                                ? <span style={{ color: '#10b981', fontWeight: 700 }}>+{fmt(r.annual_incentive)}</span>
                                                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                                            }
                                                            <button
                                                                className="btn btn-sm"
                                                                onClick={() => openBonusModal(r)}
                                                                disabled={updatingBonus === r.id}
                                                                style={{ padding: '2px 6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 5 }}
                                                            >
                                                                <Gift size={11} />{isAr ? 'تعيين' : 'Set'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: '#10b981' }}>{fmt(r.net_pay)}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.days_worked}/{r.working_days}</td>
                                                    <td>
                                                        {/* Status dropdown */}
                                                        <select
                                                            value={r.status || 'processed'}
                                                            disabled={updatingStatus === r.id}
                                                            onChange={e => handleStatusChange(r.id, e.target.value)}
                                                            style={{
                                                                fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                                                border: `1px solid ${sm.color}40`, background: sm.bg, color: sm.color,
                                                                cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            {PAYROLL_STATUSES.map(s => (
                                                                <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => payslip?.id === r.id ? setPayslip(null) : handlePayslip(r)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                                        >
                                                            <FileText size={13} />
                                                            {payslip?.id === r.id ? (isAr ? 'إغلاق' : 'Close') : t('pay.slip')}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
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
                                    {bonusType === 'fixed'
                                        ? (isAr ? 'المبلغ (SAR)' : 'Amount (SAR)')
                                        : (isAr ? 'المضاعف (مثال: 0.5 = نصف الراتب)' : 'Multiplier (e.g. 0.5 = half salary)')}
                                </label>
                                <input
                                    className="form-control"
                                    type="number"
                                    min="0"
                                    step={bonusType === 'multiplier' ? '0.01' : '1'}
                                    value={bonusValue}
                                    onChange={e => setBonusValue(e.target.value)}
                                    placeholder={bonusType === 'multiplier' ? '0.5' : '1000'}
                                />
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
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSaveBonus}
                                disabled={updatingBonus === bonusModal.record.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Gift size={14} />{isAr ? 'حفظ المكافأة' : 'Save Bonus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PAYSLIP PREVIEW PANEL ── */}
            {tab === 'payroll' && payslip && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }} ref={payslipRef}>
                    {/* Panel header */}
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} color="var(--primary)" />
                            {isAr ? 'قسيمة الراتب' : 'Payslip'} — {payslip.first_name} {payslip.last_name}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Printer size={14} /> {isAr ? 'طباعة' : 'Print'}
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setPayslip(null)}><X size={16} /></button>
                        </div>
                    </div>

                    {/* Payslip content */}
                    <div style={{ padding: 32 }}>
                        <div id="payslip-content">
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                                        {isAr ? 'قسيمة الراتب' : 'PAYSLIP'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {isAr ? 'الفترة:' : 'Period:'} {monthName}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {(() => { const sm = statusMeta(payslip.status); return (
                                        <span style={{ background: sm.bg, color: sm.color, fontWeight: 700, fontSize: '0.78rem', borderRadius: 6, padding: '4px 12px', border: `1px solid ${sm.color}40` }}>
                                            {isAr ? sm.labelAr : sm.label}
                                        </span>
                                    ); })()}
                                </div>
                            </div>

                            {/* Employee info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 40px', marginBottom: 28 }}>
                                {[
                                    [isAr ? 'اسم الموظف' : 'Employee Name', `${payslip.first_name} ${payslip.last_name}`],
                                    [isAr ? 'رقم الموظف' : 'Employee ID', payslip.employee_number],
                                    [isAr ? 'القسم' : 'Department', payslip.department],
                                    [isAr ? 'المسمى الوظيفي' : 'Position', payslip.position || '—'],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Earnings */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                    {isAr ? 'الاستحقاقات' : 'EARNINGS'}
                                </div>
                                {[
                                    [isAr ? 'الراتب الأساسي' : 'Base Salary', payslip.base_salary],
                                    [isAr ? 'بدل السكن' : 'Housing Allowance', payslip.housing_allowance],
                                    [isAr ? 'بدل المواصلات' : 'Transport Allowance', payslip.transport_allowance],
                                    [isAr ? 'بدلات أخرى' : 'Other Allowance', payslip.other_allowance],
                                    [isAr ? 'أجر إضافي' : 'Overtime Pay', payslip.overtime_pay],
                                    [isAr ? 'مكافأة' : 'Bonus', payslip.annual_incentive],
                                ].filter(([, v]) => Number(v || 0) > 0).map(([label, value]) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                        <span style={{ fontWeight: 600 }}>{fmt(value)} SAR</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '0.9rem', fontWeight: 700, color: '#0ea5e9' }}>
                                    <span>{isAr ? 'إجمالي الراتب' : 'Gross Pay'}</span>
                                    <span>{fmt(payslip.gross_pay)} SAR</span>
                                </div>
                            </div>

                            {/* Deductions */}
                            {Number(payslip.absence_deduction || 0) > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                        {isAr ? 'الخصومات' : 'DEDUCTIONS'}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'خصم الغياب' : 'Absence Deduction'}</span>
                                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{fmt(payslip.absence_deduction)} SAR</span>
                                    </div>
                                </div>
                            )}

                            {/* Attendance */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                    {isAr ? 'سجل الحضور' : 'ATTENDANCE'}
                                </div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    {[
                                        [isAr ? 'أيام العمل' : 'Working Days', payslip.working_days],
                                        [isAr ? 'أيام الحضور' : 'Days Present', payslip.days_worked],
                                        [isAr ? 'أيام الغياب' : 'Days Absent', payslip.days_absent],
                                        [isAr ? 'ساعات إضافية' : 'Overtime Hrs', payslip.overtime_hours],
                                    ].map(([label, value]) => (
                                        <div key={label} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: 'var(--surface2)', borderRadius: 8 }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>{value ?? 0}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Net pay total */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(16,185,129,0.1)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{isAr ? 'صافي الراتب' : 'NET PAY'}</span>
                                <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#10b981' }}>{fmt(payslip.net_pay)} SAR</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
