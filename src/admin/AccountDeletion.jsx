import React, { useState } from 'react';
import { Search, Trash2, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrders, useToast } from './context';
import { Field, Notice, Spinner } from './ui';
import { ACCOUNT_DELETE_MIGRATION, describeError, formatDateTime } from './lib';

// Errors from admin_delete_app_account() (the error message is the code).
const MESSAGES = {
    bad_request: 'Enter the full email address of the account.',
    not_found: 'No app account uses this email address.',
    more_than_one: 'More than one sign-in uses this email address. Delete the right one in Supabase → Authentication → Users.',
    admin_account: 'This email belongs to a dashboard admin. It cannot be deleted here.',
    order_in_progress: 'This customer has an order that is packed, on its way or ready for pickup. Finish it first, then delete the account.',
};

function errorText(error) {
    if (MESSAGES[error?.message]) return MESSAGES[error.message];
    const d = describeError(error);
    if (d.missing) return `This needs ${ACCOUNT_DELETE_MIGRATION}. Run it in the Supabase SQL editor first.`;
    return d.message;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Deletes a customer's app account for them, when they ask on WhatsApp or by email (the app's
 * delete-account page offers this). Same rules as Account → Delete account in the app.
 */
export default function AccountDeletion() {
    const toast = useToast();
    const { reload } = useOrders();
    const [email, setEmail] = useState('');
    const [found, setFound] = useState(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    const find = async (e) => {
        e.preventDefault();
        if (!supabase || !email.trim()) return;
        setBusy('find');
        setError('');
        setFound(null);
        const { data, error: err } = await supabase.rpc('admin_delete_app_account', { p_email: email.trim(), p_confirm: false });
        setBusy('');
        if (err) setError(errorText(err));
        else setFound(data);
    };

    const remove = async () => {
        if (!found) return;
        const cancels = Number(found.to_cancel) || 0;
        const question = `Delete the app account ${found.email}?`
            + (cancels ? ` ${plural(cancels, 'open order is', 'open orders are')} cancelled.` : '')
            + ' Past orders stay, without the name, phone, address and note. This cannot be undone.';
        if (!window.confirm(question)) return;
        setBusy('delete');
        setError('');
        const { error: err } = await supabase.rpc('admin_delete_app_account', { p_email: found.email, p_confirm: true });
        setBusy('');
        if (err) {
            setError(errorText(err));
            toast(errorText(err), 'error');
            return;
        }
        toast(`Deleted the app account ${found.email}.`);
        setFound(null);
        setEmail('');
        reload();
    };

    const inProgress = Number(found?.in_progress) || 0;
    const toCancel = Number(found?.to_cancel) || 0;

    return (
        <section className="adm-panel">
            <h2 className="adm-h2"><UserX size={18} /> Delete a customer's account</h2>
            <p className="adm-muted adm-small">
                For customers who ask on WhatsApp or by email. The app's delete-account page says the store does it within 30 days.
                Customers can also do it themselves in the app: Account → Delete account.
            </p>
            <form className="adm-form" onSubmit={find} noValidate>
                <Field label="Email address of the account" hint="It is shown on their orders. With Sign in with Apple it can end in @privaterelay.appleid.com.">
                    <div className="adm-input-group">
                        <input
                            className="adm-input"
                            type="email"
                            autoComplete="off"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setFound(null);
                                setError('');
                            }}
                            placeholder="name@example.com"
                        />
                        <button type="submit" className="adm-btn adm-btn--ghost" disabled={Boolean(busy) || !email.trim()}>
                            {busy === 'find' ? <Spinner size={14} /> : <Search size={16} />} Find account
                        </button>
                    </div>
                </Field>
            </form>
            {error && <Notice tone="error">{error}</Notice>}
            {found && (
                <div className="adm-card">
                    <dl className="adm-dl">
                        <dt>Email</dt><dd>{found.email}</dd>
                        <dt>Name</dt><dd>{found.name || '—'}</dd>
                        <dt>Phone</dt><dd className="adm-mono">{found.phone || '—'}</dd>
                        <dt>Created</dt><dd>{formatDateTime(found.created_at)}</dd>
                        <dt>Last sign-in</dt><dd>{formatDateTime(found.last_sign_in_at)}</dd>
                        <dt>Orders</dt><dd>{Number(found.orders) || 0}</dd>
                    </dl>
                    {inProgress > 0 ? (
                        <Notice tone="warn">
                            {plural(inProgress, 'order is', 'orders are')} packed, on the way or ready for pickup. Finish {inProgress === 1 ? 'it' : 'them'} first, then delete the account.
                        </Notice>
                    ) : (
                        <p className="adm-small">
                            Deleting it {toCancel ? `cancels ${plural(toCancel, 'open order', 'open orders')} that ${toCancel === 1 ? 'is' : 'are'} not packed yet, ` : ''}
                            keeps past orders without the name, phone, address and note, and deletes the sign-in and profile. It cannot be undone.
                        </p>
                    )}
                    <div className="adm-row">
                        <button type="button" className="adm-btn adm-btn--danger" onClick={remove} disabled={Boolean(busy) || inProgress > 0}>
                            {busy === 'delete' ? <Spinner size={14} /> : <Trash2 size={16} />} Delete account
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
