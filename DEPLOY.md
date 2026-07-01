# Strength — Deploy Runbook

The app is **code-complete and tested locally**. It is **not yet deployed** — the
Cloudflare token stored on the Pi is DNS-edit-only + IP-locked, so it can't create
Workers/D1/Pages. Deploy needs broader credentials (one-time). Everything below is
the one-time stand-up, then a one-command deploy thereafter.

## 0. Local preview (no Cloudflare needed)

`wrangler dev`'s local runtime (workerd) OOMs on this Pi, so use the Node harness:

```bash
cd strength
npm install
NODE_OPTIONS=--experimental-sqlite node scripts/dev-server.mjs 8787
# → http://localhost:8787   (data persists in strength/.dev.db, gitignored)
```

Run the test suite anytime: `npm test` (15 tests — progression, OpenWeight, worker API).

## 1. Authenticate (one-time)

Either interactive login on a machine with a browser:

```bash
npx wrangler login
```

…or a scoped API token (Workers Scripts: Edit · D1: Edit · Pages: Edit · Account
Settings: Read), then:

```bash
export CLOUDFLARE_API_TOKEN=...          # the new scoped token
export CLOUDFLARE_ACCOUNT_ID=...         # from the Cloudflare dashboard
```

> The existing `credentials/cloudflare.json` token stays DNS-only — used in step 5 for DNS, not for this.

## 2. Create the D1 database (one-time)

```bash
cd strength
npx wrangler d1 create strength
```

Copy the printed `database_id` into `wrangler.jsonc` (replace `PLACEHOLDER_SET_AT_DEPLOY`).

## 3. Create schema + seed the program (one-time)

```bash
npm run db:init:remote     # schema.sql
npm run db:seed:remote     # 5-week program + anchor baselines
```

Re-running `db:seed:remote` is safe — it clears and re-inserts `program`/`anchor_state`
only; it never touches logged sessions.

## 4. Deploy the Worker + assets

```bash
npm run deploy
```

Wrangler serves `public/` (the PWA) and `src/worker.js` (the API) from one Worker.
Note the `*.workers.dev` URL it prints; smoke-test:

```bash
curl https://strength.<account>.workers.dev/api/health   # → {"ok":true}
```

## 5. Custom domain + gate (one-time)

Per the pillar-per-subdomain plan, target `strength.renswork.space` (or a
`/strength` surface under an existing pillar subdomain):

- Add the route/custom domain to the Worker (dashboard → Worker → Triggers → Custom Domains, or `routes` in `wrangler.jsonc`).
- DNS: add the CNAME via the existing DNS-edit token / `credentials/cloudflare.json`.
- Put it behind the **renswork.space shared-cred gate** (same as fitness/wealth) — single private user, no per-user accounts.

## 6. Install on phone

Open the URL in mobile Safari/Chrome → "Add to Home Screen". It installs as a
standalone app, caches the shell, and works offline (saves queue + auto-flush).

## 7. Cutover (Ren's call on timing)

- Retire the old Pi fitness dashboard's training bits.
- Repoint / deprecate `fitness.renswork.space` if it's fully replaced.
- Scipio reads progress via `GET /api/export` (OpenWeight) or `/api/pull` — **not** the Pi Postgres.

## Follow-ups (not blocking deploy)

- **Scipio weekly "still progressing?" cron** (spec §C) — wire after deploy once the API is live; reads `/api/export`, flags any anchor/loaded lift that hasn't moved.
- **Wk 5 re-test flow** — `retestMax()` exists in `src/progression.js`; add a tiny "re-test max" action to the UI when Ren hits Wk 5 (regenerates the anchor table).
