import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const AuthContext = createContext(null);

/**
 * Admin identity comes from Supabase Auth (Google OAuth). The `isAdmin` flag
 * below only controls what the UI shows — the real gate is the `is_admin()`
 * check in the row level security policies, so a forged flag buys nothing.
 */
export function AuthProvider({ children }) {
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

        const checkAdmin = async (nextSession) => {
            if (!nextSession?.user?.email) {
                if (!ignore) {
                    setIsAdmin(false);
                    setIsLoading(false);
                }
                return;
            }

            const { data, error } = await supabase
                .from('admin_users')
                .select('email')
                .ilike('email', nextSession.user.email)
                .maybeSingle();

            if (ignore) return;

            if (error) {
                console.error('Admin lookup failed:', error);
            }

            setIsAdmin(Boolean(data));
            setIsLoading(false);
        };

        supabase.auth.getSession().then(({ data }) => {
            if (ignore) return;
            setSession(data.session ?? null);
            checkAdmin(data.session);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (ignore) return;
            setSession(nextSession);
            setIsLoading(true);
            checkAdmin(nextSession);
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

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
