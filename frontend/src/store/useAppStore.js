import { create } from 'zustand';
import { getSettings, getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api';

export const useAppStore = create((set, get) => ({
    // Common App State
    companyName: '',
    sidebarOpen: false,
    
    // Notification State
    notifs: [],
    showNotifs: false,
    
    // Actions
    setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setShowNotifs: (show) => set({ showNotifs: show }),
    
    fetchSettings: async () => {
        try {
            const r = await getSettings();
            if (r.data?.company_name) {
                set({ companyName: r.data.company_name });
            }
        } catch (e) {
            console.error('Settings fetch failed:', e);
        }
    },

    loadNotifications: async (appUserId) => {
        if (!appUserId) return;
        try {
            const r = await getNotifications(appUserId);
            if (r.data) set({ notifs: r.data });
        } catch (e) {
            console.error('Notifications fetch failed:', e);
        }
    },

    markAllRead: async (appUserId) => {
        try {
            await markAllNotificationsRead(appUserId);
            set((state) => ({
                notifs: state.notifs.map(n => ({ ...n, is_read: true }))
            }));
        } catch (e) {
            console.error('Mark all read failed:', e);
        }
    },

    markRead: async (notifId) => {
        try {
            await markNotificationRead(notifId);
            set((state) => ({
                notifs: state.notifs.map(n => n.id === notifId ? { ...n, is_read: true } : n)
            }));
        } catch (e) {
            console.error('Mark read failed:', e);
        }
    }
}));
