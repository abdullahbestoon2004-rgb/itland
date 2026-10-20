# IT Land Storefront

React + Vite storefront. Products come from Zoho Books through `/api/products`;
site settings, contact messages, newsletter signups and customer reviews live in
Supabase. Admin access is Google sign-in, restricted by an allow-list in the
database.

## 1. Environment variables

Copy `.env.example` to `.env` and fill it in.

Browser (safe to expose, `VITE_` prefixed):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (legacy `VITE_SUPABASE_ANON_KEY` remains supported)

Server-only (set these in Vercel → Settings → Environment Variables, never with a
`VITE_` prefix):

- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ORG_ID`
- `ZOHO_AUTH_DOMAIN` / `ZOHO_API_DOMAIN` (only for EU/IN/AU Zoho accounts)

## 2. Database setup

Run the migrations in `supabase/migrations/` in order, via the Supabase SQL
Editor or `supabase db push`:

1. `0001_admin_auth_and_public_forms.sql` — creates `admin_users`,
   `contact_messages`, `newsletter_subscribers`, `reviews`, and locks every table
   down with row level security. Settings stay world-readable and admin-writable;
   contact and newsletter rows are write-only for the public; reviews are visible
   only once approved.
2. `0002_seed_admin.sql` — edit the email first, then run it to grant yourself
   admin access. Add one row per admin.

Security note: the `is_admin()` check inside those policies is the real gate. The
frontend flag only decides what the UI renders, so a tampered browser gets
nothing.

3. `20261020131713_restrict_public_form_permissions.sql` — grants only the required public-form operations and limits private data to allow-listed signed-in admins.

## 3. Google sign-in

In the Supabase dashboard:

1. **Authentication → Providers → Google** — enable it, and paste in the client ID
   and secret from a Google Cloud OAuth 2.0 Web application credential.
2. In Google Cloud, set the authorised redirect URI to
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. **Authentication → URL Configuration** — set the Site URL to
   `https://itlandforcomputer.com` and add `http://localhost:5173` plus
   `https://itlandforcomputer.com/admin/dashboard` as redirect URLs.

Admins then sign in at `/admin/login`. An account that is not in `admin_users`
is signed in but refused the dashboard.

## 4. Local development

```bash
npm install
npm run dev           # storefront on http://localhost:5173
node local-api-server.mjs   # serves /api/* locally (optional)
```

## 5. Deploy

Vercel. `vercel.json` rewrites `/sitemap.xml` to the generator in `api/sitemap.js`
(which lists every product page) and sends everything else to the SPA.

## Notes

- Product content is managed in Zoho Books. The dashboard's **Refresh from Zoho**
  button bypasses the one-hour cache; it is throttled to once every 30 seconds.
- `src/data/productCatalog.json` is a built-in fallback used only when the Zoho
  API is unreachable. It is lazy-loaded so it stays out of the initial bundle.
- Reviews submitted on the storefront stay hidden until approved in the
  dashboard's Reviews tab.

## IQD prices and WhatsApp orders

- `/api/currency` reads the public IQWealth Baghdad market feed at
  `https://iraqsm.com/data/fx.json`, the same source as Tawaf. It uses the mean of
  the parallel buy/sell rates, validates units and timestamps, rejects stale data,
  and caches successful reads for five minutes. No API key is required.
- Catalog prices remain USD internally; customer-facing product prices, price
  filters, cart totals and prepared WhatsApp messages use IQD. The final quote,
  delivery fee, timing and payment method are confirmed in WhatsApp.
- Run both `npm run dev` and `node local-api-server.mjs` locally. Vercel serves the
  same currency handler from `api/currency.js` in production.
- Customer shopping controls and the shopping-help pages support English, Sorani
  Kurdish and Arabic, with a saved language choice and right-to-left layouts.
  Product names and technical specifications retain their catalog language.
- Delivery is across all Iraq and Kurdistan. Shipping fees, dates, warranty
  durations and return terms are confirmed by the team; no unprovided terms are
  promised on the site. Placeholder social links are hidden until official links
  are available.
- Both newsletter forms use the same Supabase signup service. Failed writes show
  an error rather than a success message. Apply the existing public-form migration
  if the newsletter table has not yet been created.
- `npm test` checks stock restrictions, internal-price cleanup, IQD validation,
  WhatsApp requests, rendered purchase controls and mocked newsletter writes. It
  does not send messages or create live subscriber records.


## Connected IT Land backend

The local storefront now uses project `oqvddrybohahzghgrjeu` (`itland`) in
**Abdulla’s projects**, region `ap-south-1`. Its URL and public publishable key
are configured in `.env`. Server secrets are not required for public forms.
The schema and configured admin allow-list have been applied to this project.

Google admin sign-in is configured using the dedicated Google Cloud project
`iconic-rampart-512213-c5` (IT Land). The callback is
`https://oqvddrybohahzghgrjeu.supabase.co/auth/v1/callback`, with exact admin-dashboard
return URLs for the production domain, localhost:5173 and 127.0.0.1:5173.
On 2026-10-20, a real Google sign-in by the configured administrator successfully
returned to the local admin dashboard. Google OAuth remains in Testing with the
configured administrator as a test user. The client secret is stored in Supabase,
not in this repository. Configure the public URL/key in the hosting environment
when deploying. Orders continue to use WhatsApp.
