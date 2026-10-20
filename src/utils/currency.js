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

export function formatIqd(usd, snapshot) {
    if (!isFreshRate(snapshot) || !Number.isFinite(Number(usd))) return null;
    return `${Math.round(Number(usd) * snapshot.rate).toLocaleString('en-US')} IQD`;
}
