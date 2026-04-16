import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, X, User, Mail, Phone, ChevronRight, ChevronLeft, Check, Trash2, FileText, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import {
    getJobPostings, createJobPosting, updateJobPosting, deleteJobPosting,
    getApplicants, createApplicant, updateApplicant, deleteApplicant
} from '../services/api';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const STAGE_META = {
    applied:   { en: 'Applied',    ar: 'تقدّم',        color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
    screening: { en: 'Screening',  ar: 'الفرز',        color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
    interview: { en: 'Interview',  ar: 'المقابلة',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    offer:     { en: 'Offer',      ar: 'عرض العمل',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    hired:     { en: 'Hired',      ar: 'تم التعيين',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    rejected:  { en: 'Rejected',   ar: 'مرفوض',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const EMPTY_APP = { full_name: '', email: '', phone: '', cv_url: '', notes: '', stage: 'applied', job_id: '' };
const EMPTY_JOB = { title: '', department: '', description: '', status: 'open' };

export default function Recruitment() {
    const { lang } = useLanguage();
    const isAr = lang === 'ar';
    const t = (en, ar) => isAr ? ar : en;

    const [jobs, setJobs] = useState([]);
    const [applicants, setApplicants] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modals
    const [jobModal, setJobModal] = useState(false);
    const [jobForm, setJobForm] = useState(EMPTY_JOB);
    const [editingJob, setEditingJob] = useState(null);
    const [appModal, setAppModal] = useState(false);
    const [appForm, setAppForm] = useState(EMPTY_APP);
    const [detailApplicant, setDetailApplicant] = useState(null);
    const [savingJob, setSavingJob] = useState(false);
    const [savingApp, setSavingApp] = useState(false);

    const loadJobs = async () => {
        setLoading(true);
        try {
            const r = await getJobPostings();
            setJobs(r.data || []);
            if (!selectedJob && r.data?.length) setSelectedJob(r.data[0]);
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    const loadApplicants = async (jobId) => {
        if (!jobId) return;
        try {
            const r = await getApplicants(jobId);
            setApplicants(r.data || []);
        } catch (e) { toast.error(e.message); }
    };

    useEffect(() => { loadJobs(); }, []);
    useEffect(() => { if (selectedJob) loadApplicants(selectedJob.id); }, [selectedJob]);

    const handleSaveJob = async () => {
        if (!jobForm.title || !jobForm.department) return toast.error(t('Title and department required', 'العنوان والقسم مطلوبان'));
        setSavingJob(true);
        try {
            if (editingJob) { await updateJobPosting(editingJob.id, jobForm); toast.success(t('Job updated', 'تم تحديث الوظيفة')); }
            else { await createJobPosting(jobForm); toast.success(t('Job posted', 'تم نشر الوظيفة')); }
            setJobModal(false); setJobForm(EMPTY_JOB); setEditingJob(null);
            await loadJobs();
        } catch (e) { toast.error(e.message); }
        finally { setSavingJob(false); }
    };

    const handleDeleteJob = async (id) => {
        if (!window.confirm(t('Delete this job posting?', 'حذف هذا الإعلان الوظيفي؟'))) return;
        try { await deleteJobPosting(id); toast.success(t('Deleted', 'تم الحذف')); if (selectedJob?.id === id) setSelectedJob(null); await loadJobs(); }
        catch (e) { toast.error(e.message); }
    };

    const handleSaveApp = async () => {
        if (!appForm.full_name) return toast.error(t('Name required', 'الاسم مطلوب'));
        setSavingApp(true);
        try {
            await createApplicant({ ...appForm, job_id: selectedJob?.id });
            toast.success(t('Applicant added', 'تم إضافة المتقدم'));
            setAppModal(false); setAppForm(EMPTY_APP);
            await loadApplicants(selectedJob?.id);
        } catch (e) { toast.error(e.message); }
        finally { setSavingApp(false); }
    };

    const moveStage = async (applicant, direction) => {
        const idx = STAGES.indexOf(applicant.stage);
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= STAGES.length) return;
        const newStage = STAGES[nextIdx];
        try {
            await updateApplicant(applicant.id, { stage: newStage });
            setApplicants(prev => prev.map(a => a.id === applicant.id ? { ...a, stage: newStage } : a));
            if (detailApplicant?.id === applicant.id) setDetailApplicant({ ...detailApplicant, stage: newStage });
        } catch (e) { toast.error(e.message); }
    };

    const handleDeleteApp = async (id) => {
        if (!window.confirm(t('Remove this applicant?', 'حذف هذا المتقدم؟'))) return;
        try {
            await deleteApplicant(id);
            setApplicants(prev => prev.filter(a => a.id !== id));
            if (detailApplicant?.id === id) setDetailApplicant(null);
        } catch (e) { toast.error(e.message); }
    };

    const stageApplicants = (stage) => applicants.filter(a => a.stage === stage);

    return (
        <div dir={isAr ? 'rtl' : 'ltr'}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Briefcase size={22} style={{ display: 'inline', marginInlineEnd: 8 }} />
                        {t('Recruitment', 'التوظيف')}
                    </h1>
                    <p className="page-subtitle">{t('Manage job postings and applicant pipeline', 'إدارة الإعلانات الوظيفية وخط سير المتقدمين')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setJobForm(EMPTY_JOB); setEditingJob(null); setJobModal(true); }}>
                    <Plus size={15} /> {t('Post Job', 'نشر وظيفة')}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
                {/* Jobs sidebar */}
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>
                        {t('Job Postings', 'الوظائف المتاحة')}
                    </div>
                    {loading ? (
                        <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>{t('Loading…', 'جاري التحميل…')}</div>
                    ) : jobs.length === 0 ? (
                        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Briefcase size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                            <p style={{ fontSize: '0.85rem' }}>{t('No jobs yet', 'لا توجد وظائف بعد')}</p>
                        </div>
                    ) : jobs.map(job => (
                        <div key={job.id} onClick={() => setSelectedJob(job)}
                            className="card"
                            style={{
                                padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
                                border: selectedJob?.id === job.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: selectedJob?.id === job.id ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{job.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{job.department}</div>
                                    <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: job.status === 'open' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)', color: job.status === 'open' ? '#10b981' : '#64748b' }}>
                                            {job.status === 'open' ? t('Open', 'مفتوح') : t('Closed', 'مغلق')}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                            {applicants.filter(a => a.job_id === job.id || selectedJob?.id === job.id).length} {t('applicants', 'متقدم')}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-sm btn-ghost" style={{ padding: '4px 6px' }} onClick={e => { e.stopPropagation(); setEditingJob(job); setJobForm(job); setJobModal(true); }}>
                                        ✏️
                                    </button>
                                    <button className="btn btn-sm btn-ghost" style={{ padding: '4px 6px', color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); handleDeleteJob(job.id); }}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pipeline */}
                <div>
                    {!selectedJob ? (
                        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Briefcase size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <p>{t('Select a job to view applicants', 'اختر وظيفة لعرض المتقدمين')}</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{selectedJob.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedJob.department} · {applicants.length} {t('applicants', 'متقدم')}</div>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => { setAppForm({ ...EMPTY_APP, job_id: selectedJob.id }); setAppModal(true); }}>
                                    <UserPlus size={14} /> {t('Add Applicant', 'إضافة متقدم')}
                                </button>
                            </div>

                            {/* Kanban board */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, overflowX: 'auto' }}>
                                {STAGES.map(stage => {
                                    const meta = STAGE_META[stage];
                                    const stageApps = stageApplicants(stage);
                                    return (
                                        <div key={stage} style={{ minWidth: 140 }}>
                                            <div style={{ padding: '6px 10px', borderRadius: 8, background: meta.bg, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.75rem', color: meta.color }}>{meta[lang] || meta.en}</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: meta.color, color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stageApps.length}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {stageApps.map(app => (
                                                    <div key={app.id} className="card" style={{ padding: '10px 12px', cursor: 'pointer', borderLeft: `3px solid ${meta.color}` }}
                                                        onClick={() => setDetailApplicant(app)}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 2 }}>{app.full_name}</div>
                                                        {app.email && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.email}</div>}
                                                        <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'space-between' }}>
                                                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                                                                onClick={e => { e.stopPropagation(); moveStage(app, -1); }}
                                                                disabled={STAGES.indexOf(app.stage) === 0}>
                                                                <ChevronLeft size={11} />
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                                                                onClick={e => { e.stopPropagation(); moveStage(app, 1); }}
                                                                disabled={STAGES.indexOf(app.stage) === STAGES.length - 1}>
                                                                <ChevronRight size={11} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Job Modal */}
            {jobModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setJobModal(false)}>
                    <div className="modal" style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><Briefcase size={17} style={{ marginInlineEnd: 8 }} />{editingJob ? t('Edit Job', 'تعديل الوظيفة') : t('Post New Job', 'نشر وظيفة جديدة')}</h3>
                            <button className="modal-close" onClick={() => setJobModal(false)}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px' }}>
                            <div className="form-group">
                                <label className="form-label">{t('Job Title', 'المسمى الوظيفي')} *</label>
                                <input className="form-control" value={jobForm.title} onChange={e => setJobForm(p => ({ ...p, title: e.target.value }))} placeholder={t('e.g. Senior Accountant', 'مثال: محاسب أول')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Department', 'القسم')} *</label>
                                <input className="form-control" value={jobForm.department} onChange={e => setJobForm(p => ({ ...p, department: e.target.value }))} placeholder={t('e.g. Finance', 'مثال: المالية')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Description / Requirements', 'الوصف / المتطلبات')}</label>
                                <textarea className="form-control" rows={3} value={jobForm.description} onChange={e => setJobForm(p => ({ ...p, description: e.target.value }))} placeholder={t('Describe the role…', 'صف الدور الوظيفي…')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Status', 'الحالة')}</label>
                                <select className="form-control" value={jobForm.status} onChange={e => setJobForm(p => ({ ...p, status: e.target.value }))}>
                                    <option value="open">{t('Open', 'مفتوح')}</option>
                                    <option value="closed">{t('Closed', 'مغلق')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setJobModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" onClick={handleSaveJob} disabled={savingJob}>{savingJob ? t('Saving…', 'جاري الحفظ…') : t('Save', 'حفظ')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Applicant Modal */}
            {appModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAppModal(false)}>
                    <div className="modal" style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><UserPlus size={17} style={{ marginInlineEnd: 8 }} />{t('Add Applicant', 'إضافة متقدم')}</h3>
                            <button className="modal-close" onClick={() => setAppModal(false)}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px' }}>
                            <div className="form-group">
                                <label className="form-label">{t('Full Name', 'الاسم الكامل')} *</label>
                                <input className="form-control" value={appForm.full_name} onChange={e => setAppForm(p => ({ ...p, full_name: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{t('Email', 'البريد الإلكتروني')}</label>
                                    <input className="form-control" type="email" value={appForm.email} onChange={e => setAppForm(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Phone', 'الهاتف')}</label>
                                    <input className="form-control" value={appForm.phone} onChange={e => setAppForm(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('CV / Resume Link', 'رابط السيرة الذاتية')}</label>
                                <input className="form-control" placeholder="https://…" value={appForm.cv_url} onChange={e => setAppForm(p => ({ ...p, cv_url: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Initial Stage', 'المرحلة الأولى')}</label>
                                <select className="form-control" value={appForm.stage} onChange={e => setAppForm(p => ({ ...p, stage: e.target.value }))}>
                                    {STAGES.filter(s => s !== 'rejected').map(s => <option key={s} value={s}>{STAGE_META[s].en}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Notes', 'ملاحظات')}</label>
                                <textarea className="form-control" rows={2} value={appForm.notes} onChange={e => setAppForm(p => ({ ...p, notes: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setAppModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" onClick={handleSaveApp} disabled={savingApp}>{savingApp ? t('Saving…', 'جاري الحفظ…') : t('Add', 'إضافة')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Applicant Detail Drawer */}
            {detailApplicant && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailApplicant(null)}>
                    <div className="modal" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title"><User size={17} style={{ marginInlineEnd: 8 }} />{detailApplicant.full_name}</h3>
                            <button className="modal-close" onClick={() => setDetailApplicant(null)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '8px 0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Stage badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6, background: STAGE_META[detailApplicant.stage]?.bg, color: STAGE_META[detailApplicant.stage]?.color }}>
                                    {STAGE_META[detailApplicant.stage]?.[lang] || STAGE_META[detailApplicant.stage]?.en}
                                </span>
                                <button className="btn btn-sm btn-ghost" onClick={() => moveStage(detailApplicant, -1)} disabled={STAGES.indexOf(detailApplicant.stage) === 0}><ChevronLeft size={14} /></button>
                                <button className="btn btn-sm btn-ghost" onClick={() => moveStage(detailApplicant, 1)} disabled={STAGES.indexOf(detailApplicant.stage) === STAGES.length - 1}><ChevronRight size={14} /></button>
                            </div>
                            {detailApplicant.email && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}><Mail size={14} color="var(--text-muted)" />{detailApplicant.email}</div>}
                            {detailApplicant.phone && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}><Phone size={14} color="var(--text-muted)" />{detailApplicant.phone}</div>}
                            {detailApplicant.cv_url && <a href={detailApplicant.cv_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ width: 'fit-content' }}><FileText size={13} /> {t('View CV', 'عرض السيرة الذاتية')}</a>}
                            {detailApplicant.notes && (
                                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.83rem', color: 'var(--text-muted)' }}>{detailApplicant.notes}</div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteApp(detailApplicant.id)}><Trash2 size={13} /> {t('Remove', 'حذف')}</button>
                            <button className="btn btn-secondary" onClick={() => setDetailApplicant(null)}>{t('Close', 'إغلاق')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
