import React, { useState } from 'react';
import { CreditCard, Globe, Save, Smartphone, Upload } from 'lucide-react';
import { useCatalog, useToast } from './context';
import { DbNotice, Field, Notice, Spinner, Toggle } from './ui';
import AccountDeletion from './AccountDeletion';
import { formatDateTime, formatIqd, iqdFromUsd, rateSourceText } from './lib';
import useStoreSettings from '../hooks/useStoreSettings';
import { saveSettings as saveSiteSettings } from '../data/settings';
import { imageFileToDataUrl } from '../utils/image';

export default function SettingsPage() {
    return (
        <div className="adm-page">
            <div className="adm-page__head">
                <div>
                    <h1 className="adm-h1">Settings</h1>
                    <p className="adm-muted">Mobile app settings, customer account deletion, and the website's promo banner and featured categories.</p>
                </div>
            </div>
            <AppSettings />
            <OnlinePayments />
            <AccountDeletion />
            <WebsiteSettings />
        </div>
    );
}

const PHONE_RE = /^\+964\d{10}$/;

function AppSettings() {
    const { settings } = useCatalog();
    if (settings.status === 'loading') return <section className="adm-panel"><Spinner label="Loading app settings…" /></section>;
    if (settings.status === 'error') {
        return (
            <section className="adm-panel">
                <h2 className="adm-h2"><Smartphone size={18} /> Mobile app</h2>
                <DbNotice error={settings.error} />
            </section>
        );
    }
    // Keyed on the editable values only: the 10-minute sync also updates this row (rate, sync
    // time), and that must not wipe what the admin is typing.
    const r = settings.row;
    const formKey = r ? [r.delivery_fee, r.store_phone, r.whatsapp, r.usd_iqd_rate, r.price_round_to, r.show_out_of_stock].join('|') : 'new';
    return <AppSettingsForm key={formKey} row={settings.row} />;
}

const STORE_NUMBER = '+9647504888570';
const SAMPLE_NUMBER = '+9647501234567';

