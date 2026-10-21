import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * Admin identity comes from Supabase Auth (Google OAuth). The `isAdmin` flag
 * below only controls what the UI shows — the real gate is the `is_admin()`
 * check in the row level security policies, so a forged flag buys nothing.
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

    const value = useMemo(
        () => ({ session, user: session?.user ?? null, isAdmin, isLoading, authError, signInWithGoogle, signOut }),
        [session, isAdmin, isLoading, authError, signInWithGoogle, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
