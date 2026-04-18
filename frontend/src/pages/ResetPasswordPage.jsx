import React, { useState, useEffect } from 'react';
import client, { padPassword } from '../lib/insforge';
import Logo from '../components/Logo';
import { KeyRound, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [tokenReady, setTokenReady] = useState(false);

    // Insforge puts the reset token in the URL hash as #access_token=...
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.includes('access_token') || hash.includes('type=recovery') || window.location.search.includes('token')) {
            setTokenReady(true);
        } else {
            setError('Invalid or expired reset link. Please request a new one.');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) return setError('Password must be at least 6 characters.');
        if (password !== confirm) return setError('Passwords do not match.');
        setLoading(true);
        try {
            // Use padPassword so the stored hash matches what login sends
            const { error: err } = await client.auth.updateUser({ password: padPassword(password) });
            if (err) throw err;
            setDone(true);
        } catch (err) {
            setError(err.message || 'Failed to reset password. Try requesting a new link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', padding: 24,
        }}>
            <div style={{
                width: '100%', maxWidth: 400, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 20, padding: '40px 32px',
                boxShadow: 'var(--shadow-lg)', animation: 'slideUp 0.3s ease',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <Logo size="lg" />
                </div>

                {done ? (
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={52} color="#10b981" style={{ marginBottom: 16 }} />
                        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Password Updated!</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>
                            Your password has been changed. You can now sign in with your new password.
                        </p>
                        <a href="/" style={{
                            display: 'block', padding: '12px', borderRadius: 12, textAlign: 'center',
                            background: 'var(--primary)', color: '#fff', fontWeight: 700, textDecoration: 'none',
                        }}>
                            Go to Sign In
                        </a>
                    </div>
                ) : !tokenReady ? (
                    <div style={{ textAlign: 'center' }}>
                        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
                        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Invalid Link</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>{error}</p>
                        <a href="/" style={{
                            display: 'block', padding: '12px', borderRadius: 12, textAlign: 'center',
                            background: 'var(--primary)', color: '#fff', fontWeight: 700, textDecoration: 'none',
                        }}>
                            Back to Sign In
                        </a>
                    </div>
                ) : (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <KeyRound size={32} color="var(--primary)" style={{ marginBottom: 8 }} />
                            <h2 style={{ fontWeight: 800, marginBottom: 4 }}>Set New Password</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Enter your new password below</p>
                        </div>

                        {error && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: '#f87171', fontSize: '0.8rem' }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showPass ? 'text' : 'password'} className="form-control"
                                        value={password} onChange={e => setPassword(e.target.value)}
                                        placeholder="Min 6 characters" required style={{ width: '100%', paddingRight: 40 }} />
                                    <button type="button" onClick={() => setShowPass(v => !v)}
                                        style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <input type="password" className="form-control"
                                    value={confirm} onChange={e => setConfirm(e.target.value)}
                                    placeholder="Repeat your new password" required />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading}
                                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}>
                                <KeyRound size={16} />
                                {loading ? 'Saving...' : 'Set New Password'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
