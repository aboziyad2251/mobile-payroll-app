import { createContext, useContext, useEffect, useState } from 'react';
import client, { padPassword } from '../lib/insforge';

const AuthContext = createContext(null);

const SUPER_ADMIN_EMAIL = 'tarj123@gmail.com';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [employeeId, setEmployeeId] = useState(null);
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    const [subordinateIds, setSubordinateIds] = useState(null);
    const [appUserId, setAppUserId] = useState(null);
    const [delegatedPermissions, setDelegatedPermissions] = useState([]);

    const fetchProfile = async (email) => {
        const { data } = await client.database
            .from('app_users')
            .select('*')
            .eq('email', email)
            .limit(1);
        return data?.[0] || null;
    };

    const upsertProfile = async (email, fields) => {
        const { data: rows } = await client.database
            .from('app_users')
            .select('id, role')
            .eq('email', email)
            .limit(1);

        const existing = rows?.[0];
        if (existing) {
            const { data } = await client.database
                .from('app_users')
                .update(fields)
                .eq('email', email)
                .select();
            return data?.[0] || null;
        } else {
            const { data } = await client.database
                .from('app_users')
                .insert([{ email, ...fields }])
                .select();
            return data?.[0] || null;
        }
    };

    const applyUser = async (insforgeUser) => {
        if (!insforgeUser) return;
        const email = insforgeUser.email;
        const displayName = insforgeUser.name || insforgeUser.fullName || insforgeUser.full_name || email;

        let profile = await fetchProfile(email);

        if (!profile) {
            // Auto-provision: super admin gets admin role, everyone else gets pending
            const role = email === SUPER_ADMIN_EMAIL ? 'admin' : 'pending';
            profile = await upsertProfile(email, { role, full_name: displayName });
        } else if (email === SUPER_ADMIN_EMAIL && profile.role !== 'admin') {
            // Ensure super admin always has admin role
            profile = await upsertProfile(email, { role: 'admin', full_name: displayName });
        }

        if (!profile) return;

        setUser(insforgeUser);
        setRole(profile.role);
        setEmployeeId(profile.employee_id || null);
        setFullName(profile.full_name || email);
        setAppUserId(profile.id || null);

        // Load delegated permissions for managers
        const perms = profile.delegated_permissions
            ? (Array.isArray(profile.delegated_permissions)
                ? profile.delegated_permissions
                : JSON.parse(profile.delegated_permissions))
            : [];
        setDelegatedPermissions(perms);

        // Load subordinates for managers
        if (profile.role === 'manager' && profile.id) {
            const { data: subs } = await client.database
                .from('manager_subordinates')
                .select('employee_id')
                .eq('manager_user_id', profile.id);
            setSubordinateIds((subs || []).map(s => s.employee_id));
        } else {
            setSubordinateIds(null);
        }
    };

    // Restore session on mount
    useEffect(() => {
        const init = async () => {
            try {
                const { data } = await client.auth.getCurrentUser();
                if (data?.user) {
                    await applyUser(data.user);
                }
            } catch {
                // No session
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const login = async (usernameOrEmail, password) => {
        setAuthError(null);
        setLoading(true);
        try {
            let email = usernameOrEmail.trim();
            if (!email.includes('@')) {
                const { data: profile, error: lookupErr } = await client.database
                    .from('app_users')
                    .select('email')
                    .eq('username', email)
                    .single();
                if (lookupErr || !profile) throw new Error('Username not found. Contact your administrator.');
                email = profile.email;
            }

            // Try original password first (existing users), then padded (users created via New User form)
            let { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) {
                const padded = padPassword(password);
                if (padded !== password) {
                    const retry = await client.auth.signInWithPassword({ email, password: padded });
                    if (!retry.error) { data = retry.data; error = null; }
                }
            }
            if (error) throw error;

            const profile = await fetchProfile(email);
            if (!profile) throw new Error('User not found in app. Contact your administrator.');

            setUser(data.user || data.session?.user);
            setRole(profile.role);
            setEmployeeId(profile.employee_id || null);
            setFullName(profile.full_name || email);
            setAppUserId(profile.id || null);
            const perms2 = profile.delegated_permissions
                ? (Array.isArray(profile.delegated_permissions)
                    ? profile.delegated_permissions
                    : JSON.parse(profile.delegated_permissions))
                : [];
            setDelegatedPermissions(perms2);
            if (profile.role === 'manager' && profile.id) {
                const { data: subs } = await client.database.from('manager_subordinates').select('employee_id').eq('manager_user_id', profile.id);
                setSubordinateIds((subs || []).map(s => s.employee_id));
            } else {
                setSubordinateIds(null);
            }
        } catch (err) {
            setAuthError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        setAuthError(null);
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            redirectTo: window.location.origin,
        });
        if (error) {
            setAuthError(error.message);
            throw error;
        }
        // Redirect to Google's OAuth page
        if (data?.url) {
            window.location.href = data.url;
        }
    };

    const logout = async () => {
        await client.auth.signOut();
        setUser(null);
        setRole(null);
        setEmployeeId(null);
        setFullName('');
        setSubordinateIds(null);
        setAppUserId(null);
        setDelegatedPermissions([]);
    };

    // Check if current user can perform a specific action
    // admin and hr_manager always can; managers only if delegated
    const canDo = (perm) =>
        role === 'admin' || role === 'CEO' || role === 'hr_manager' || delegatedPermissions.includes(perm);

    return (
        <AuthContext.Provider value={{ user, role, employeeId, fullName, loading, authError, subordinateIds, appUserId, delegatedPermissions, canDo, login, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
