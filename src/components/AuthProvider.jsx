import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * The assurance level of a session: 'aal2' once an authenticator code was
 * entered, otherwise 'aal1'. Read from the access token, like
 * supabase.auth.mfa.getAuthenticatorAssuranceLevel() does, so it updates with
 * every session change (including MFA_CHALLENGE_VERIFIED) without a request.
 */
function sessionAal(session) {
    const payload = session?.access_token?.split('.')[1];
    if (!payload) return null;
    try {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes)).aal ?? null;
    } catch {
        return null;
    }
}

/**
 * Admin identity comes from Supabase Auth (Google OAuth). The flags below only
 * control what the UI shows — the real gate is the `is_admin()` check in the row
 * level security policies, so a forged flag buys nothing.
 *
 * `isAdmin` means the account is on the admin_users allow-list (that row is
 * readable at aal1). Admins must also finish two-step sign-in: `is_admin()` only
 * passes at aal2, so the dashboard needs `isVerifiedAdmin`, not just `isAdmin`.
 */
export default function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    // Without Supabase there is nothing to wait for, so don't start in a loading state.
    const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) {
            return undefined;
        }

        let ignore = false;
        // The account whose admin status was last checked. Token refreshes and
        // returning to the tab fire auth events for the same account; checking
        // again would swap the dashboard for a loading screen and lose edits.
        let checkedEmail;

        const checkAdmin = async (email) => {
            if (!email) {
                setIsAdmin(false);
                setIsLoading(false);
                return;
            }

            // Row level security only returns the caller's own admin_users row.
            const { data, error } = await supabase
                .from('admin_users')
                .select('email')
                .limit(1)
                .maybeSingle();

            if (ignore || email !== checkedEmail) return;

            if (error) {
                console.error('Admin lookup failed:', error);
            }

            setIsAdmin(Boolean(data));
            setIsLoading(false);
        };

        // Fires INITIAL_SESSION straight away, then on sign-in, sign-out and token refresh.
        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (ignore) return;
            setSession(nextSession);

            const email = nextSession?.user?.email ?? null;
            if (email === checkedEmail) return;
            checkedEmail = email;
            setIsLoading(true);
            // Supabase calls made inside this callback can deadlock its auth lock.
            setTimeout(() => {
                if (!ignore) checkAdmin(email);
            }, 0);
        });

        return () => {
            ignore = true;
            listener?.subscription?.unsubscribe();
        };
    }, []);

    const signInWithGoogle = useCallback(async () => {
        if (!isSupabaseConfigured || !supabase) {
            setAuthError('Sign-in is unavailable: Supabase is not configured.');
            return;
        }

        setAuthError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/admin/dashboard` },
        });

        if (error) {
            setAuthError(error.message);
        }
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setSession(null);
        setIsAdmin(false);
    }, []);

    const aal = sessionAal(session);
    const isVerifiedAdmin = isAdmin && aal === 'aal2';

    const value = useMemo(
        () => ({ session, user: session?.user ?? null, isAdmin, aal, isVerifiedAdmin, isLoading, authError, signInWithGoogle, signOut }),
        [session, isAdmin, aal, isVerifiedAdmin, isLoading, authError, signInWithGoogle, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
