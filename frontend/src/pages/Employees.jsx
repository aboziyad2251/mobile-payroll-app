import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, ClipboardList, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getDepartments, getOnboardingTasks, createOnboardingTasks, completeOnboardingTask, uncompleteOnboardingTask } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TASKS = [
    'Send welcome email',
    'Set up workstation & equipment',
    'Add to payroll system',
    'Issue access card / ID badge',
    'Sign employment contract',
    'Complete HR paperwork',
    'Introduce to team',
    'Assign buddy / mentor',
];

const WEEKDAYS = [
    { value: 'sunday',    en: 'Sunday',    ar: 'الأحد' },
    { value: 'monday',    en: 'Monday',    ar: 'الاثنين' },
    { value: 'tuesday',   en: 'Tuesday',   ar: 'الثلاثاء' },
    { value: 'wednesday', en: 'Wednesday', ar: 'الأربعاء' },
    { value: 'thursday',  en: 'Thursday',  ar: 'الخميس' },
    { value: 'friday',    en: 'Friday',    ar: 'الجمعة' },
    { value: 'saturday',  en: 'Saturday',  ar: 'السبت' },
];

const EMPTY_FORM = {
    employee_number: '', first_name: '', last_name: '', email: '', phone: '',
    position: '', job_title: '', department: '', hire_date: '', salary_type: 'monthly',
    base_salary: '', housing_allowance: '', transport_allowance: '',
    other_allowance: '', annual_incentive_multiplier: '', status: 'active',
    shift_type: 'first', shift_start: '09:00', shift_end: '16:00',
    days_off_count: 2, day_off_1: 'friday', day_off_2: 'saturday',
};

const statusBadge = (s) => ({ active: 'badge-present', terminated: 'badge-absent', suspended: 'badge-warning' }[s] || 'badge-info');

