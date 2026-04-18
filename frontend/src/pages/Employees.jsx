import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, ClipboardList, Check, X, ChevronDown, ChevronUp, Briefcase, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getDepartments, getOnboardingTasks, createOnboardingTasks, completeOnboardingTask, uncompleteOnboardingTask } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TASKS = [
    'Send welcome email', 'Set up workstation & equipment', 'Add to payroll system',
    'Issue access card / ID badge', 'Sign employment contract', 'Complete HR paperwork',
    'Introduce to team', 'Assign buddy / mentor',
];

const WEEKDAYS = [
    { value: 'sunday', en: 'Sunday', ar: 'الأحد' },
    { value: 'monday', en: 'Monday', ar: 'الاثنين' },
    { value: 'tuesday', en: 'Tuesday', ar: 'الثلاثاء' },
    { value: 'wednesday', en: 'Wednesday', ar: 'الأربعاء' },
    { value: 'thursday', en: 'Thursday', ar: 'الخميس' },
    { value: 'friday', en: 'Friday', ar: 'الجمعة' },
    { value: 'saturday', en: 'Saturday', ar: 'السبت' },
];

const EMPTY_FORM = {
    employee_number: '', first_name: '', last_name: '', email: '', phone: '',
    position: '', job_title: '', department: '', hire_date: '', salary_type: 'monthly',
    base_salary: '', housing_allowance: '', transport_allowance: '',
    other_allowance: '', annual_incentive_multiplier: '', status: 'active',
    shift_type: 'first', shift_start: '09:00', shift_end: '16:00',
    days_off_count: 2, day_off_1: 'friday', day_off_2: 'saturday',
};

