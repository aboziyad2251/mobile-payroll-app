import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ReloadPrompt() {
    const { lang } = useLanguage();
    const isAr = lang === 'ar';
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    if (!needRefresh) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: isAr ? 'auto' : 24,
            left: isAr ? 24 : 'auto',
            zIndex: 99999,
            background: 'var(--surface)',
            border: '2px solid var(--primary)',
            padding: '16px 20px',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxWidth: 320,
            direction: isAr ? 'rtl' : 'ltr',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'var(--primary)', color: 'white', padding: 10, borderRadius: '50%', display: 'flex' }}>
                    <RefreshCw size={24} />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 800 }}>
                        {isAr ? 'تحديث متاح!' : 'Update Available!'}
                    </h4>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                        {isAr ? 'تم إطلاق إصدار جديد من التطبيق بأحدث المميزات.' : 'A new version of the app with the latest features is ready.'}
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button 
                    onClick={() => updateServiceWorker(true)}
                    style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 0', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    {isAr ? 'تحديث الآن' : 'Update Now'}
                </button>
                <button 
                    onClick={() => setNeedRefresh(false)}
                    style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <X size={18} />
                </button>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
