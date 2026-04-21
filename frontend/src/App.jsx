import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './components/PageTransition';
import { Toaster } from 'react-hot-toast';
import {
    LayoutDashboard, Users, Clock, AlertTriangle,
    TrendingUp, DollarSign, Settings, Menu, Globe,
    LogOut, User, ShieldCheck, CalendarDays, BarChart2, Briefcase, CalendarRange,
    Bell, CheckCheck, CalendarCheck, CalendarX,
    Search, LayoutGrid, ShoppingCart, Fingerprint
} from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { syncOfflineQueue } from './services/offlineSync';
import * as api from './services/api';
import client from './lib/insforge';

import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Warnings from './pages/Warnings';
import Performance from './pages/Performance';
import Payroll from './pages/Payroll';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EmployeePortal from './pages/EmployeePortal';
import UsersPage from './pages/UsersPage';
import LeaveManagement from './pages/LeaveManagement';
import Reports from './pages/Reports';
import Recruitment from './pages/Recruitment';
import Schedule from './pages/Schedule';

import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import Logo from './components/Logo';
import ReloadPrompt from './components/ReloadPrompt';

// Nav items visible to admin + manager
const navItems = [
    { icon: LayoutDashboard, labelKey: 'nav.dashboard', to: '/', section: 'main' },
    { icon: Users, labelKey: 'nav.employees', to: '/employees', section: 'main' },
    { icon: Clock, labelKey: 'nav.attendance', to: '/attendance', section: 'hr' },
    { icon: CalendarDays, labelKey: 'nav.leaves', to: '/leaves', section: 'hr' },
    { icon: AlertTriangle, labelKey: 'nav.warnings', to: '/warnings', section: 'hr' },
    { icon: TrendingUp, labelKey: 'nav.performance', to: '/performance', section: 'hr' },
    { icon: DollarSign, labelKey: 'nav.payroll', to: '/payroll', section: 'finance' },
    { icon: BarChart2, labelKey: 'nav.reports', to: '/reports', section: 'finance' },
    { icon: Briefcase, labelKey: 'nav.recruitment', to: '/recruitment', section: 'hr' },
    { icon: CalendarRange, labelKey: 'nav.schedule', to: '/schedule', section: 'hr' },
    { icon: Settings, labelKey: 'nav.settings', to: '/settings', section: 'system' },
];

// Admin-only nav
const adminNav = { icon: ShieldCheck, labelKey: 'nav.users', to: '/users', section: 'system' };

const sectionKeys = { main: 'nav.overview', hr: 'nav.hr', finance: 'nav.finance', system: 'nav.system' };

