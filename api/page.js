import { getCurrencyRate } from './currency.js';
import { readFile } from 'node:fs/promises';
import { renderPage } from '../dist-ssr/entry-server.js';
import { loadCatalog } from '../server/catalog.js';

let templatePromise;
export default async function handler(req, res) {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    const url = new URL(req.url, 'https://itlandforcomputer.com');
    const path = typeof req.query?.__path === 'string' ? req.query.__path : url.pathname;
    url.searchParams.delete('__path');
    templatePromise ??= readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const template = await templatePromise;
    // Authentication stays entirely in the browser. Search engines may fetch these
    // pages to see noindex, but they never receive session-specific HTML.
    if (/^\/(admin|wholesale)(\/|$)/.test(path)) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(template.replace('content="index, follow"', 'content="noindex, nofollow"'));
    }
    try {
        const needsCatalog = path === '/' || path === '/products' || path.startsWith('/product/');
        const [products, snapshot] = await Promise.all([
            needsCatalog ? loadCatalog() : [],
            needsCatalog ? getCurrencyRate().catch(() => null) : null
        ]);
        const page = renderPage(`${path}${url.search}`, products, snapshot);
        if (page.redirect) return res.redirect(301, page.redirect);
        const html = template.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, () => page.head)
            .replace('<div id="root"></div>', () => `<div id="root">${page.body}</div><script id="itland-page-data" type="application/json">${page.data}</script>`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', page.status === 200 ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store');
        if (page.status === 404) res.setHeader('X-Robots-Tag', 'noindex');
        return res.status(page.status).send(req.method === 'HEAD' ? '' : html);
    } catch (error) {
        console.error('Page rendering unavailable:', error.message);
        // Temporary upstream failures must not become indexed empty pages or false 404s.
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', '300');
        return res.status(503).send(template);
    }
}
