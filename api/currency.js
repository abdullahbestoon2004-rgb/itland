import { MARKET_SOURCE, isFreshRate, parseMarketRate } from '../src/utils/currency.js';

let cached = null;
let expires = 0;
let pending = null;

export async function getCurrencyRate() {
    if (cached && Date.now() < expires && isFreshRate(cached)) return cached;
    if (!pending) pending = (async () => {
        const response = await fetch(MARKET_SOURCE, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Rate provider unavailable');
        const snapshot = parseMarketRate(await response.json());
        cached = snapshot;
        expires = Date.now() + 5 * 60_000;
        return snapshot;
    })().finally(() => { pending = null; });
    return pending;
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
    try {
        const rate = await getCurrencyRate();
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        res.statusCode = 200;
        return res.end(JSON.stringify(rate));
    } catch {
        // Never pass a stale observation off as a current selling price.
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: 'IQD prices are temporarily unavailable. Please confirm the price on WhatsApp.' }));
    }
}