function Sidebar({ open, onClose }) {
    const { t, toggleLang, lang } = useLanguage();
    const { theme, setTheme, themes } = useTheme();
    const { role, fullName, logout, appUserId } = useAuth();
    const { notifs = [], showNotifs, setShowNotifs, markAllRead, markRead, loadNotifications } = useAppStore();
    const notifRef = useRef(null);
    const unreadCount = Array.isArray(notifs) ? notifs.filter(n => !n.is_read).length : 0;

    useEffect(() => {
        if (!appUserId || role === 'employee') return;
        loadNotifications(appUserId);
        
        // Use polling instead of failing realtime channel for stability
        const timer = setInterval(() => loadNotifications(appUserId), 60000);
        return () => clearInterval(timer);
    }, [appUserId, role, loadNotifications]);

    useEffect(() => {
        const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [setShowNotifs]);

    const handleMarkAllRead = async () => {
        await markAllRead(appUserId);
    };

    const handleNotifClick = async (notif) => {
        if (!notif.is_read) {
            await markRead(notif.id);
        }
        setShowNotifs(false);
    };

    const notifIcon = (type) => {
        if (type === 'leave_approved') return <CalendarCheck size={14} color="#10b981" />;
        if (type === 'leave_rejected') return <CalendarX size={14} color="#ef4444" />;
        return <CalendarDays size={14} color="#6366f1" />;
    };

    const allNav = role === 'admin'
        ? [...navItems.slice(0, -1), adminNav, navItems[navItems.length - 1]]
        : navItems;

    const sections = [...new Set(allNav.map(n => n.section))];

    return (
        <aside className={`sidebar ${open ? 'open' : ''}`}>
            <div className="sidebar-logo">
                <Logo lang={lang} size="md" />
                <span style={{ marginTop: 4 }}>{t('app.tagline')}</span>
            </div>

            {/* User badge */}
            <div style={{
                padding: '10px 16px 8px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
            }}>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <User size={15} color="white" />
                </div>
                <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fullName}
                    </div>
                    <div style={{
                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: role === 'admin' ? '#818cf8' : role === 'manager' ? '#38bdf8' : '#34d399',
                    }}>
                        {role === 'admin' ? (lang === 'ar' ? 'الرئيس التنفيذي' : 'CEO')
                            : role === 'manager' ? (lang === 'ar' ? 'مدير' : 'Manager')
                                : (lang === 'ar' ? 'موظف' : 'Employee')}
                    </div>
                </div>
            </div>

            {/* Notification Bell */}
            {role !== 'employee' && (
                <div ref={notifRef} style={{ position: 'relative', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setShowNotifs(v => !v)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                            background: showNotifs ? 'var(--surface2)' : 'transparent',
                            border: '1px solid var(--border)', borderRadius: 8,
                            padding: '7px 10px', cursor: 'pointer', color: 'var(--text)',
                            fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600,
                        }}
                    >
                        <Bell size={16} color={unreadCount > 0 ? '#6366f1' : 'var(--text-muted)'} />
                        <span style={{ flex: 1, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                            {lang === 'ar' ? 'الإشعارات' : 'Notifications'}
                        </span>
                        {unreadCount > 0 && (
                            <span style={{
                                background: '#6366f1', color: 'white', borderRadius: '999px',
                                fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                            }}>{unreadCount}</span>
                        )}
                    </button>

                    {showNotifs && (
                        <div style={{
                            position: 'absolute', left: 8, right: 8, top: '100%', zIndex: 9999,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                            maxHeight: 340, display: 'flex', flexDirection: 'column',
                        }}>
                            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</span>
                                {unreadCount > 0 && (
                                    <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                                        <CheckCheck size={13} /> {lang === 'ar' ? 'قراءة الكل' : 'Mark all read'}
                                    </button>
                                )}
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {notifs.length === 0 ? (
                                    <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        {lang === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
                                    </div>
                                ) : notifs.map(n => (
                                    <button key={n.id} onClick={() => handleNotifClick(n)} style={{
                                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                                        padding: '10px 14px', background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.07)',
                                        border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                        textAlign: lang === 'ar' ? 'right' : 'left', fontFamily: 'inherit',
                                    }}>
                                        <span style={{ marginTop: 2, flexShrink: 0 }}>{notifIcon(n.type)}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 3 }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                                        </div>
                                        {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 5 }} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <nav className="sidebar-nav">
                {sections.map(section => (
                    <div key={section}>
                        <div className="nav-section-title">{t(sectionKeys[section])}</div>
                        {allNav.filter(n => n.section === section).map(({ icon: Icon, labelKey, to }) => (
                            <NavLink
                                key={to} to={to} end={to === '/'}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                onClick={onClose}
                            >
                                <Icon className="nav-icon" size={18} />
                                {t(labelKey)}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                {/* Theme Switcher */}
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>
                        {lang === 'ar' ? 'المظهر' : 'THEME'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {themes.map(th => (
                            <button key={th.id} onClick={() => setTheme(th.id)} title={lang === 'ar' ? th.labelAr : th.label}
                                style={{
                                    flex: 1, padding: '7px 4px', borderRadius: 8,
                                    border: theme === th.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                                    background: theme === th.id ? 'rgba(79,70,229,0.15)' : 'var(--surface2)',
                                    color: theme === th.id ? 'var(--primary-light)' : 'var(--text-dim)',
                                    fontSize: '0.78rem', fontWeight: theme === th.id ? 700 : 500,
                                    cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                }}
                            >
                                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{th.icon}</span>
                                <span style={{ fontSize: '0.65rem' }}>{lang === 'ar' ? th.labelAr : th.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language Toggle */}
                <button onClick={toggleLang} className="lang-toggle-btn"
                    title={lang === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
                >
                    <Globe size={16} />
                    <span>{lang === 'en' ? 'العربية' : 'English'}</span>
                </button>

                {/* Logout */}
                <button onClick={logout} className="lang-toggle-btn" style={{ marginTop: 8, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                    title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                >
                    <LogOut size={16} />
                    <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
                </button>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.4 }}>
                    {t('app.version')}
                </div>
            </div>
        </aside>
    );
}

// Pending approval screen
function PendingScreen({ lang }) {
    const { logout, fullName } = useAuth();
    const isAr = lang === 'ar';
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', flexDirection: 'column', gap: 20, padding: 24,
            direction: isAr ? 'rtl' : 'ltr', textAlign: 'center',
        }}>
            <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(79,70,229,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <ShieldCheck size={32} color="var(--primary)" />
            </div>
            <div>
                <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.3rem', marginBottom: 8 }}>
                    {isAr ? 'في انتظار الموافقة' : 'Awaiting Approval'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 360 }}>
                    {isAr
                        ? `مرحباً ${fullName}، تم تسجيل حسابك. يرجى انتظار موافقة المدير لمنحك الصلاحيات.`
                        : `Hi ${fullName}, your account has been registered. Please wait for an admin to grant you access.`}
                </p>
            </div>
            <button onClick={logout} className="btn btn-secondary" style={{ marginTop: 8 }}>
                <LogOut size={16} />
                {isAr ? 'تسجيل الخروج' : 'Sign Out'}
            </button>
        </div>
    );
}

// Native-like Splash / Loading Screen
function LoadingScreen() {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', flexDirection: 'column', gap: 24,
            animation: 'fadeIn 0.5s ease-out'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                width: 80, height: 80, borderRadius: 20, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(79,70,229,0.3)',
                animation: 'pulseSplash 2s infinite ease-in-out'
            }}>
                <Globe size={40} color="white" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    Payroll<span style={{ color: 'var(--primary)' }}>Pro</span>
                </h1>
                <div style={{ width: 140, height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ 
                        height: '100%', background: 'var(--primary)', width: '30%', borderRadius: 4,
                        animation: 'loadingBarSplash 1.5s infinite ease-in-out'
                    }} />
                </div>
            </div>

            <style>{`
                @keyframes pulseSplash {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(79,70,229, 0.4); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(79,70,229, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(79,70,229, 0); }
                }
                @keyframes loadingBarSplash {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(330%); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}

function BottomNav() {
    const { lang } = useLanguage();
    const { role } = useAuth();
    const [showMore, setShowMore] = useState(false);
    const isAr = lang === 'ar';

    const moreItems = [
        { icon: AlertTriangle, label: isAr ? 'التحذيرات' : 'Warnings', to: '/warnings' },
        { icon: TrendingUp, label: isAr ? 'الأداء' : 'Performance', to: '/performance' },
        { icon: DollarSign, label: isAr ? 'الرواتب' : 'Payroll', to: '/payroll' },
        { icon: BarChart2, label: isAr ? 'التقارير' : 'Reports', to: '/reports' },
        { icon: Briefcase, label: isAr ? 'التوظيف' : 'Recruitment', to: '/recruitment' },
        { icon: CalendarRange, label: isAr ? 'الجدول' : 'Schedule', to: '/schedule' },
        { icon: Settings, label: isAr ? 'الإعدادات' : 'Settings', to: '/settings' },
        ...(role === 'admin' ? [{ icon: ShieldCheck, label: isAr ? 'المستخدمون' : 'Users', to: '/users' }] : []),
    ];

    return (
        <>
            {showMore && (
                <div onClick={() => setShowMore(false)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999,
                    backdropFilter: 'blur(4px)',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        position: 'absolute', bottom: 80, left: 12, right: 12,
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 20, padding: 16,
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        gap: 8,
                    }}>
                        <div style={{ gridColumn: '1/-1', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                            {isAr ? 'المزيد' : 'More Pages'}
                        </div>
                        {moreItems.map(({ icon: Icon, label, to }) => (
                            <NavLink key={to} to={to} onClick={() => setShowMore(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-muted)' }}>
                                <Icon size={20} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'center' }}>{label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            )}
            <nav className="bottom-nav" dir={isAr ? 'rtl' : 'ltr'}>
                <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard className="nav-icon" />
                    <span>{isAr ? 'الرئيسية' : 'Home'}</span>
                </NavLink>
                <NavLink to="/employees" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <Users className="nav-icon" />
                    <span>{isAr ? 'الموظفون' : 'Staff'}</span>
                </NavLink>

                <NavLink to="/attendance" className="bottom-nav-fab">
                    <Fingerprint size={32} />
                </NavLink>

                <NavLink to="/leaves" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <CalendarDays className="nav-icon" />
                    <span>{isAr ? 'الإجازات' : 'Leaves'}</span>
                </NavLink>
                <button className={`bottom-nav-item ${showMore ? 'active' : ''}`} onClick={() => setShowMore(v => !v)}>
                    <LayoutGrid className="nav-icon" />
                    <span>{isAr ? 'المزيد' : 'More'}</span>
                </button>
            </nav>
        </>
    );
}

export default function App() {
    const location = useLocation();
    const { lang } = useLanguage();
    const { user, role, loading, fullName, logout } = useAuth();
    const { sidebarOpen, setSidebarOpen, companyName, fetchSettings } = useAppStore();

    useEffect(() => {
        fetchSettings();

        const handleOnline = () => syncOfflineQueue(api);
        window.addEventListener('online', handleOnline);
        // Initial check on boot
        if (navigator.onLine) {
            // small timeout to not block UI render immediately
            setTimeout(() => syncOfflineQueue(api), 1000);
        }

        return () => window.removeEventListener('online', handleOnline);
    }, [fetchSettings]);

    // Dynamic toast style based on theme
    const toastStyle = {
        background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
    };

    if (loading) return <LoadingScreen />;
    // Allow unauthenticated access to reset-password page
    if (window.location.pathname === '/reset-password') return <ResetPasswordPage />;
    if (!user) return <LoginPage />;
    if (role === 'pending') return <PendingScreen lang={lang} />;
    if (role === 'employee') return <EmployeePortal />;

    return (
        <>
            <Toaster position="top-right" toastOptions={{ style: toastStyle, duration: 3500 }} />
            <ReloadPrompt />
            <div className="app-layout">
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="main-content">
                    <div className="mobile-header" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                        {/* Left: Logo */}
                        <Logo lang={lang} size="sm" />

                        {/* Center: Company name */}
                        <div style={{
                            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                            textAlign: 'center', pointerEvents: 'none',
                        }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                {companyName || (lang === 'ar' ? 'اسم الشركة' : 'Company Name')}
                            </div>
                            <div style={{ fontSize: '0.58rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {lang === 'ar' ? 'الشركة' : 'Company'}
                            </div>
                        </div>

                        {/* Right: avatar + user info stacked below it */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: lang === 'ar' ? 'flex-start' : 'flex-end', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
                                    fontSize: '0.95rem', fontWeight: 800, color: 'white',
                                }}>
                                    {(fullName || 'U')[0].toUpperCase()}
                                </div>
                            </div>
                            <div style={{
                                fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)',
                                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {fullName || 'User'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                <span style={{
                                    fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.07em',
                                    color: role === 'admin' ? '#818cf8' : role === 'manager' ? '#38bdf8' : '#34d399',
                                }}>
                                    {role === 'admin'
                                        ? (lang === 'ar' ? 'الرئيس التنفيذي' : 'CEO')
                                        : role === 'manager'
                                            ? (lang === 'ar' ? 'مدير' : 'Manager')
                                            : (lang === 'ar' ? 'موظف' : 'Employee')}
                                </span>
                                <button onClick={logout} title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 3,
                                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                                        borderRadius: 6, padding: '2px 7px', color: '#f87171',
                                        cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700, fontFamily: 'inherit', lineHeight: 1.4,
                                    }}>
                                    <LogOut size={10} />
                                    {lang === 'ar' ? 'خروج' : 'Sign out'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                            <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
                            <Route path="/employees" element={<PageTransition><Employees role={role} /></PageTransition>} />
                            <Route path="/attendance" element={<PageTransition><Attendance /></PageTransition>} />
                            <Route path="/leaves" element={<PageTransition><LeaveManagement /></PageTransition>} />
                            <Route path="/warnings" element={<PageTransition><Warnings /></PageTransition>} />
                            <Route path="/performance" element={<PageTransition><Performance /></PageTransition>} />
                            <Route path="/payroll" element={<PageTransition><Payroll /></PageTransition>} />
                            <Route path="/reports" element={<PageTransition><Reports /></PageTransition>} />
                            <Route path="/recruitment" element={<PageTransition><Recruitment /></PageTransition>} />
                            <Route path="/schedule" element={<PageTransition><Schedule /></PageTransition>} />
                            <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
                            {role === 'admin' && <Route path="/users" element={<PageTransition><UsersPage /></PageTransition>} />}
                        </Routes>
                    </AnimatePresence>
                    <BottomNav />
                </main>
            </div>
        </>
    );
}
