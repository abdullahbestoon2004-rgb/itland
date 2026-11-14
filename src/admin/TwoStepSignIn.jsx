import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CopyButton, Notice, Spinner } from './ui';

/**
 * Two-step sign-in (Supabase Auth MFA, TOTP). Every admin must reach aal2 before
 * the dashboard opens: `is_admin()` in the database only passes at aal2, so an
 * aal1 session can read nothing admin-only.
 *
 * - No verified authenticator yet: enroll one (QR code + key), then verify a code.
 * - Authenticator already set up: ask for a code.
 * Verifying upgrades the session to aal2; AuthProvider sees the new session and
 * AdminApp swaps this screen for the dashboard.
 */

const FACTOR_NAME = 'ITland admin';

/** A sentence an admin can act on, for an error from supabase.auth.mfa.*. */
function friendlyError(error) {
    const code = error?.code;
    const message = String(error?.message ?? '');
    const wrongCode = 'That code is not right. Enter the newest 6-digit code from your authenticator app. If it keeps failing, make sure your phone sets its time automatically.';
    const expired = 'That code expired. Enter the newest code from your authenticator app.';
    // Error codes first; older auth servers only send a message.
    switch (code) {
        case 'mfa_verification_failed': return wrongCode;
        case 'mfa_challenge_expired': return expired;
        case 'over_request_rate_limit': return 'Too many attempts. Wait a minute, then try again.';
        case 'mfa_totp_enroll_not_enabled':
        case 'mfa_totp_verify_not_enabled':
            return 'Authenticator app sign-in is turned off in Supabase. Turn on TOTP under Authentication → Sign In / Providers → Multi-Factor Authentication, then reload this page.';
        case 'session_not_found':
        case 'refresh_token_not_found':
            return 'Your session ended. Sign out and sign in again.';
        default:
    }
    if (error?.status === 429) return 'Too many attempts. Wait a minute, then try again.';
    if (/expired/i.test(message)) return expired;
    if (/invalid totp/i.test(message)) return wrongCode;
    if (error?.status === 401) return 'Your session ended. Sign out and sign in again.';
    return message || 'Something went wrong. Try again.';
}

/**
 * supabase-js hands the QR code over as `data:image/svg+xml;utf-8,<svg…>` with
 * the SVG unescaped; a `#` or `%` in it would cut the image short, so re-encode it.
 */
function qrImageSrc(qrCode) {
    const raw = String(qrCode ?? '');
    const comma = raw.indexOf(',');
    if (!raw.startsWith('data:image/svg+xml') || comma === -1) return raw;
    const svg = raw.slice(comma + 1);
    if (/^\s*</.test(svg)) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return raw;
}

/** Which screen to show: set up a new authenticator, or enter a code. */
async function prepareStep() {
    const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (levelError) throw levelError;
    if (level?.currentLevel === 'aal2') return { step: 'done' };

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const verified = factors?.totp?.[0];
    if (verified) return { step: 'verify', factorId: verified.id };

    // A setup that was never confirmed (closed tab, failed code) leaves an
    // unverified factor behind; it would clash with the new one, so remove it.
    const leftovers = (factors?.all ?? []).filter((f) => f.factor_type === 'totp' && f.status !== 'verified');
    for (const factor of leftovers) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: FACTOR_NAME, issuer: 'ITland' });
    if (error) throw error;
    return { step: 'enroll', factorId: data.id, qrCode: qrImageSrc(data.totp.qr_code), secret: data.totp.secret };
}

