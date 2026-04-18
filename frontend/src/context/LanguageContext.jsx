import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => {
        const saved = localStorage.getItem('payroll_lang');
        if (saved) return saved;
        const browser = (navigator.language || '').toLowerCase();
        return browser.startsWith('ar') ? 'ar' : 'en';
    });

    useEffect(() => {
        const dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.dir = dir;
        document.documentElement.lang = lang;
        localStorage.setItem('payroll_lang', lang);
    }, [lang]);

    const t = (key, vars = {}) => {
        const str = translations[lang]?.[key] ?? translations['en']?.[key] ?? key;
        return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), str);
    };

    const toggleLang = () => setLang(l => l === 'en' ? 'ar' : 'en');
    const isRTL = lang === 'ar';

    return (
        <LanguageContext.Provider value={{ lang, t, toggleLang, isRTL }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
    return ctx;
}
