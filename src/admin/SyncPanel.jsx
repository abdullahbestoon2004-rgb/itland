import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useCatalog } from './context';
import { Spinner } from './ui';
import { formatDateTime, rateSourceText, relativeTime } from './lib';

// The database syncs every 10 minutes; past this the last sync is shown as late.
const LATE_MS = 30 * 60 * 1000;

const rateText = (rate) => `1 USD = ${Math.round(Number(rate)).toLocaleString('en-US')} IQD`;

/** Catalog sync status (app_settings) and the "Sync now" button. */
export default function SyncPanel() {
    const { settings, pricing, sync, syncNow, now } = useCatalog();
    if (settings.status !== 'ready') return null;
    const row = settings.row ?? {};
    const synced = row.catalog_synced_at;
    const late = !synced || now - Date.parse(synced) > LATE_MS;

    let rateSub;
    if (pricing.source === 'manual') {
        rateSub = `Manual (Settings)${pricing.auto ? ` · market rate ${Math.round(pricing.auto.rate).toLocaleString('en-US')} (${rateSourceText(pricing.auto.source)})` : ''}`;
    } else if (pricing.source !== 'none') {
        rateSub = `${rateSourceText(pricing.source)} · observed ${formatDateTime(pricing.asOf)}`;
    } else {
        rateSub = pricing.lastRate?.asOf
            ? `The last market rate (${formatDateTime(pricing.lastRate.asOf)}) is over 3 days old`
            : 'No market rate synced yet';
    }

    return (
        <section className="adm-sync" aria-label="Catalog sync">
            <div className="adm-sync__facts">
                <div className="adm-sync__fact">
                    <span className="adm-label-sm">Last sync</span>
                    <strong className={late ? 'adm-warn-text' : undefined}>{synced ? relativeTime(synced, now) : 'Never'}</strong>
                    <span className="adm-muted adm-small">{synced ? formatDateTime(synced) : 'Runs every 10 minutes'}</span>
                </div>
                <div className="adm-sync__fact">
                    <span className="adm-label-sm">Zoho items</span>
                    <strong>{row.catalog_items !== null && row.catalog_items !== undefined ? Number(row.catalog_items).toLocaleString('en-US') : '—'}</strong>
                    <span className="adm-muted adm-small">active in Zoho Books</span>
                </div>
                <div className="adm-sync__fact adm-sync__fact--wide">
                    <span className="adm-label-sm">Rate in use</span>
                    <strong className={pricing.rate ? undefined : 'adm-danger-text'}>{pricing.rate ? rateText(pricing.rate) : 'No rate: the app hides products priced from Zoho'}</strong>
                    <span className="adm-muted adm-small">{rateSub}</span>
                </div>
                <button type="button" className="adm-btn adm-btn--ghost adm-sync__btn" onClick={syncNow} disabled={sync.running}>
                    <RefreshCw size={16} className={sync.running ? 'adm-spin' : ''} aria-hidden="true" /> {sync.running ? 'Syncing…' : 'Sync now'}
                </button>
            </div>
            {sync.running && <p className="adm-muted adm-small"><Spinner size={12} /> {sync.step}</p>}
            {row.sync_error && (
                <p className="adm-danger-text adm-small" role="alert">
                    Sync problem{row.sync_error_at ? ` (${formatDateTime(row.sync_error_at)})` : ''}: {row.sync_error}
                </p>
            )}
        </section>
    );
}