function AppSettingsForm({ row }) {
    const toast = useToast();
    const { pricing, saveSettings } = useCatalog();
    const [form, setForm] = useState(() => ({
        delivery_fee: String(row?.delivery_fee ?? 5000),
        store_phone: row?.store_phone ?? '',
        whatsapp: row?.whatsapp ?? '',
        usd_iqd_rate: row?.usd_iqd_rate != null ? String(row.usd_iqd_rate) : '',
        price_round_to: String(row?.price_round_to ?? 250),
        show_out_of_stock: row?.show_out_of_stock !== false,
    }));
    const [busy, setBusy] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const fee = Number(form.delivery_fee.replace(/[,\s]/g, ''));
    const roundTo = Number(form.price_round_to.replace(/[,\s]/g, ''));
    const rateText = form.usd_iqd_rate.replace(/[,\s]/g, '');
    const rate = rateText === '' ? null : Number(rateText);

    const errors = {};
    if (!Number.isInteger(fee) || fee <= 0) errors.delivery_fee = 'Delivery is a flat fee and is never free: enter an amount above 0.';
    if (!PHONE_RE.test(form.store_phone.trim())) errors.store_phone = `Use the format +964 followed by 10 digits, e.g. ${STORE_NUMBER}.`;
    if (!PHONE_RE.test(form.whatsapp.trim())) errors.whatsapp = 'Use the format +964 followed by 10 digits.';
    if (rate !== null && !(rate > 0)) errors.usd_iqd_rate = 'Enter a positive number, or leave empty for the automatic rate.';
    else if (rate !== null && (rate < 500 || rate > 5000)) errors.usd_iqd_rate = 'That looks wrong: IQD per 1 USD is usually 1,000–2,000.';
    if (!Number.isInteger(roundTo) || roundTo <= 0) errors.price_round_to = 'Whole number above 0, e.g. 250.';

    const effectiveRate = rate ?? pricing.auto?.rate ?? null;
    const example = iqdFromUsd(100, effectiveRate, roundTo > 0 ? roundTo : 250);
    const dirty = row === null
        || fee !== row.delivery_fee
        || form.store_phone.trim() !== row.store_phone
        || form.whatsapp.trim() !== row.whatsapp
        || rate !== (row.usd_iqd_rate != null ? Number(row.usd_iqd_rate) : null)
        || roundTo !== row.price_round_to
        || form.show_out_of_stock !== (row.show_out_of_stock !== false);

    const submit = async (e) => {
        e.preventDefault();
        setShowErrors(true);
        if (Object.keys(errors).length) {
            toast('Check the highlighted settings.', 'error');
            return;
        }
        setBusy(true);
        try {
            await saveSettings({
                delivery_fee: fee,
                store_phone: form.store_phone.trim(),
                whatsapp: form.whatsapp.trim(),
                usd_iqd_rate: rate,
                price_round_to: roundTo,
                show_out_of_stock: form.show_out_of_stock,
            });
            toast('App settings saved. The app uses them on its next refresh.');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const err = (k) => (showErrors ? errors[k] : undefined);
    const sample = (k) => form[k].trim() === SAMPLE_NUMBER && (
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-field__fix" onClick={() => set(k, STORE_NUMBER)}>
            That is the old sample number. Use {STORE_NUMBER}
        </button>
    );
    const autoHint = pricing.auto
        ? `Empty = automatic: ${Math.round(pricing.auto.rate).toLocaleString('en-US')} IQD from ${rateSourceText(pricing.auto.source)}, observed ${formatDateTime(pricing.auto.asOf)}.`
        : pricing.lastRate?.asOf
            ? `No fresh automatic rate: the last one (${formatDateTime(pricing.lastRate.asOf)}) is over 3 days old, so the app hides products priced from Zoho until a rate is set here.`
            : 'No automatic rate synced yet, so the app hides products priced from Zoho until a rate is set here.';

    return (
        <section className="adm-panel">
            <h2 className="adm-h2"><Smartphone size={18} /> Mobile app</h2>
            {row === null && <Notice tone="warn">The settings row does not exist yet. Saving creates it.</Notice>}
            <form className="adm-form" onSubmit={submit} noValidate>
                <div className="adm-form-grid">
                    <Field label="Delivery fee (IQD)" error={err('delivery_fee')} hint="Flat fee for every city. Store pickup costs nothing.">
                        <input className="adm-input" inputMode="numeric" value={form.delivery_fee} onChange={(e) => set('delivery_fee', e.target.value)} />
                    </Field>
                    <Field label="Price rounding (IQD)" error={err('price_round_to')} hint="Zoho USD prices are converted and rounded to this step.">
                        <div className="adm-input-group">
                            <input className="adm-input" inputMode="numeric" value={form.price_round_to} onChange={(e) => set('price_round_to', e.target.value)} />
                            {[250, 500, 1000].map((n) => (
                                <button key={n} type="button" className={`adm-btn adm-btn--ghost adm-btn--sm ${roundTo === n ? 'is-active' : ''}`} onClick={() => set('price_round_to', String(n))}>{n}</button>
                            ))}
                        </div>
                    </Field>
                    <Field label="Store phone" error={err('store_phone')} hint="Shown in the app's Call button.">
                        <input className="adm-input adm-mono" inputMode="tel" value={form.store_phone} onChange={(e) => set('store_phone', e.target.value)} placeholder={STORE_NUMBER} />
                        {sample('store_phone')}
                    </Field>
                    <Field label="WhatsApp" error={err('whatsapp')} hint="Used by the app's WhatsApp button.">
                        <input className="adm-input adm-mono" inputMode="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder={STORE_NUMBER} />
                        {sample('whatsapp')}
                    </Field>
                    <Field label="Manual USD → IQD rate (optional)" error={err('usd_iqd_rate')} hint={autoHint}>
                        <input className="adm-input" inputMode="decimal" value={form.usd_iqd_rate} onChange={(e) => set('usd_iqd_rate', e.target.value)}
                            placeholder={pricing.auto ? `Automatic (${Math.round(pricing.auto.rate).toLocaleString('en-US')})` : 'Automatic'} />
                    </Field>
                    <div className="adm-card adm-example">
                        <span className="adm-label-sm">Example</span>
                        <p>A $100.00 Zoho item shows as <strong>{example ? formatIqd(example) : '—'}</strong>.</p>
                        <p className="adm-muted adm-small">Delivery orders add {Number.isInteger(fee) && fee > 0 ? formatIqd(fee) : '—'}; pickup adds 0 IQD.</p>
                    </div>
                </div>
                <Toggle
                    checked={form.show_out_of_stock}
                    onChange={(v) => set('show_out_of_stock', v)}
                    label="Show sold-out products in the app"
                    hint="Off = products with no stock disappear from the app until Zoho has stock again. Home rails never show them either way."
                />
                <div className="adm-row">
                    <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || !dirty}>
                        {busy ? <Spinner size={14} /> : <Save size={16} />} Save app settings
                    </button>
                    {row?.updated_at && <span className="adm-muted adm-small">Last saved {formatDateTime(row.updated_at)}</span>}
                </div>
            </form>
        </section>
    );
}

/**
 * FIB and card in the app (20261110120000_app_online_payments.sql). Each switch only decides whether
 * checkout offers the method; the money flow itself runs in the Supabase edge functions with the FIB
 * credentials kept in Edge Function secrets. BACKEND.md "Apps: online payments".
 */
function OnlinePayments() {
    const { settings } = useCatalog();
    if (settings.status !== 'ready') return null;
    const r = settings.row;
    if (r && !('fib_enabled' in r)) {
        return (
            <section className="adm-panel">
                <h2 className="adm-h2"><CreditCard size={18} /> Online payments</h2>
                <Notice tone="warn">The online payments migration (20261110120000) is not applied to this database yet.</Notice>
            </section>
        );
    }
    const formKey = r ? [r.fib_enabled, r.card_enabled, r.pay_window_minutes].join('|') : 'new';
    return <OnlinePaymentsForm key={formKey} row={r} />;
}

function OnlinePaymentsForm({ row }) {
    const toast = useToast();
    const { saveSettings } = useCatalog();
    const [fib, setFib] = useState(row?.fib_enabled === true);
    const [card, setCard] = useState(row?.card_enabled === true);
    const [windowText, setWindowText] = useState(String(row?.pay_window_minutes ?? 60));
    const [busy, setBusy] = useState(false);
    const minutes = Number(windowText.replace(/[,\s]/g, ''));
    const windowError = !Number.isInteger(minutes) || minutes < 15 || minutes > 1440 ? 'Whole minutes from 15 to 1440.' : undefined;
    const dirty = fib !== (row?.fib_enabled === true) || card !== (row?.card_enabled === true) || minutes !== (row?.pay_window_minutes ?? 60);

    const submit = async (e) => {
        e.preventDefault();
        if (windowError) {
            toast(windowError, 'error');
            return;
        }
        const turningOn = (fib && row?.fib_enabled !== true) || (card && row?.card_enabled !== true);
        if (turningOn && !window.confirm('Customers will be able to pay with this method in the app. Turn it on only after the FIB credentials are set in Supabase (Edge Functions → Secrets) and a test payment worked. Continue?')) return;
        setBusy(true);
        try {
            await saveSettings({ fib_enabled: fib, card_enabled: card, pay_window_minutes: minutes });
            toast('Online payment settings saved. The app offers them on its next refresh.');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="adm-panel">
            <h2 className="adm-h2"><CreditCard size={18} /> Online payments</h2>
            <p className="adm-muted adm-small">
                Off = checkout shows only cash on delivery and pay at the store. An order paid with FIB or a card is placed unpaid and
                cannot be confirmed until the payment arrives; one that is not paid in time is cancelled by itself. Refunds are made
                from FIB&apos;s merchant portal, then recorded here with Mark refunded on the order.
            </p>
            <form className="adm-form" onSubmit={submit} noValidate>
                <Toggle checked={fib} onChange={setFib} label="FIB (First Iraqi Bank app)" hint="The customer scans a QR code or opens the FIB app to pay." />
                <Toggle checked={card} onChange={setCard} label="Card (Visa / Mastercard)" hint="The customer pays on First Iraqi Bank's secure card page (3-D Secure)." />
                <div className="adm-form-grid">
                    <Field label="Time to pay (minutes)" error={windowError} hint="After this an unpaid FIB / card order is cancelled. 60 by default.">
                        <input className="adm-input" inputMode="numeric" value={windowText} onChange={(e) => setWindowText(e.target.value)} />
                    </Field>
                </div>
                <div className="adm-row">
                    <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || !dirty}>
                        {busy ? <Spinner size={14} /> : <Save size={16} />} Save online payments
                    </button>
                </div>
            </form>
        </section>
    );
}

/** The website's site_settings row, exactly as the old dashboard managed it (the storefront reads it). */
function WebsiteSettings() {
    const { settings, setSettings, settingsError, isLoadingSettings } = useStoreSettings();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [success, setSuccess] = useState('');

    const handleCategoryImageChange = (index, image) => {
        setSettings((prev) => {
            const next = [...prev.featuredCategories];
            next[index] = { ...next[index], image };
            return { ...prev, featuredCategories: next };
        });
    };

    const handleCategoryImageUpload = async (index, e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setSaveError('');
        try {
            handleCategoryImageChange(index, await imageFileToDataUrl(file, { maxWidth: 900 }));
        } catch (error) {
            setSaveError(error.message);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveError('');
        setSuccess('');
        try {
            const saved = await saveSiteSettings(settings);
            setSettings(saved);
            setSuccess('Website settings saved.');
        } catch {
            setSaveError('Unable to save settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="adm-panel">
            <h2 className="adm-h2"><Globe size={18} /> Website</h2>
            <p className="adm-muted adm-small">The featured categories on itlandforcomputer.com.</p>
            <form onSubmit={handleSave} className="adm-form">
                {isLoadingSettings && <Spinner label="Loading website settings…" />}
                {settingsError && <Notice tone="error">{settingsError}</Notice>}
                {saveError && <Notice tone="error">{saveError}</Notice>}
                {success && !saveError && <Notice tone="ok">{success}</Notice>}

                {settings.featuredCategories && (
                    <>
                        <h3 className="adm-h3">Featured categories</h3>
                        <div className="adm-cat-grid">
                            {settings.featuredCategories.map((cat, index) => (
                                <div key={index} className="adm-card adm-cat">
                                    <strong>{cat.name}</strong>
                                    <span className="adm-cat__img">
                                        {cat.image ? <img src={cat.image} alt={cat.name} /> : <span className="adm-muted">No image</span>}
                                    </span>
                                    <input className="adm-input" type="text" value={cat.image} onChange={(e) => handleCategoryImageChange(index, e.target.value)}
                                        placeholder="Enter image URL..." aria-label={`${cat.name} image URL`} />
                                    <label className="adm-btn adm-btn--ghost adm-btn--sm">
                                        <Upload size={14} /> Upload
                                        <input type="file" accept="image/*" hidden onChange={(e) => handleCategoryImageUpload(index, e)} />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="adm-row">
                    <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
                        {saving ? <Spinner size={14} /> : <Save size={16} />} {saving ? 'Saving…' : 'Save website settings'}
                    </button>
                </div>
            </form>
        </section>
    );
}
