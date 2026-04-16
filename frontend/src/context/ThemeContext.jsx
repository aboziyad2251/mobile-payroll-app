import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const THEMES = [
    { id: 'dark', label: 'Dark', labelAr: 'داكن', icon: '◗' },
    { id: 'light', label: 'Light', labelAr: 'فاتح', icon: '☀' },
    { id: 'corporate', label: 'Blue', labelAr: 'أزرق', icon: '●' },
];

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(
        () => localStorage.getItem('pp-theme') || 'dark'
    );

    const setTheme = (id) => {
        setThemeState(id);
        localStorage.setItem('pp-theme', id);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Set on first mount immediately
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
    return ctx;
}
