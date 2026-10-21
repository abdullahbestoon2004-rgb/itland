// Production preview, including server-rendered HTML. Run after npm run build.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import pageHandler from '../api/page.js';
import sitemapHandler from '../api/sitemap.js';
import productsHandler from '../api/products.js';
import currencyHandler from '../api/currency.js';
try { process.loadEnvFile('.env'); } catch { /* Environment may be injected by the caller. */ }
const root = resolve('dist');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const port = Number(process.env.PREVIEW_PORT || 4173);
http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    req.query = Object.fromEntries(url.searchParams);
    res.status = code => { res.statusCode = code; return res; };
    res.send = value => { res.end(value); return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    res.redirect = (code, location) => { res.writeHead(code, { Location: location }); res.end(); return res; };
    try {
        if (url.pathname === '/sitemap.xml') return await sitemapHandler(req, res);
        if (url.pathname === '/api/products') return await productsHandler(req, res);
        if (url.pathname === '/api/currency') return await currencyHandler(req, res);
        const file = resolve(root, '.' + decodeURIComponent(url.pathname));
        if (file.startsWith(root + '/') && extname(file) && !file.endsWith('.html')) {
            try { const bytes = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); return res.end(bytes); } catch { /* Render a genuine 404 below. */ }
        }
        await pageHandler(req, res);
    } catch (error) {
        console.error('Preview request failed:', error.message);
        res.writeHead(500); res.end('Preview error');
    }
}).listen(port, '127.0.0.1', () => console.log(`SSR preview: http://127.0.0.1:${port}`));
