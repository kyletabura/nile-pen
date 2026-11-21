# The Nile Pen

| Part | Address | Folder | Vercel project |
|---|---|---|---|
| Public site | https://thenilepen.com | `site/` | `nile-post` (root directory `site`) |
| Newsroom dashboard (CMS) | https://app.thenilepen.com | `app/` | `nile-pen-app` (root directory `app`) |
| Content, logins, images | Supabase project `nile-pen` (Frankfurt) | `supabase/` | — |

## How publishing works
1. Editors write and publish in the dashboard. Everything is stored in Supabase.
2. Publishing (or the **Publish changes** button) calls the database function `request_publish`, which pings a private Vercel deploy hook.
3. Vercel runs `site/build.mjs`: it reads all published stories, topics and settings from Supabase and writes one static page per URL (`/`, `/live`, `/topic/<slug>`, `/article/<slug>`, ...), plus `sitemap.xml`, `feed.xml` and `robots.txt`. The site is live about a minute later.
4. The build stops with an error instead of publishing an empty site if Supabase returns nothing.

## Forms
The Submit-a-story, Contact/Advertise and newsletter forms on the public site save straight into Supabase (`submissions`, `messages`, `subscribers`). The public can add rows but never read them. A honeypot field and a per-address rate limit block simple spam. Editors handle everything under **Pitches**, **Messages** and **Subscribers**.

## Security
- Sign-in: email + password. New and reset accounts get a temporary password that only lets them choose their own (12+ characters, strength rules); the database refuses everything else until they do.
- Two-step verification (authenticator app) per person under Settings. Once on, the database only accepts sessions that passed the code check (`aal2`), so a stolen password alone sees nothing.
- Forgot password: emailed reset link to `/reset-password`. Owners can also issue a temporary password or reset someone's two-step from Team.
- Repeated wrong passwords pause sign-in in the browser (1 min, doubling up to 30 min) on top of Supabase's server-side rate limits. One hour without activity signs the dashboard out. "Sign out everywhere" ends every session.
- Owners see recent sign-ins and account changes under Settings → Sign-in activity.
- Row-level security on every table; only people listed in `editors` can read submissions or change content.
- Team accounts are created and reset only through the `manage-editors` edge function, which checks the caller is an owner.
- Images go to the public `media` bucket; only editors can upload or delete (10 MB limit, images only).
- Both sites send CSP, HSTS, nosniff, frame-blocking, referrer and permissions headers (`site/vercel.json`, `app/vercel.json`). The dashboard is `noindex`.

## Working on it locally
- Site: `cd site && node build.mjs` then serve `site/dist`.
- Dashboard: `cd app && npm install && npm run dev` (http://localhost:5173).