export default function TwoStepSignIn() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [state, setState] = useState({ step: 'loading' });
    const mounted = useRef(false);
    const started = useRef(false);

    const load = useCallback(async () => {
        setState({ step: 'loading' });
        try {
            const next = await prepareStep();
            // The session is already aal2 but the app missed it: a refresh
            // re-announces the session, and AuthProvider opens the dashboard.
            if (next.step === 'done') await supabase.auth.refreshSession();
            if (mounted.current) setState(next);
        } catch (error) {
            console.error('Two-step sign-in setup failed:', error);
            if (mounted.current) setState({ step: 'failed', message: friendlyError(error) });
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        // Once only: enrolling twice (Strict Mode runs effects twice) would
        // replace the QR code the admin is about to scan.
        if (!started.current) {
            started.current = true;
            Promise.resolve().then(load);
        }
        return () => {
            mounted.current = false;
        };
    }, [load]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/admin/login');
    };

    const isSetup = state.step === 'enroll';
    const title = isSetup ? 'Set up two-step sign-in' : state.step === 'verify' ? 'Enter the code from your authenticator app' : 'Two-step sign-in';

    return (
        <div className="adm-root adm-root--gate">
            <main className="adm-gate">
                <div className="adm-gate__brand">
                    <img src="/newitlandlogo.png" alt="" className="adm-brand__logo" />
                    <span className="adm-brand__text">ITland <em>Admin</em></span>
                </div>

                <section className="adm-panel adm-gate__card" aria-labelledby="adm-gate-title">
                    <div className="adm-gate__icon" aria-hidden="true">
                        {isSetup ? <ShieldCheck size={22} /> : <KeyRound size={22} />}
                    </div>
                    <h1 id="adm-gate-title" className="adm-h1 adm-gate__title">{title}</h1>

                    {state.step === 'loading' && (
                        <div className="adm-loading"><Spinner label="Checking two-step sign-in…" /></div>
                    )}

                    {state.step === 'done' && (
                        <div className="adm-loading"><Spinner label="Opening the dashboard…" /></div>
                    )}

                    {state.step === 'failed' && (
                        <Notice
                            tone="error"
                            title="Two-step sign-in is not ready"
                            action={<button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={load}>Try again</button>}
                        >
                            {state.message}
                        </Notice>
                    )}

                    {state.step === 'enroll' && (
                        <>
                            <p className="adm-gate__lead">
                                Admins need a code from an authenticator app every time they sign in. It keeps the store safe even if
                                someone gets into your Google account.
                            </p>
                            <ol className="adm-gate__steps">
                                <li>
                                    <strong>Install an authenticator app</strong> on your phone, for example Google Authenticator,
                                    Microsoft Authenticator or 1Password.
                                </li>
                                <li>
                                    <strong>Scan this QR code</strong> with the app.
                                    <div className="adm-gate__qr">
                                        <img src={state.qrCode} alt="QR code for the ITland authenticator entry" width="180" height="180" />
                                    </div>
                                    <p className="adm-muted adm-small">Can&apos;t scan it? Add the entry by hand with this key:</p>
                                    <div className="adm-gate__secret">
                                        <code className="adm-mono">{state.secret}</code>
                                        <CopyButton value={state.secret} label="Copy key" />
                                    </div>
                                </li>
                                <li>
                                    <strong>Enter the 6-digit code</strong> the app shows for ITland.
                                </li>
                            </ol>
                            <CodeForm factorId={state.factorId} submitLabel="Verify and open dashboard" onFactorMissing={load} />
                            <p className="adm-muted adm-small">
                                Scanned an earlier ITland code that never got confirmed? Delete that entry from the app and use this one.
                            </p>
                        </>
                    )}

                    {state.step === 'verify' && (
                        <>
                            <p className="adm-gate__lead">Open your authenticator app and enter the 6-digit code for ITland.</p>
                            <CodeForm factorId={state.factorId} submitLabel="Verify" onFactorMissing={load} autoFocus />
                            <p className="adm-muted adm-small">
                                Lost access to your authenticator app? Ask the store owner to remove your authenticator in Supabase
                                (Authentication → Users → your account), then sign in again to set up a new one.
                            </p>
                        </>
                    )}

                    <footer className="adm-gate__foot">
                        {user?.email && <span className="adm-ellipsis adm-muted" title={user.email}>Signed in as {user.email}</span>}
                        <button type="button" className="adm-link" onClick={handleSignOut}><LogOut size={15} aria-hidden="true" /> Sign out</button>
                    </footer>
                </section>
            </main>
        </div>
    );
}

// autoFocus only where the code is all there is to do: on the setup screen it
// would scroll a phone past the QR code.
function CodeForm({ factorId, submitLabel, onFactorMissing, autoFocus = false }) {
    const inputId = useId();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const verify = async (value) => {
        if (busy) return;
        if (!/^\d{6}$/.test(value)) {
            setError('Enter the 6-digit code from your authenticator app.');
            return;
        }
        setBusy(true);
        setError('');
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value });
        if (!verifyError) return; // The session is now aal2; the dashboard replaces this screen.
        setBusy(false);
        if (verifyError.code === 'mfa_factor_not_found') {
            onFactorMissing();
            return;
        }
        setError(friendlyError(verifyError));
        setCode('');
        inputRef.current?.focus();
    };

    const handleChange = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        if (error) setError('');
        // Codes are usually pasted or typed in one go; send as soon as all six are in.
        if (digits.length === 6) verify(digits);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        verify(code);
    };

    return (
        <form className="adm-gate__form" onSubmit={handleSubmit} noValidate>
            <div className={`adm-field ${error ? 'adm-field--error' : ''}`}>
                <label className="adm-field__label" htmlFor={inputId}>6-digit code</label>
                <input
                    ref={inputRef}
                    id={inputId}
                    className="adm-input adm-gate__code"
                    value={code}
                    onChange={handleChange}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    // readOnly, not disabled: a disabled field drops focus, and the
                    // admin should be able to type the next code straight away.
                    readOnly={busy}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    autoFocus={autoFocus}
                />
                {error && <p id={`${inputId}-error`} className="adm-field__error" role="alert">{error}</p>}
            </div>
            <button type="submit" className="adm-btn adm-btn--primary adm-gate__submit" disabled={busy}>
                {busy ? <Spinner size={15} label="Checking…" /> : submitLabel}
            </button>
        </form>
    );
}
