import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Clock, Users, CalendarDays, DollarSign, TrendingUp,
    Briefcase, AlertTriangle, BarChart2, CalendarRange, ChevronRight,
    UserCheck, UserX
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getTodayAttendance } from '../services/api';
import client from '../lib/insforge';

const quickItems = (isAr) => [
    { icon: Clock,        label: isAr ? 'الحضور'    : 'Attendance',  to: '/attendance',   g: 'linear-gradient(135deg,#5b21b6,#7c3aed)' },
    { icon: CalendarDays, label: isAr ? 'الإجازات'   : 'Leaves',      to: '/leaves',       g: 'linear-gradient(135deg,#0369a1,#0ea5e9)' },
    { icon: Users,        label: isAr ? 'الموظفون'   : 'Employees',   to: '/employees',    g: 'linear-gradient(135deg,#065f46,#10b981)' },
    { icon: DollarSign,   label: isAr ? 'الرواتب'    : 'Payroll',     to: '/payroll',      g: 'linear-gradient(135deg,#92400e,#f59e0b)' },
    { icon: TrendingUp,   label: isAr ? 'الأداء'     : 'Performance', to: '/performance',  g: 'linear-gradient(135deg,#9f1239,#ef4444)' },
    { icon: Briefcase,    label: isAr ? 'التوظيف'    : 'Recruitment', to: '/recruitment',  g: 'linear-gradient(135deg,#4c1d95,#8b5cf6)' },
    { icon: BarChart2,    label: isAr ? 'التقارير'   : 'Reports',     to: '/reports',      g: 'linear-gradient(135deg,#164e63,#06b6d4)' },
    { icon: AlertTriangle,label: isAr ? 'التحذيرات'  : 'Warnings',    to: '/warnings',     g: 'linear-gradient(135deg,#7f1d1d,#dc2626)' },
    { icon: CalendarRange,label: isAr ? 'الجدول'     : 'Schedule',    to: '/schedule',     g: 'linear-gradient(135deg,#14532d,#16a34a)' },
];

export default function Dashboard() {
    const { lang } = useLanguage();
    const { fullName } = useAuth();
    const [att, setAtt] = useState(null);
    const [pendingLeaves, setPendingLeaves] = useState(0);
    const [loading, setLoading] = useState(true);
    const isAr = lang === 'ar';
    const now = new Date();

    useEffect(() => {
        Promise.allSettled([
            getTodayAttendance(),
            client.database.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        ]).then(([attRes, leavesRes]) => {
            if (attRes.status === 'fulfilled') setAtt(attRes.value.data);
            if (leavesRes.status === 'fulfilled') setPendingLeaves(leavesRes.value.data?.length || 0);
        }).finally(() => setLoading(false));
    }, []);

    const greeting = now.getHours() < 12
        ? (isAr ? 'صباح الخير' : 'Good Morning')
        : now.getHours() < 17
            ? (isAr ? 'مساء الخير' : 'Good Afternoon')
            : (isAr ? 'مساء النور' : 'Good Evening');

    const onLeave = (att?.annual_leave || 0) + (att?.sick_leave || 0) + (att?.emergency_leave || 0);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isAr ? 'جاري التحميل...' : 'Loading...'}
        </div>
    );

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* ── Hero Card ─────────────────────────────── */}
            <div className="esshub-hero">
                <div className="esshub-hero-deco1" />
                <div className="esshub-hero-deco2" />
                <div className="esshub-hero-deco3" />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="esshub-hero-label">
                        {isAr ? 'ملخص اليوم' : "Today's Summary"}
                    </p>
                    <h2 className="esshub-hero-value">
                        {att?.total_employees || 0}
                        <span className="esshub-hero-unit">{isAr ? ' موظف' : ' Employees'}</span>
                    </h2>
                    <p className="esshub-hero-date">
                        {now.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>

                    <div className="esshub-hero-pills">
                        {[
                            { label: isAr ? 'حاضر' : 'Present',  count: att?.present || 0,  dot: '#34d399' },
                            { label: isAr ? 'غائب' : 'Absent',   count: att?.absent || 0,   dot: '#f87171' },
                            { label: isAr ? 'إجازة' : 'On Leave', count: onLeave,            dot: '#60a5fa' },
                            { label: isAr ? 'معذور' : 'Excused',  count: att?.excused || 0,  dot: '#a78bfa' },
                        ].map(({ label, count, dot }) => (
                            <span key={label} className="esshub-pill">
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                                {label} {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Overview Cards ────────────────────────── */}
            <div className="esshub-overview">
                {[
                    { icon: UserCheck, label: isAr ? 'الحاضرون اليوم' : 'Present Today',  value: att?.present || 0,  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  to: '/attendance' },
                    { icon: UserX,     label: isAr ? 'الغائبون اليوم' : 'Absent Today',   value: att?.absent || 0,   color: '#f87171', bg: 'rgba(248,113,113,0.12)', to: '/attendance' },
                    { icon: CalendarDays, label: isAr ? 'في إجازة'    : 'On Leave',       value: onLeave,            color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  to: '/leaves' },
                    { icon: AlertTriangle, label: isAr ? 'طلبات معلقة' : 'Pending Leaves', value: pendingLeaves,      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  to: '/leaves' },
                ].map(({ icon: Icon, label, value, color, bg, to }) => (
                    <Link key={label} to={to} className="esshub-overview-card">
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={20} color={color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
                        </div>
                        <ChevronRight size={16} color="var(--text-dim)" style={{ marginLeft: 'auto', flexShrink: 0, transform: isAr ? 'rotate(180deg)' : 'none' }} />
                    </Link>
                ))}
            </div>

            {/* ── Quick Access ──────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
                <div className="esshub-section-header">
                    <span>{isAr ? 'الوصول السريع' : 'Quick Access'}</span>
                </div>
                <div className="esshub-quick-scroll">
                    {quickItems(isAr).map(({ icon: Icon, label, to, g }) => (
                        <Link key={to} to={to} className="esshub-quick-item">
                            <div style={{ width: 56, height: 56, borderRadius: 18, background: g, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
                                <Icon size={22} color="white" />
                            </div>
                            <span className="esshub-quick-label">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Stats Strip ───────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
                <div className="esshub-section-header">
                    <span>{isAr ? 'إحصائيات سريعة' : 'Quick Stats'}</span>
                </div>
                <div className="esshub-stats-strip">
                    {[
                        { label: isAr ? 'إجمالي الموظفين' : 'Total Staff',   value: att?.total_employees || 0, color: '#818cf8' },
                        { label: isAr ? 'إجازة مرضية'      : 'Sick Leave',    value: att?.sick_leave || 0,      color: '#f87171' },
                        { label: isAr ? 'إجازة سنوية'      : 'Annual Leave',  value: att?.annual_leave || 0,    color: '#60a5fa' },
                        { label: isAr ? 'طوارئ'            : 'Emergency',     value: att?.emergency_leave || 0, color: '#fbbf24' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="esshub-stat-chip" style={{ '--chip-color': color }}>
                            <span style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