const STATUS_COLORS = {
    active:     { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    terminated: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    suspended:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

const DEPT_GRADIENTS = [
    'linear-gradient(135deg,#4c1d95,#7c3aed)',
    'linear-gradient(135deg,#065f46,#10b981)',
    'linear-gradient(135deg,#0369a1,#0ea5e9)',
    'linear-gradient(135deg,#92400e,#f59e0b)',
    'linear-gradient(135deg,#9f1239,#ef4444)',
    'linear-gradient(135deg,#164e63,#06b6d4)',
];

export default function Employees({ role }) {
    const { t, lang } = useLanguage();
    const isAr = lang === 'ar';
    const { subordinateIds, role: userRole } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('active');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [onboardingEmp, setOnboardingEmp] = useState(null);
    const [onboardingTasks, setOnboardingTasks] = useState([]);
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const load = () => {
        getEmployees({ search, department: filterDept, status: filterStatus || undefined, ids: subordinateIds })
            .then(r => setEmployees(r.data)).catch(() => { }).finally(() => setLoading(false));
    };
    useEffect(load, [search, filterDept, filterStatus]);
    useEffect(() => { getDepartments().then(r => setDepartments(r.data)).catch(() => { }); }, []);

    const openAdd = () => {
        // Auto-suggest next employee number based on highest existing one
        const nums = employees
            .map(e => parseInt((e.employee_number || '').replace(/\D/g, ''), 10))
            .filter(n => !isNaN(n));
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        const nextNum = `EMP-${String(next).padStart(3, '0')}`;
        setForm({ ...EMPTY_FORM, employee_number: nextNum });
        setEditId(null);
        setShowModal(true);
    };
    const openEdit = (emp) => {
        setForm({ ...emp, base_salary: emp.base_salary || '', housing_allowance: emp.housing_allowance || '', transport_allowance: emp.transport_allowance || '', other_allowance: emp.other_allowance || '', annual_incentive_multiplier: emp.annual_incentive_multiplier || '' });
        setEditId(emp.id); setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (editId) { await updateEmployee(editId, form); toast.success(t('emp.editEmployee')); }
            else { await createEmployee(form); toast.success(t('emp.addEmployee')); }
            setShowModal(false); load();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('employee_number') || msg.includes('duplicate key')) {
                toast.error(t('emp.duplicateNumber') || `Employee number "${form.employee_number}" already exists — use a different one`);
            } else {
                toast.error(msg || 'Error saving employee');
            }
        }
        finally { setSaving(false); }
    };

    const handleDelete = async (emp) => {
        if (!window.confirm(t('emp.deleteConfirm').replace('{name}', `${emp.first_name} ${emp.last_name}`))) return;
        try { await deleteEmployee(emp.id); toast.success(t('common.delete')); load(); }
        catch { toast.error('Error deleting employee'); }
    };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const openOnboarding = async (emp) => {
        setOnboardingEmp(emp);
        setOnboardingLoading(true);
        try {
            const r = await getOnboardingTasks(emp.id);
            let tasks = r.data || [];
            if (tasks.length === 0) {
                await createOnboardingTasks(emp.id, DEFAULT_TASKS);
                const r2 = await getOnboardingTasks(emp.id);
                tasks = r2.data || [];
            }
            setOnboardingTasks(tasks);
        } catch (e) { toast.error(e.message); }
        finally { setOnboardingLoading(false); }
    };

    const toggleTask = async (task) => {
        try {
            if (task.completed) { await uncompleteOnboardingTask(task.id); }
            else { await completeOnboardingTask(task.id, 'Admin'); }
            setOnboardingTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
        } catch (e) { toast.error(e.message); }
    };

    const deptGradient = (dept) => DEPT_GRADIENTS[(dept || '').length % DEPT_GRADIENTS.length];

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Hero */}
            <div className="esshub-hero" style={{ marginBottom: 20 }}>
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">{t('emp.title')}</p>
                    <h2 className="esshub-hero-value">
                        {employees.length}
                        <span className="esshub-hero-unit"> {isAr ? 'موظف' : 'Employees'}</span>
                    </h2>
                    {userRole === 'admin' && (
                        <button onClick={openAdd} style={{
                            marginTop: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 10, padding: '6px 14px', color: 'white', fontSize: '0.8rem',
                            fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}>
                            <Plus size={14} />
                            {t('emp.addEmployee')}
                        </button>
                    )}
                </div>
            </div>

            {/* Search & Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--border)' }}>
                    <Search size={15} color="var(--text-muted)" />
                    <input
                        style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: 'var(--text)', fontSize: '0.88rem' }}
                        placeholder={t('emp.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-control" style={{ flex: 1 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                        <option value="">{t('emp.allDepartments')}</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className="form-control" style={{ flex: 1 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">{t('emp.allStatus')}</option>
                        <option value="active">{t('emp.active')}</option>
                        <option value="terminated">{t('emp.terminated')}</option>
                        <option value="suspended">{t('emp.suspended')}</option>
                    </select>
                </div>
            </div>

            {/* Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('common.loading')}</div>
            ) : employees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: '0.9rem' }}>{t('emp.noFound')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {employees.map((emp, idx) => {
                        const sm = STATUS_COLORS[emp.status] || STATUS_COLORS.active;
                        const isExpanded = expandedId === emp.id;
                        return (
                            <div key={emp.id} style={{
                                background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
                                border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                            }}>
                                <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : emp.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: 48, height: 48, borderRadius: 15, flexShrink: 0,
                                            background: deptGradient(emp.department),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.2rem', fontWeight: 800, color: 'white',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                        }}>
                                            {(emp.first_name || '?')[0].toUpperCase()}
                                        </div>
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                {emp.first_name} {emp.last_name}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                {emp.job_title || emp.position} · {emp.department}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <span style={{ background: 'var(--bg2)', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>
                                                    {emp.employee_number}
                                                </span>
                                                <span style={{ background: sm.bg, color: sm.color, fontSize: '0.65rem', fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>
                                                    {t(`emp.${emp.status}`)}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Salary + chevron */}
                                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981' }}>
                                                {Number(emp.base_salary).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: 4 }}>
                                                {isAr ? 'الراتب' : 'Salary'}
                                            </div>
                                            {isExpanded ? <ChevronUp size={13} color="var(--text-dim)" /> : <ChevronDown size={13} color="var(--text-dim)" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                                            {[
                                                { icon: <Briefcase size={13} />, label: isAr ? 'النوع' : 'Type', val: emp.salary_type === 'monthly' ? t('emp.monthly') : t('emp.hourly') },
                                                { icon: <DollarSign size={13} />, label: isAr ? 'السكن' : 'Housing', val: Number(emp.housing_allowance || 0).toLocaleString() },
                                                { icon: '🚗', label: isAr ? 'المواصلات' : 'Transport', val: Number(emp.transport_allowance || 0).toLocaleString() },
                                                { icon: '📅', label: isAr ? 'تاريخ التعيين' : 'Hire Date', val: emp.hire_date || '—' },
                                            ].map(({ icon, label, val }) => (
                                                <div key={label} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px' }}>
                                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {icon} {label}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{val}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                                            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {emp.shift_type === 'first' ? '🌅 9AM–4PM' : emp.shift_type === 'second' ? '🌙 4PM–12AM' : `⚙️ ${emp.shift_start || ''}–${emp.shift_end || ''}`}
                                            </div>
                                            {emp.email && (
                                                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px', fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {emp.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ borderTop: '1px solid var(--border)', display: 'flex' }}>
                                    <button onClick={() => openEdit(emp)} style={{
                                        flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        color: 'var(--primary)', fontWeight: 700, fontSize: '0.78rem',
                                        borderRight: isAr ? 'none' : '1px solid var(--border)',
                                        borderLeft: isAr ? '1px solid var(--border)' : 'none',
                                    }}>
                                        <Edit2 size={13} />{t('common.edit')}
                                    </button>
                                    <button onClick={() => openOnboarding(emp)} style={{
                                        flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        color: '#10b981', fontWeight: 700, fontSize: '0.78rem',
                                        borderRight: isAr ? 'none' : '1px solid var(--border)',
                                        borderLeft: isAr ? '1px solid var(--border)' : 'none',
                                    }}>
                                        <ClipboardList size={13} />Onboarding
                                    </button>
                                    <button onClick={() => handleDelete(emp)} style={{
                                        flex: 1, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        color: '#ef4444', fontWeight: 700, fontSize: '0.78rem',
                                    }}>
                                        <Trash2 size={13} />{t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal modal-lg">
                        <div className="modal-header">
                            <h2 className="modal-title">{editId ? t('emp.editEmployee') : t('emp.addNew')}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('emp.firstName')} *</label>
                                    <input className="form-control" required value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">{t('emp.lastName')} *</label>
                                    <input className="form-control" required value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('emp.employeeId')} *</label>
                                    <input className="form-control" required value={form.employee_number} onChange={e => set('employee_number', e.target.value)} placeholder="EMP-001" /></div>
                                <div className="form-group"><label className="form-label">{t('emp.email')}</label>
                                    <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('emp.phone')}</label>
                                    <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">{t('emp.hireDate')} *</label>
                                    <input className="form-control" type="date" required value={form.hire_date} onChange={e => set('hire_date', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('emp.position')} *</label>
                                    <input className="form-control" required value={form.position} onChange={e => set('position', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">Job Title</label>
                                    <input className="form-control" value={form.job_title || ''} onChange={e => set('job_title', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('common.department')} *</label>
                                    <input className="form-control" required value={form.department} onChange={e => set('department', e.target.value)} list="dept-list" />
                                    <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist></div>
                                <div className="form-group"><label className="form-label">Working Shift</label>
                                    <select className="form-control" value={form.shift_type} onChange={e => {
                                        const s = e.target.value; set('shift_type', s);
                                        if (s === 'first') { set('shift_start', '09:00'); set('shift_end', '16:00'); }
                                        else if (s === 'second') { set('shift_start', '16:00'); set('shift_end', '00:00'); }
                                    }}>
                                        <option value="first">First Shift (9 AM – 4 PM)</option>
                                        <option value="second">Second Shift (4 PM – 12 AM)</option>
                                        <option value="custom">Custom (Labor)</option>
                                    </select>
                                </div>
                            </div>
                            {form.shift_type === 'custom' && (
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Custom Shift Start</label>
                                        <input className="form-control" type="time" value={form.shift_start} onChange={e => set('shift_start', e.target.value)} /></div>
                                    <div className="form-group"><label className="form-label">Custom Shift End</label>
                                        <input className="form-control" type="time" value={form.shift_end} onChange={e => set('shift_end', e.target.value)} /></div>
                                </div>
                            )}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Days Off Per Week</label>
                                    <select className="form-control" value={form.days_off_count} onChange={e => {
                                        const count = Number(e.target.value); set('days_off_count', count);
                                        if (count === 2) { set('day_off_1', 'friday'); set('day_off_2', 'saturday'); }
                                        else { set('day_off_2', null); }
                                    }}>
                                        <option value={1}>1 Day Off</option>
                                        <option value={2}>2 Days Off (Fri + Sat)</option>
                                    </select>
                                </div>
                                {(form.days_off_count === 1 || form.days_off_count === '1') ? (
                                    <div className="form-group"><label className="form-label">Day Off</label>
                                        <select className="form-control" value={form.day_off_1} onChange={e => set('day_off_1', e.target.value)}>
                                            {WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.en}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="form-group"><label className="form-label">Days Off</label>
                                        <input className="form-control" value="Friday & Saturday" disabled style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                )}
                            </div>
                            <div className="divider" />
                            <div className="form-row-3">
                                <div className="form-group"><label className="form-label">{t('emp.salaryType')}</label>
                                    <select className="form-control" value={form.salary_type} onChange={e => set('salary_type', e.target.value)}>
                                        <option value="monthly">{t('emp.monthly')}</option><option value="hourly">{t('emp.hourly')}</option></select></div>
                                <div className="form-group"><label className="form-label">{t('common.status')}</label>
                                    <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                                        <option value="active">{t('emp.active')}</option><option value="suspended">{t('emp.suspended')}</option><option value="terminated">{t('emp.terminated')}</option></select></div>
                                <div className="form-group"><label className="form-label">{t('emp.incentiveMultiplier')}</label>
                                    <input className="form-control" type="number" step="0.1" min="0" value={form.annual_incentive_multiplier} onChange={e => set('annual_incentive_multiplier', e.target.value)} placeholder="0" /></div>
                            </div>
                            <div className="form-row-3">
                                <div className="form-group"><label className="form-label">{t('emp.baseSalary')} *</label>
                                    <input className="form-control" type="number" required step="0.01" value={form.base_salary} onChange={e => set('base_salary', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">{t('emp.housingAllowance')}</label>
                                    <input className="form-control" type="number" step="0.01" value={form.housing_allowance} onChange={e => set('housing_allowance', e.target.value)} /></div>
                                <div className="form-group"><label className="form-label">{t('emp.transportAllowance')}</label>
                                    <input className="form-control" type="number" step="0.01" value={form.transport_allowance} onChange={e => set('transport_allowance', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('emp.otherAllowance')}</label>
                                    <input className="form-control" type="number" step="0.01" value={form.other_allowance} onChange={e => set('other_allowance', e.target.value)} /></div>
                                <div />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.saving') : editId ? t('emp.updateEmployee') : t('emp.addEmployee')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Onboarding Modal */}
            {onboardingEmp && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOnboardingEmp(null)}>
                    <div className="modal" style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><ClipboardList size={17} style={{ marginInlineEnd: 8 }} />Onboarding — {onboardingEmp.first_name} {onboardingEmp.last_name}</h3>
                            <button className="modal-close" onClick={() => setOnboardingEmp(null)}><X size={18} /></button>
                        </div>
                        {onboardingLoading ? (
                            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('common.loading')}</div>
                        ) : (
                            <div style={{ padding: '8px 0 16px' }}>
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Completion</span>
                                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                            {onboardingTasks.filter(t => t.completed).length}/{onboardingTasks.length} tasks
                                        </span>
                                    </div>
                                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4 }}>
                                        <div style={{ height: '100%', borderRadius: 4, background: 'var(--primary)', width: `${onboardingTasks.length ? (onboardingTasks.filter(t => t.completed).length / onboardingTasks.length) * 100 : 0}%`, transition: 'width 0.3s' }} />
                                    </div>
                                </div>
                                {onboardingTasks.map(task => (
                                    <div key={task.id} onClick={() => toggleTask(task)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${task.completed ? 'var(--primary)' : 'var(--border)'}`, background: task.completed ? 'var(--primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                            {task.completed && <Check size={13} color="white" />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.87rem', fontWeight: task.completed ? 400 : 600, color: task.completed ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                                                {task.task_name}
                                            </div>
                                            {task.completed && task.completed_by && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Done by {task.completed_by} · {task.completed_at?.slice(0, 10)}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setOnboardingEmp(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
