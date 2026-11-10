import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Database, ImageOff, Info, Loader2, Package, Upload, X } from 'lucide-react';
import { LANGS, MIGRATION_FILES, SEED_FILE, bundledName, copyText, isBundledImage, isWebImage, uploadMedia } from './lib';

export function Spinner({ size = 16, label }) {
    return (
        <span className="adm-spinner" role={label ? 'status' : undefined}>
            <Loader2 size={size} className="adm-spin" aria-hidden="true" />
            {label && <span>{label}</span>}
        </span>
    );
}

export function Notice({ tone = 'info', title, children, action }) {
    const Icon = tone === 'error' || tone === 'warn' ? AlertTriangle : Info;
    return (
        <div className={`adm-notice adm-notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
            <Icon size={18} aria-hidden="true" className="adm-notice__icon" />
            <div className="adm-notice__body">
                {title && <strong>{title}</strong>}
                {children && <div>{children}</div>}
            </div>
            {action}
        </div>
    );
}

/** The state shown when a query fails; missing tables get setup instructions. */
export function DbNotice({ error, onRetry }) {
    if (!error) return null;
    const retry = onRetry ? <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onRetry}>Retry</button> : null;
    if (error.missing) {
        return (
            <div className="adm-setup">
                <Database size={22} aria-hidden="true" />
                <div>
                    <strong>Run the app backend migrations in Supabase</strong>
                    <p>
                        This section needs the mobile app tables. Open Supabase → SQL Editor and run
                        {' '}{MIGRATION_FILES.map((f, i) => <React.Fragment key={f}>{i > 0 ? ', then ' : ''}<code>{f}</code></React.Fragment>)}.
                        {' '}On a new, empty database, also run <code>{SEED_FILE}</code> for the curated products. Never run it
                        {' '}again after that: it overwrites the curated products and the changes made to them here.
                    </p>
                </div>
                {retry}
            </div>
        );
    }
    return <Notice tone="error" title="Could not load" action={retry}>{error.message}</Notice>;
}

export function EmptyState({ icon = Package, title, children }) {
    const Icon = icon;
    return (
        <div className="adm-empty">
            <Icon size={28} aria-hidden="true" />
            <strong>{title}</strong>
            {children && <p>{children}</p>}
        </div>
    );
}

export function Badge({ tone = 'neutral', children, title }) {
    return <span className={`adm-badge adm-badge--${tone}`} title={title}>{children}</span>;
}

export function Field({ label, hint, error, children, className = '', htmlFor }) {
    return (
        <div className={`adm-field ${error ? 'adm-field--error' : ''} ${className}`}>
            {label && <label className="adm-field__label" htmlFor={htmlFor}>{label}</label>}
            {children}
            {error ? <p className="adm-field__error">{error}</p> : hint ? <p className="adm-field__hint">{hint}</p> : null}
        </div>
    );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
    const id = useId();
    return (
        <label className={`adm-toggle ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
            <input id={id} type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
            <span className="adm-toggle__track" aria-hidden="true"><span className="adm-toggle__thumb" /></span>
            <span className="adm-toggle__text">
                <span>{label}</span>
                {hint && <small>{hint}</small>}
            </span>
        </label>
    );
}

export function Segmented({ value, options, onChange, label }) {
    return (
        <div className="adm-seg" role="tablist" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={value === o.value}
                    className={`adm-seg__btn ${value === o.value ? 'is-active' : ''}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                    {o.count !== undefined && <span className="adm-seg__count">{o.count}</span>}
                </button>
            ))}
        </div>
    );
}

// Open drawers, newest last, so Escape closes only the top one.
const drawerStack = [];

export function Drawer({ open, title, subtitle, onClose, children, footer, wide = false }) {
    const panelRef = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);
    useEffect(() => {
        if (!open) return undefined;
        const token = {};
        drawerStack.push(token);
        const onKey = (e) => {
            if (e.key === 'Escape' && drawerStack[drawerStack.length - 1] === token) closeRef.current();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            drawerStack.splice(drawerStack.indexOf(token), 1);
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    if (!open) return null;
    return (
        <div className="adm-drawer" role="presentation">
            <button type="button" className="adm-drawer__scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
            <section
                ref={panelRef}
                className={`adm-drawer__panel ${wide ? 'adm-drawer__panel--wide' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                tabIndex={-1}
            >
                <header className="adm-drawer__head">
                    <div>
                        <h2>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Close panel"><X size={18} /></button>
                </header>
                <div className="adm-drawer__body">{children}</div>
                {footer && <footer className="adm-drawer__foot">{footer}</footer>}
            </section>
        </div>
    );
}

/** Product/banner image: web URLs render; 'asset:' images live inside the app bundle. */
export function Thumb(props) {
    // Keyed by src so a new image gets a fresh load/failed state.
    return <ThumbImage key={props.src ?? ''} {...props} />;
}

function ThumbImage({ src, alt = '', size = 44, className = '' }) {
    const [failed, setFailed] = useState(false);
    const style = { width: size, height: size };
    if (isBundledImage(src)) {
        return (
            <span className={`adm-thumb adm-thumb--bundled ${className}`} style={style} title={`Bundled in app: ${bundledName(src)}`}>
                <Package size={Math.max(14, size * 0.36)} aria-hidden="true" />
                {size >= 72 && <small>Bundled in app</small>}
            </span>
        );
    }
    if (isWebImage(src) && !failed) {
        return (
            <span className={`adm-thumb ${className}`} style={style}>
                <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
            </span>
        );
    }
    return (
        <span className={`adm-thumb adm-thumb--none ${className}`} style={style} title={failed ? 'Image failed to load' : 'No image'}>
            <ImageOff size={Math.max(14, size * 0.34)} aria-hidden="true" />
        </span>
    );
}

/** en / ar / ku inputs for a jsonb {"en","ar","ku"} field. The admin types every language. */
export function LangFields({ label, value, onChange, hint, multiline = false, placeholder }) {
    const v = value && typeof value === 'object' ? value : {};
    const Input = multiline ? 'textarea' : 'input';
    return (
        <fieldset className="adm-lang">
            <legend className="adm-field__label">{label}</legend>
            {LANGS.map((lang) => (
                <div key={lang.code} className="adm-lang__row">
                    <span className="adm-lang__code" title={lang.label}>{lang.code.toUpperCase()}</span>
                    <Input
                        className="adm-input"
                        dir={lang.dir}
                        lang={lang.code === 'ku' ? 'ckb' : lang.code}
                        value={v[lang.code] ?? ''}
                        placeholder={lang.code === 'en' ? placeholder : `${lang.label}`}
                        rows={multiline ? 2 : undefined}
                        onChange={(e) => onChange({ ...v, [lang.code]: e.target.value })}
                        aria-label={`${label} (${lang.label})`}
                    />
                </div>
            ))}
            {hint && <p className="adm-field__hint">{hint}</p>}
        </fieldset>
    );
}

/** Upload to Supabase Storage (app-media) or paste a URL. `fallback` is shown while empty (e.g. Zoho's photo). */
export function ImageInput({ value, onChange, folder, onError, label = 'Image', hint, fallback, placeholder = 'https://… or asset:file.webp' }) {
    const [busy, setBusy] = useState(false);
    const inputId = useId();
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
            onChange(await uploadMedia(file, folder));
        } catch (err) {
            onError?.(err.message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <Field label={label} hint={hint} htmlFor={inputId}>
            <div className="adm-image-input">
                <Thumb src={value || fallback} size={88} />
                <div className="adm-image-input__side">
                    <input
                        id={inputId}
                        className="adm-input"
                        value={value ?? ''}
                        placeholder={placeholder}
                        onChange={(e) => onChange(e.target.value.trim() || null)}
                    />
                    <div className="adm-row">
                        <label className={`adm-btn adm-btn--ghost adm-btn--sm ${busy ? 'is-busy' : ''}`}>
                            {busy ? <Spinner size={14} /> : <Upload size={14} aria-hidden="true" />}
                            {busy ? 'Uploading…' : 'Upload image'}
                            <input type="file" accept="image/*" hidden onChange={handleFile} disabled={busy} />
                        </label>
                        {value && (
                            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onChange(null)}>Remove</button>
                        )}
                    </div>
                </div>
            </div>
        </Field>
    );
}

export function Stat({ label, value, sub, tone = 'neutral', icon }) {
    const Icon = icon;
    return (
        <div className={`adm-stat adm-stat--${tone}`}>
            <div className="adm-stat__label">{Icon && <Icon size={14} aria-hidden="true" />}{label}</div>
            <div className="adm-stat__value">{value}</div>
            {sub && <div className="adm-stat__sub">{sub}</div>}
        </div>
    );
}

/** A small "copy" button for ids (Zoho item ids, product ids). */
export function CopyButton({ value, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    if (!value) return null;
    const handle = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(await copyText(value))) return;
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button type="button" className="adm-copy" onClick={handle} title={`${label} ${value}`} aria-label={`${label} ${value}`}>
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            <span>{copied ? 'Copied' : label}</span>
        </button>
    );
}
