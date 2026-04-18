import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../components/Logo';
import client from '../lib/insforge';
import { Globe, LogIn, Eye, EyeOff, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
    );
}

export default function LoginPage() {
    const { login, loginWithGoogle, loading, authError } = useAuth();
    const { lang, toggleLang } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [localError, setLocalError] = useState('');
    const [forgotMode, setForgotMode] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);

    const isAr = lang === 'ar';

    const labels = {
        title: isAr ? 'تسجيل الدخول' : 'Sign In',
        subtitle: isAr ? 'مرحباً بك في نظام بيرول برو' : 'Welcome back to PayrollPro',
        email: isAr ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or Username',
        password: isAr ? 'كلمة المرور' : 'Password',
        submit: isAr ? 'دخول' : 'Sign In',
        submitting: isAr ? 'جاري الدخول...' : 'Signing in...',
        langSwitch: isAr ? 'English' : 'العربية',
        or: isAr ? 'أو' : 'or',
        googleBtn: isAr ? 'الدخول عبر Google' : 'Continue with Google',
        googleLoading: isAr ? 'جاري التوجيه...' : 'Redirecting...',
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        if (!email || !password) {
            setLocalError(isAr ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter email and password');
            return;
        }
        setSubmitting(true);
        try {
            await login(email.trim(), password);
        } catch (err) {
            setLocalError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!resetEmail) return;
        setResetLoading(true);
        setLocalError('');
        try {
            const { error } = await client.auth.resetPassword({ email: resetEmail.trim() });
            if (error) throw error;
            setResetSent(true);
        } catch (err) {
            setLocalError(err.message || 'Failed to send reset email');
        } finally {
            setResetLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLocalError('');
        setGoogleLoading(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            setLocalError(err.message);
            setGoogleLoading(false);
        }
    };

    const errorMsg = localError || authError;

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            direction: isAr ? 'rtl' : 'ltr',
            position: 'relative',
            padding: '24px',
        }}>
            {/* Background decoration */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: '-20%', right: '-10%',
                    width: 600, height: 600, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)',
                }} />
                <div style={{
                    position: 'absolute', bottom: '-15%', left: '-8%',
                    width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)',
                }} />
            </div>

            {/* Language toggle */}
            <button
                onClick={toggleLang}
                style={{
                    position: 'absolute', top: 20,
                    right: isAr ? 'auto' : 20, left: isAr ? 20 : 'auto',
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '7px 14px',
                    color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
                <Globe size={14} /> {labels.langSwitch}
            </button>

            {/* Login card */}
            <div style={{
                width: '100%', maxWidth: 420,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '40px 36px',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative', zIndex: 1,
                animation: 'slideUp 0.3s ease',
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                    <Logo lang={lang} size="lg" />
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                        {labels.title}
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{labels.subtitle}</p>
                </div>

                {/* Error */}
                {errorMsg && (
                    <div style={{
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                        color: '#f87171', fontSize: '0.82rem', fontWeight: 500,
                    }}>
                        {errorMsg}
                    </div>
                )}

                {/* Google Button */}
                <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={googleLoading || submitting || loading}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 10, padding: '11px', borderRadius: 10, marginBottom: 4,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600,
                        cursor: googleLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.2s',
                        opacity: googleLoading ? 0.7 : 1,
                    }}
                    onMouseOver={e => { if (!googleLoading) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                    <GoogleIcon />
                    {googleLoading ? labels.googleLoading : labels.googleBtn}
                </button>

                {/* Divider */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    margin: '18px 0', color: 'var(--text-dim)', fontSize: '0.78rem',
                }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    {labels.or}
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {labels.email}
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder={isAr ? 'admin123 أو tarj123@gmail.com' : 'admin123 or your email'}
                            autoComplete="username"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {labels.password}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="form-control"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                style={{ width: '100%', paddingRight: 40 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(v => !v)}
                                style={{
                                    position: 'absolute', top: '50%', right: 10,
                                    transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-dim)', padding: 4,
                                }}
                            >
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    {/* Forgot password link */}
                    <div style={{ textAlign: isAr ? 'left' : 'right', marginTop: -8 }}>
                        <button type="button" onClick={() => { setForgotMode(true); setResetEmail(email); setLocalError(''); setResetSent(false); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
                            {isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                        </button>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting || googleLoading || loading}
                        style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '11px', fontSize: '0.9rem' }}
                    >
                        <LogIn size={16} />
                        {submitting ? labels.submitting : labels.submit}
                    </button>
                </form>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    © 2026 PayrollPro v1.0 · Technical Entrepreneurship (M. Abotargah)
                </div>
            </div>

            {/* Forgot Password overlay */}
            {forgotMode && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24,
                }}>
                    <div style={{
                        width: '100%', maxWidth: 400, background: 'var(--surface)',
                        borderRadius: 20, padding: '32px 28px', border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)', animation: 'slideUp 0.2s ease',
                    }}>
                        {resetSent ? (
                            <div style={{ textAlign: 'center' }}>
                                <CheckCircle size={48} color="#10b981" style={{ marginBottom: 16 }} />
                                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
                                    {isAr ? 'تم الإرسال!' : 'Email Sent!'}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                                    {isAr
                                        ? `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${resetEmail}. تحقق من بريدك الإلكتروني.`
                                        : `A password reset link was sent to ${resetEmail}. Check your inbox.`}
                                </p>
                                <button className="btn btn-primary" onClick={() => setForgotMode(false)} style={{ width: '100%', justifyContent: 'center' }}>
                                    {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                    <button onClick={() => setForgotMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                        <ArrowLeft size={18} />
                                    </button>
                                    <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>
                                        {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
                                    </h3>
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                                    {isAr
                                        ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.'
                                        : 'Enter your email and we\'ll send you a reset link.'}
                                </p>
                                {localError && (
                                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: '#f87171', fontSize: '0.8rem' }}>
                                        {localError}
                                    </div>
                                )}
                                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                                        </label>
                                        <input type="email" className="form-control" required value={resetEmail}
                                            onChange={e => setResetEmail(e.target.value)}
                                            placeholder="you@example.com" style={{ width: '100%' }} />
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={resetLoading}
                                        style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
                                        <Mail size={16} />
                                        {resetLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال رابط الإعادة' : 'Send Reset Link')}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
