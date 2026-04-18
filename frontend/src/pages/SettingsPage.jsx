import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
    const { t, lang, toggleLang } = useLanguage();
    const { theme, setTheme, themes } = useTheme();
    const { role } = useAuth();
    const isAr = lang === 'ar';
    const isAdmin = role === 'admin';
    const [settings, setSettings] = useState({
        company_name: '', work_start_time: '08:00', work_end_time: '16:00',
        break_duration_minutes: '40', late_threshold_minutes: '15',
        recognition_threshold: '85', working_days_per_month: '22'
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getSettings().then(r => setSettings(s => ({ ...s, ...r.data }))).catch(() => { });
    }, []);

    const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            await updateSettings(settings);
            toast.success(t('set.successSave'));
        } catch { toast.error(t('set.errorSave')); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ maxWidth: 640 }} dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('set.title')}</h1>
                    <p className="page-subtitle">{t('set.subtitle')}</p>
                </div>
            </div>

            {/* ── Language & Appearance ─────────────────── */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-title">{isAr ? '🌐 اللغة والمظهر' : '🌐 Language & Appearance'}</div>
                </div>

                {/* Language toggle */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                        {isAr ? 'اللغة' : 'Language'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[
                            { code: 'en', label: 'English', flag: '🇬🇧' },
                            { code: 'ar', label: 'العربية', flag: '🇸🇦' },
                        ].map(({ code, label, flag }) => (
                            <button
                                key={code}
                                type="button"
                                onClick={() => lang !== code && toggleLang()}
                                style={{
                                    flex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: lang === code ? '2px solid var(--primary)' : '2px solid var(--border)',
                                    background: lang === code ? 'rgba(79,70,229,0.12)' : 'var(--surface2)',
                                    color: lang === code ? 'var(--primary-light)' : 'var(--text-muted)',
                                    fontWeight: lang === code ? 700 : 500,
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>{flag}</span>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Theme picker */}
                <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                        {isAr ? 'المظهر' : 'Theme'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {themes.map(th => (
                            <button
                                key={th.id}
                                type="button"
                                onClick={() => setTheme(th.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: theme === th.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                                    background: theme === th.id ? 'rgba(79,70,229,0.12)' : 'var(--surface2)',
                                    color: theme === th.id ? 'var(--primary-light)' : 'var(--text-muted)',
                                    fontWeight: theme === th.id ? 700 : 500,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>{th.icon}</span>
                                {isAr ? th.labelAr : th.label}
                                {theme === th.id && (
                                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'var(--primary)', color: '#fff', borderRadius: 6, padding: '2px 7px' }}>
                                        {isAr ? 'نشط' : 'Active'}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {!isAdmin && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>
                    🔒 {isAr ? 'هذه الإعدادات للعرض فقط. التعديل متاح للمسؤول فقط.' : 'View only. Only the CEO (Admin) can edit system settings.'}
                </div>
            )}

            <form onSubmit={handleSave}>
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header"><div className="card-title">{t('set.companyInfo')}</div></div>
                    <div className="form-group">
                        <label className="form-label">{t('set.companyName')}</label>
                        <input className="form-control" value={settings.company_name} onChange={e => isAdmin && set('company_name', e.target.value)} placeholder={t('set.companyPlaceholder')} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6, cursor: isAdmin ? 'text' : 'default' }} />
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header"><div className="card-title">{t('set.workHours')}</div></div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('set.workStart')}</label>
                            <input className="form-control" type="time" value={settings.work_start_time} onChange={e => isAdmin && set('work_start_time', e.target.value)} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('set.workEnd')}</label>
                            <input className="form-control" type="time" value={settings.work_end_time} onChange={e => isAdmin && set('work_end_time', e.target.value)} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6 }} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('set.breakDuration')}</label>
                            <input className="form-control" type="number" min="0" max="120" value={settings.break_duration_minutes} onChange={e => isAdmin && set('break_duration_minutes', e.target.value)} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('set.lateThreshold')}</label>
                            <input className="form-control" type="number" min="0" max="60" value={settings.late_threshold_minutes} onChange={e => isAdmin && set('late_threshold_minutes', e.target.value)} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6 }} />
                            <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>{t('set.lateHelp')}</small>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('set.workingDays')}</label>
                            <input className="form-control" type="number" min="1" max="31" value={settings.working_days_per_month} onChange={e => isAdmin && set('working_days_per_month', e.target.value)} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('set.recognitionScore')}</label>
                            <input className="form-control" type="number" min="50" max="100" value={settings.recognition_threshold} onChange={e => isAdmin && set('recognition_threshold', e.target.value)} readOnly={!isAdmin} style={{ opacity: isAdmin ? 1 : 0.6 }} />
                            <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>{t('set.recognitionHelp')}</small>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>{t('set.perfWeights')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: t('set.attScore'), max: 40, color: '#4f46e5' },
                            { label: t('set.puncScore'), max: 25, color: '#0ea5e9' },
                            { label: t('set.leaveScore'), max: 20, color: '#10b981' },
                            { label: t('set.discScore'), max: 15, color: '#f59e0b' },
                        ].map(({ label, max, color }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: '0.82rem' }}>{label}</span>
                                <strong style={{ color, fontSize: '0.9rem' }}>{max}%</strong>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {t('set.weightsNote')}
                    </div>
                </div>

                {isAdmin && <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />{saving ? t('common.saving') : t('set.saveSettings')}
                </button>}
            </form>
        </div>
    );
}
