import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import client, { adminCreateAuthUser } from '../lib/insforge';
import { getEmployees } from '../services/api';
import { UserPlus, Trash2, ShieldCheck, Users, Search, X, UsersRound, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const SUPER_ADMIN_EMAIL = 'tarj123@gmail.com';
const ROLES = ['admin', 'manager', 'employee', 'pending'];

const ROLE_LABELS = {
    en: { admin: 'CEO', manager: 'Manager', employee: 'Employee', pending: 'Pending' },
    ar: { admin: 'الرئيس التنفيذي', manager: 'مدير', employee: 'موظف', pending: 'في الانتظار' },
};

const ROLE_COLORS = {
    admin:    { bg: 'rgba(79,70,229,0.15)',  color: '#818cf8' },
    manager:  { bg: 'rgba(14,165,233,0.15)', color: '#38bdf8' },
    employee: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    pending:  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
};

const db = client.database;

export default function UsersPage() {
    const { lang } = useLanguage();
    const isAr = lang === 'ar';
    const rl = ROLE_LABELS[lang] || ROLE_LABELS.en;

    const [users, setUsers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Create user modal
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ email: '', password: '', role: 'employee', full_name: '', manager_title: '', employee_id: '' });
    const [submitting, setSubmitting] = useState(false);

    // Subordinates panel
    const [subManager, setSubManager] = useState(null); // user object whose subordinates we're editing
    const [subSelected, setSubSelected] = useState([]); // employee ids selected
    const [subLoading, setSubLoading] = useState(false);
    const [subSaving, setSubSaving] = useState(false);

    const fetchUsers = async () => {
        const { data, error } = await db.from('app_users').select('*');
        if (error) { console.error('fetchUsers error:', error); return; }
        // Sort by created_at descending in JS (avoid DB column dependency)
        const sorted = (data || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setUsers(sorted);
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await fetchUsers();
            try { const { data } = await getEmployees(); setEmployees(data || []); } catch {}
            setLoading(false);
        })();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.email || !form.password) return toast.error(isAr ? 'البريد وكلمة المرور مطلوبان' : 'Email and password required');
        setSubmitting(true);
        try {
            // Use raw fetch to create auth user WITHOUT disrupting the admin's session
            await adminCreateAuthUser(form.email, form.password);

            // Check if profile already exists, then upsert
            const { data: existing } = await db.from('app_users').select('id').eq('email', form.email).maybeSingle();
            if (existing) {
                // Update the existing profile
                const { error: updateError } = await db.from('app_users').update({
                    role: form.role,
                    full_name: form.full_name || form.email,
                }).eq('email', form.email);
                if (updateError) throw new Error('Profile update failed: ' + (updateError.message || JSON.stringify(updateError)));
            } else {
                // Insert new profile — only with base columns that always exist
                const profileRow = { email: form.email, role: form.role, full_name: form.full_name || form.email };
                // Conditionally add optional columns
                if (form.role === 'manager' && form.manager_title) profileRow.manager_title = form.manager_title;
                if (form.employee_id) profileRow.employee_id = form.employee_id;

                const { error: insertError } = await db.from('app_users').insert([profileRow]);
                if (insertError) {
                    // If still 400, retry with only base columns (optional columns may not exist)
                    if (insertError.message?.includes('400') || insertError.code === '400') {
                        const { error: retryError } = await db.from('app_users').insert([{
                            email: form.email, role: form.role, full_name: form.full_name || form.email,
                        }]);
                        if (retryError) throw new Error('Profile insert failed: ' + (retryError.message || JSON.stringify(retryError)));
                    } else {
                        throw new Error('Profile insert failed: ' + (insertError.message || JSON.stringify(insertError)));
                    }
                }
            }

            toast.success(isAr ? 'تم إنشاء المستخدم' : 'User created');
            setShowModal(false);
            setForm({ email: '', password: '', role: 'employee', full_name: '', manager_title: '', employee_id: '' });
            await fetchUsers();
        } catch (err) { toast.error(err.message); }
        finally { setSubmitting(false); }
    };

    const handleRoleChange = async (id, newRole, email) => {
        if (email === SUPER_ADMIN_EMAIL) return toast.error(isAr ? 'لا يمكن تغيير صلاحيات CEO' : 'Cannot change CEO role');
        const { error } = await db.from('app_users').update({ role: newRole }).eq('id', id);
        if (error) return toast.error(error.message);
        toast.success(isAr ? 'تم تحديث الصلاحية' : 'Role updated');
        setUsers(u => u.map(x => x.id === id ? { ...x, role: newRole } : x));
    };

    const handleDelete = async (id, email) => {
        if (email === SUPER_ADMIN_EMAIL) return toast.error(isAr ? 'لا يمكن حذف CEO' : 'Cannot delete CEO');
        if (!window.confirm(isAr ? `حذف ${email}؟` : `Delete ${email}?`)) return;
        await db.from('app_users').delete().eq('id', id);
        await db.from('manager_subordinates').delete().eq('manager_user_id', id);
        toast.success(isAr ? 'تم الحذف' : 'Deleted');
        setUsers(u => u.filter(x => x.id !== id));
    };

    const openSubordinates = async (user) => {
        setSubManager(user);
        setSubLoading(true);
        try {
            const { data } = await db.from('manager_subordinates').select('employee_id').eq('manager_user_id', user.id);
            setSubSelected((data || []).map(r => r.employee_id));
        } catch { setSubSelected([]); }
        finally { setSubLoading(false); }
    };

    const toggleSub = (empId) => {
        setSubSelected(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
    };

    const saveSubordinates = async () => {
        setSubSaving(true);
        try {
            await db.from('manager_subordinates').delete().eq('manager_user_id', subManager.id);
            if (subSelected.length > 0) {
                await db.from('manager_subordinates').insert(subSelected.map(emp_id => ({ manager_user_id: subManager.id, employee_id: emp_id })));
            }
            toast.success(isAr ? 'تم حفظ المرؤوسين' : 'Subordinates saved');
            setSubManager(null);
        } catch (e) { toast.error(e.message); }
        finally { setSubSaving(false); }
    };

    const filtered = users.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h2 className="page-title">
                        <Users size={22} style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {isAr ? 'إدارة المستخدمين' : 'User Management'}
                    </h2>
                    <p className="page-subtitle">{isAr ? 'إدارة الحسابات والصلاحيات والمرؤوسين' : 'Manage accounts, roles and subordinates'}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <UserPlus size={16} /> {isAr ? 'مستخدم جديد' : 'New User'}
                </button>
            </div>

            <div className="card">
                <div className="filters-bar" style={{ marginBottom: 16 }}>
                    <div className="search-input">
                        <Search size={15} />
                        <input className="form-control" placeholder={isAr ? 'بحث...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ marginInlineStart: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{filtered.length} {isAr ? 'مستخدم' : 'users'}</div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>{isAr ? 'الاسم' : 'Name'}</th>
                                <th>{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                                <th>{isAr ? 'الصلاحية' : 'Role'}</th>
                                <th>{isAr ? 'اللقب' : 'Title'}</th>
                                <th>{isAr ? 'تاريخ الإنشاء' : 'Created'}</th>
                                <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
                            </tr></thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{isAr ? 'لا توجد مستخدمين' : 'No users found'}</td></tr>
                                ) : filtered.map(u => {
                                    const rc = ROLE_COLORS[u.role] || ROLE_COLORS.employee;
                                    const isSuperAdmin = u.email === SUPER_ADMIN_EMAIL;
                                    return (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                                                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{u.full_name || '—'}</div>
                                                        {isSuperAdmin && <div style={{ fontSize: '0.65rem', color: '#818cf8', fontWeight: 700 }}>SUPER ADMIN</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                                            <td>
                                                {isSuperAdmin ? (
                                                    <span style={{ background: rc.bg, color: rc.color, fontWeight: 700, fontSize: '0.78rem', borderRadius: 6, padding: '4px 10px' }}>{rl[u.role]}</span>
                                                ) : (
                                                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value, u.email)}
                                                        style={{ border: 'none', background: rc.bg, color: rc.color, fontWeight: 700, fontSize: '0.78rem', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        {ROLES.map(r => <option key={r} value={r}>{rl[r]}</option>)}
                                                    </select>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{u.manager_title || '—'}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {u.role === 'manager' && (
                                                        <button className="btn btn-ghost btn-sm" title={isAr ? 'إدارة المرؤوسين' : 'Manage Subordinates'} onClick={() => openSubordinates(u)} style={{ color: '#38bdf8' }}>
                                                            <UsersRound size={15} />
                                                        </button>
                                                    )}
                                                    {!isSuperAdmin && (
                                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u.id, u.email)} style={{ color: 'var(--danger)' }}>
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title"><ShieldCheck size={18} style={{ marginInlineEnd: 8 }} />{isAr ? 'مستخدم جديد' : 'New User'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-group">
                                <label className="form-label">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                                <input className="form-control" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{isAr ? 'البريد الإلكتروني' : 'Email'} *</label>
                                <input type="email" className="form-control" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{isAr ? 'كلمة المرور' : 'Password'} *</label>
                                <input type="password" className="form-control" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{isAr ? 'الصلاحية' : 'Role'}</label>
                                <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    {ROLES.map(r => <option key={r} value={r}>{rl[r]}</option>)}
                                </select>
                            </div>
                            {form.role === 'manager' && (
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'لقب المدير' : 'Manager Title'}</label>
                                    <input className="form-control" value={form.manager_title} onChange={e => setForm(f => ({ ...f, manager_title: e.target.value }))} placeholder="e.g. HR Manager, Operations Director" />
                                </div>
                            )}
                            {(form.role === 'employee' || form.role === 'manager') && (
                                <div className="form-group">
                                    <label className="form-label">{isAr ? 'ربط بسجل موظف' : 'Link to Employee Record'}</label>
                                    <select className="form-control" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
                                        <option value="">{isAr ? '— بدون ربط —' : '— None —'}</option>
                                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_number})</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="modal-footer" style={{ paddingTop: 8 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    <UserPlus size={15} /> {submitting ? (isAr ? 'جاري...' : 'Creating...') : (isAr ? 'إنشاء' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Subordinates Modal */}
            {subManager && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSubManager(null)}>
                    <div className="modal" style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><UsersRound size={17} style={{ marginInlineEnd: 8 }} />{isAr ? 'مرؤوسو' : 'Subordinates of'} {subManager.full_name}</h3>
                            <button className="modal-close" onClick={() => setSubManager(null)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '8px 0 4px' }}>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                                {isAr ? 'اختر الموظفين الذين يشرف عليهم هذا المدير' : 'Select employees this manager oversees'}
                            </p>
                            {subLoading ? (
                                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
                            ) : (
                                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {employees.map(emp => {
                                        const checked = subSelected.includes(emp.id);
                                        return (
                                            <div key={emp.id} onClick={() => toggleSub(emp.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: checked ? 'rgba(79,70,229,0.08)' : 'var(--surface2)', border: checked ? '1px solid var(--primary)' : '1px solid transparent', transition: 'all 0.15s' }}>
                                                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, background: checked ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                                                    {checked && <Check size={12} color="white" />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{emp.first_name} {emp.last_name}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.employee_number} · {emp.department} · {emp.position}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {subSelected.length} {isAr ? 'موظف مختار' : 'selected'}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSubManager(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                            <button className="btn btn-primary" onClick={saveSubordinates} disabled={subSaving}>
                                {subSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
