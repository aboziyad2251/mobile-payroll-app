import React, { useEffect, useState } from 'react';
import { Users, Clock, AlertTriangle, TrendingUp, DollarSign, Award, UserCheck, UserX } from 'lucide-react';
import { getTodayAttendance, getTopPerformers } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useLanguage } from '../context/LanguageContext';

const COLORS = ['#10b981', '#ef4444', '#0ea5e9', '#f59e0b', '#8b5cf6', '#4f46e5'];

const getRatingClass = (r) => ({
    Excellent: 'badge-excellent', Good: 'badge-good',
    Average: 'badge-average', 'Needs Improvement': 'badge-poor', Poor: 'badge-poor'
}[r] || 'badge-info');

export default function Dashboard() {
    const { t, lang } = useLanguage();
    const [attendance, setAttendance] = useState(null);
    const [topPerformers, setTopPerformers] = useState([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();

    useEffect(() => {
        Promise.all([
            getTodayAttendance(),
            getTopPerformers({ period: 'monthly', limit: 5 })
        ]).then(([att, perf]) => {
            setAttendance(att.data);
            setTopPerformers(perf.data || []);
        }).finally(() => setLoading(false));
    }, []);

    const attPieData = attendance ? [
        { name: t('att.present'), value: attendance.present || 0 },
        { name: t('att.absent'), value: attendance.absent || 0 },
        { name: t('dash.onLeave'), value: (attendance.annual_leave || 0) + (attendance.sick_leave || 0) + (attendance.emergency_leave || 0) },
        { name: t('att.excused'), value: attendance.excused || 0 },
    ].filter(d => d.value > 0) : [];

    const greeting = now.getHours() < 12
        ? t('dash.morning')
        : now.getHours() < 17 ? t('dash.afternoon') : t('dash.evening');

    if (loading) return <div className="loading" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{greeting}</h1>
                    <p className="page-subtitle">{now.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="stat-grid">
                {[
                    { label: t('dash.totalEmployees'), value: attendance?.total_employees || 0, icon: Users, color: '#4f46e5', bg: 'rgba(79,70,229,0.15)' },
                    { label: t('dash.presentToday'), value: attendance?.present || 0, icon: UserCheck, color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
                    { label: t('dash.absentToday'), value: attendance?.absent || 0, icon: UserX, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                    { label: t('dash.onLeave'), value: (attendance?.annual_leave || 0) + (attendance?.sick_leave || 0) + (attendance?.emergency_leave || 0), icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
                    { label: t('dash.sickLeave'), value: attendance?.sick_leave || 0, icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                    { label: t('dash.excused'), value: attendance?.excused || 0, icon: Award, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div className="stat-card" key={label}>
                        <div className="stat-icon" style={{ background: bg }}>
                            <Icon size={20} color={color} />
                        </div>
                        <div className="stat-info">
                            <h3 style={{ color }}>{value}</h3>
                            <p>{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid-2">
                {/* Attendance Pie Chart */}
                <div className="card">
                    <div className="card-header">
                        <div><div className="card-title">{t('dash.todayAttendance')}</div><div className="card-subtitle">{attendance?.date}</div></div>
                    </div>
                    {attPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={attPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                                    {attPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1e1e38', border: '1px solid #2e2e52', borderRadius: 8 }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>{t('dash.noAttendance')}</p></div>}
                </div>

                {/* Top Performers */}
                <div className="card">
                    <div className="card-header">
                        <div><div className="card-title">{t('dash.topPerformers')}</div><div className="card-subtitle">{t('dash.monthlyRanking')}</div></div>
                    </div>
                    {topPerformers.length === 0
                        ? <div className="empty-state"><p>{t('dash.noPerformance')}<br />{t('dash.calculateFirst')}</p></div>
                        : <div>
                            {topPerformers.map((p, i) => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < topPerformers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <span className={`rank-badge ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other'}`}>{i + 1}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.first_name} {p.last_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.department}</div>
                                        <div className="score-bar" style={{ marginTop: 4 }}>
                                            <div className={`score-fill ${p.total_score >= 90 ? 'score-excellent' : p.total_score >= 75 ? 'score-good' : p.total_score >= 60 ? 'score-average' : 'score-poor'}`}
                                                style={{ width: `${p.total_score}%` }} />
                                        </div>
                                    </div>
                                    <span className={`badge ${getRatingClass(p.rating)}`}>{p.total_score?.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    }
                </div>
            </div>
        </div>
    );
}
