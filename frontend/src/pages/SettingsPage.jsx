import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsPage() {
    const { t } = useLanguage();
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
        <div style={{ maxWidth: 640 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('set.title')}</h1>
                    <p className="page-subtitle">{t('set.subtitle')}</p>
                </div>
            </div>

            <form onSubmit={handleSave}>
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header"><div className="card-title">{t('set.companyInfo')}</div></div>
                    <div className="form-group">
                        <label className="form-label">{t('set.companyName')}</label>
                        <input className="form-control" value={settings.company_name} onChange={e => set('company_name', e.target.value)} placeholder={t('set.companyPlaceholder')} />
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header"><div className="card-title">{t('set.workHours')}</div></div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('set.workStart')}</label>
                            <input className="form-control" type="time" value={settings.work_start_time} onChange={e => set('work_start_time', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('set.workEnd')}</label>
                            <input className="form-control" type="time" value={settings.work_end_time} onChange={e => set('work_end_time', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('set.breakDuration')}</label>
                            <input className="form-control" type="number" min="0" max="120" value={settings.break_duration_minutes} onChange={e => set('break_duration_minutes', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('set.lateThreshold')}</label>
                            <input className="form-control" type="number" min="0" max="60" value={settings.late_threshold_minutes} onChange={e => set('late_threshold_minutes', e.target.value)} />
                            <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>{t('set.lateHelp')}</small>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('set.workingDays')}</label>
                            <input className="form-control" type="number" min="1" max="31" value={settings.working_days_per_month} onChange={e => set('working_days_per_month', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('set.recognitionScore')}</label>
                            <input className="form-control" type="number" min="50" max="100" value={settings.recognition_threshold} onChange={e => set('recognition_threshold', e.target.value)} />
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

                <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Save size={16} />{saving ? t('common.saving') : t('set.saveSettings')}
                </button>
            </form>
        </div>
    );
}
