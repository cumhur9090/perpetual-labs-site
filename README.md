# Perpetual Labs — website + gated research newsletter (v4)

The live perpetual-labs.ai site: the public marketing page plus a **server-side
password-gated** research newsletter. Deployed on Vercel (Edge Middleware).

**v4 (2026-08-05):** `index.html` compiled from the client's Claude-artifact
export `build-tools/source-v4.dc.html` via `build-tools/compile_site.py`
(`python3 build-tools/compile_site.py build-tools/source-v4.dc.html index.html`).
For a future v5 export, rerun the compiler on the new `.dc.html` — it resolves
`sc-if` props, converts `style-hover`/`style-focus` to real CSS, adds SEO head,
and appends the mobile-header fix. Everything else (gate, api, data.html,
perpetual-os.html) is carried over byte-identical from `~/perpetual-site-v3`.

> ⚠️ **Keep this repo private.** It contains the newsletter content (papers,
> analyses, PDFs) that the password protects. A public repo would leak it.

## Layout
- `index.html`, `assets/` — public marketing page (nav has a **newsletter** tab).
- `gate.html` — the minimal "under construction" + password page (public).
- `newsletter.html`, `newsletter/` — the gated content (landing, 17 analyses, 3D brain, PDFs, data). **Served only with a valid session.**
- `middleware.js` — Edge Middleware: gates `/newsletter.html` + `/newsletter/*`; no valid `pl_session` cookie ⇒ rewrites to `gate.html`. Content never leaves the edge unauthenticated.
- `api/unlock.js` — checks the password (env var) and sets an HMAC-signed, HttpOnly, 24h session cookie. Wrong guesses throttled.
- `api/lock.js` — clears the session (the in-page "lock" link).
- `vercel.json` — headers (noindex + no-store on the gated paths).

## How the gate works
Password lives only in the `NEWSLETTER_PASSWORD` env var (never shipped to the
browser). The session cookie is an HMAC token signed with `SESSION_SECRET`, so it
can't be forged. Rotating `SESSION_SECRET` invalidates every existing session.

## Deploy
1. Import into Vercel (or `vercel --prod`).
2. Set two **Environment Variables** (Project → Settings → Environment Variables, Production) — see `.env.example`:
   - `NEWSLETTER_PASSWORD` — the team password.
   - `SESSION_SECRET` — a long random string (`openssl rand -hex 32`).
3. Deploy. `/` is public; the **newsletter** tab → `/newsletter.html` shows the gate; the password unlocks for 24h.

To change the password: update `NEWSLETTER_PASSWORD` and redeploy. To boot all
sessions: rotate `SESSION_SECRET` and redeploy.
