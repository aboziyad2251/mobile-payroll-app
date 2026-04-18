import { createClient } from '@insforge/sdk';

const BASE_URL = 'https://u549z7nn.ap-southeast.insforge.app';
const ANON_KEY = 'ik_8fa3ae69a4d375f96e3dea1b8541cdf1de6f83faa3e7454e118461f963aca94a';

const client = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });

/**
 * Insforge requires passwords ≥ 128 chars. Pad shorter passwords by repeating
 * them to exactly 128 chars so CEO can set short human-friendly passwords.
 * Login applies the same padding so authentication works transparently.
 */
export const padPassword = (pwd) =>
    pwd.length >= 128 ? pwd : pwd.repeat(Math.ceil(128 / pwd.length)).slice(0, 128);

/**
 * Create a new auth user WITHOUT overwriting the current admin session.
 * The SDK's signUp() calls saveSessionFromResponse() which logs you out
 * as admin and in as the new user. We bypass that by using raw fetch.
 */
export const adminCreateAuthUser = async (email, password) => {
    const res = await fetch(`${BASE_URL}/api/auth/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ email, password: padPassword(password) }),
        credentials: 'include',
    });
    if (res.status === 409) {
        // Auth account already exists — that's fine, just proceed to upsert the profile
        return { alreadyExists: true };
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Auth signup failed (${res.status})`);
    }
    return res.json();
};

export default client;