export default function Employees({ role }) {
    const { t } = useLanguage();
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

    const load = () => {
        getEmployees({ search, department: filterDept, status: filterStatus || undefined, ids: subordinateIds })
            .then(r => setEmployees(r.data)).catch(() => { }).finally(() => setLoading(false));
    };
    useEffect(load, [search, filterDept, filterStatus]);
    useEffect(() => { getDepartments().then(r => setDepartments(r.data)).catch(() => { }); }, []);

    const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
    const openEdit = (emp) => {
        setForm({
            ...emp, base_salary: emp.base_salary || '', housing_allowance: emp.housing_allowance || '',
            transport_allowance: emp.transport_allowance || '', other_allowance: emp.other_allowance || '',
            annual_incentive_multiplier: emp.annual_incentive_multiplier || ''
        });
        setEditId(emp.id); setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (editId) { await updateEmployee(editId, form); toast.success(t('emp.editEmployee')); }
            else { await createEmployee(form); toast.success(t('emp.addEmployee')); }
            setShowModal(false); load();
        } catch (err) { toast.error(err.message || 'Error saving employee'); }
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

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('emp.title')}</h1>
                    <p className="page-subtitle">{employees.length} {t('emp.found')}</p>
                </div>
                {userRole === 'admin' && <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />{t('emp.addEmployee')}</button>}
            </div>

            <div className="filters-bar">
                <div className="search-input">
                    <Search size={15} />
                    <input className="form-control" placeholder={t('emp.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-control" style={{ width: 'auto' }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                    <option value="">{t('emp.allDepartments')}</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="form-control" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">{t('emp.allStatus')}</option>
                    <option value="active">{t('emp.active')}</option>
                    <option value="terminated">{t('emp.terminated')}</option>
                    <option value="suspended">{t('emp.suspended')}</option>
                </select>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper">
                    <table>
                        <thead><tr>
                            <th>{t('common.employee')}</th><th>{t('emp.id')}</th><th>{t('emp.position')}</th><th>{t('common.department')}</th>
                            <th>{t('emp.salaryType')}</th><th>{t('emp.baseSalary')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th>
                        </tr></thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                            ) : employees.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty-state"><Users size={40} /><p>{t('emp.noFound')}</p></div></td></tr>
                            ) : employees.map(emp => (
                                <tr key={emp.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.job_title || emp.email}</div>
                                    </td>
                                    <td><code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem' }}>{emp.employee_number}</code></td>
                                    <td>{emp.position}</td>
                                    <td>{emp.department}</td>

                                    <td>
                                        <span className="badge badge-info">{emp.salary_type === 'monthly' ? t('emp.monthly') : t('emp.hourly')}</span>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            {emp.shift_type === 'first' ? '🌅 9AM–4PM' : emp.shift_type === 'second' ? '🌙 4PM–12AM' : `⚙️ ${emp.shift_start||''}–${emp.shift_end||''}`}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{Number(emp.base_salary).toLocaleString()}</td>
                                    <td><span className={`badge ${statusBadge(emp.status)}`}>{t(`emp.${emp.status}`)}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-ghost btn-icon" onClick={() => openEdit(emp)} title={t('common.edit')}><Edit2 size={15} /></button>
                                            <button className="btn btn-ghost btn-icon" onClick={() => openOnboarding(emp)} title="Onboarding"><ClipboardList size={15} /></button>
                                            <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(emp)} title={t('common.delete')}><Trash2 size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                    <input className="form-control" value={form.job_title || ''} onChange={e => set('job_title', e.target.value)} placeholder="e.g. Senior Accountant" /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">{t('common.department')} *</label>
                                    <input className="form-control" required value={form.department} onChange={e => set('department', e.target.value)} list="dept-list" />
                                    <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist></div>
                                <div className="form-group"><label className="form-label">Working Shift</label>
                                    <select className="form-control" value={form.shift_type} onChange={e => {
                                        const s = e.target.value;
                                        set('shift_type', s);
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
                            {/* Days Off */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Days Off Per Week</label>
                                    <select className="form-control" value={form.days_off_count} onChange={e => {
                                        const count = Number(e.target.value);
                                        set('days_off_count', count);
                                        if (count === 2) { set('day_off_1', 'friday'); set('day_off_2', 'saturday'); }
                                        else { set('day_off_2', null); }
                                    }}>
                                        <option value={1}>1 Day Off</option>
                                        <option value={2}>2 Days Off (Fri + Sat)</option>
                                    </select>
                                </div>
                                {form.days_off_count === 1 || form.days_off_count === '1' ? (
                                    <div className="form-group">
                                        <label className="form-label">Day Off</label>
                                        <select className="form-control" value={form.day_off_1} onChange={e => set('day_off_1', e.target.value)}>
                                            {WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.en}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Days Off</label>
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
                                {/* Progress bar */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Completion</span>
                                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                            {onboardingTasks.filter(t => t.completed).length}/{onboardingTasks.length} tasks
                                        </span>
                                    </div>
                                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4 }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4, background: 'var(--primary)',
                                            width: `${onboardingTasks.length ? (onboardingTasks.filter(t => t.completed).length / onboardingTasks.length) * 100 : 0}%`,
                                            transition: 'width 0.3s'
                                        }} />
                                    </div>
                                </div>
                                {/* Task list */}
                                {onboardingTasks.map(task => (
                                    <div key={task.id} onClick={() => toggleTask(task)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                                        <div style={{
                                            width: 22, height: 22, borderRadius: 6, border: `2px solid ${task.completed ? 'var(--primary)' : 'var(--border)'}`,
                                            background: task.completed ? 'var(--primary)' : 'transparent', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                        }}>
                                            {task.completed && <Check size={13} color="white" />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.87rem', fontWeight: task.completed ? 400 : 600, color: task.completed ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                                                {task.task_name}
                                            </div>
                                            {task.completed && task.completed_by && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                    Done by {task.completed_by} · {task.completed_at?.slice(0, 10)}
                                                </div>
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
