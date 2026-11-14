export const MARKET_SOURCE = 'https://iraqsm.com/data/fx.json';
export const MAX_RATE_AGE = 3 * 86400_000;

// Same IQWealth Baghdad market midpoint and freshness checks used by Tawaf.
export function parseMarketRate(market, now = Date.now()) {
    const at = Date.parse(market?.parallel?.publishedAt);
    const generated = Date.parse(market?.generatedAt);
    const buy = market?.parallel?.buy;
    const sell = market?.parallel?.sell;
    if (market?.kind !== 'fx' || market?.unit !== 'IQD per 1 USD' || market?.parallel?.stale !== false ||
        !Number.isFinite(at) || at > now + 300_000 || now - at > MAX_RATE_AGE ||
        !Number.isFinite(generated) || generated > now + 300_000 || generated < at - 300_000 ||
        typeof buy !== 'number' || typeof sell !== 'number' || !Number.isFinite(buy) || !Number.isFinite(sell) ||
        buy < 500 || sell > 5000 || sell < buy || sell / buy > 1.1) {
        throw new Error('Invalid or stale IQD market observation');
    }
    return { rate: (buy + sell) / 2, asOf: new Date(at).toISOString(), provider: 'IQWealth Baghdad market' };
}

export function isFreshRate(snapshot, now = Date.now()) {
    const at = Date.parse(snapshot?.asOf);
    return Number.isFinite(snapshot?.rate) && snapshot.rate >= 500 && snapshot.rate <= 5000 &&
        Number.isFinite(at) && at <= now + 300_000 && now - at <= MAX_RATE_AGE;
}

// Dinar prices end in 000, 250, 500 or 750: the 250 note is the smallest in use.
export const IQD_STEP = 250;

/** One unit's price in dinars, rounded to the nearest 250, or null without a usable rate. */
export function toIqd(usd, snapshot) {
    if (!isFreshRate(snapshot) || !Number.isFinite(Number(usd))) return null;
    return Math.round(Number(usd) * snapshot.rate / IQD_STEP) * IQD_STEP;
}

/**
 * The total for cart lines ({ price, quantity }): each line is its rounded unit
 * price times the quantity, so the total always equals the lines added up.
 */
export function iqdTotal(items, snapshot) {
    if (!isFreshRate(snapshot)) return null;
    return items.reduce((sum, item) => sum + (toIqd(item.price, snapshot) ?? 0) * (Number(item.quantity) || 1), 0);
}

export const formatIqdAmount = (iqd) => (iqd === null || iqd === undefined ? null : `${iqd.toLocaleString('en-US')} IQD`);

/** "50,750 IQD" for a USD price; with a quantity, that many units at the rounded unit price. */
export function formatIqd(usd, snapshot, quantity = 1) {
    const unit = toIqd(usd, snapshot);
    return unit === null ? null : formatIqdAmount(unit * quantity);
}
