# Google sign-in deployment fix — 4 October 2026

The configured SUPABASE_URL was the Supabase dashboard page. LifeOS needs the project API URL:

```
SUPABASE_URL=https://szpstmmggqxetuidnedz.supabase.co
APP_ORIGIN=https://alltracker.vercel.app
```

Set these in Vercel's Production environment and redeploy. SUPABASE_SERVICE_ROLE_KEY must come from the same project. Never put that key in browser variables or Git.

If not already applied, run `server/migrations/001_lifeos.sql`, then `002_timer_leases.sql` in that project's Supabase SQL editor. The Google OAuth Web client must have this exact authorized redirect URI:

```
https://alltracker.vercel.app/api/oauth/callback
```

The old database client accepted HTTP 200 HTML as an empty database result. That allowed Google sign-in to start even though no OAuth state was saved. This version rejects dashboard URLs before sending credentials, requires valid database results and checks that the state was actually saved before opening Google. Invalid cookies cannot consume another browser's state. Conditional deletion keeps the callback single-use, and a shared short-lived cookie survives overlapping attempts.

The manifest now specifies share-target encoding. npm's “packages looking for funding” is informational. The supplied console screenshot is from Google's account page; LifeOS cannot change scripts or browser-extension activity on that page.

Validation: lint, 110 unit/backend tests and the production build pass. All 11 existing browser workflows and two new sign-in browser tests pass. Provider identity/token responses are mocked in automated sign-in tests; these are not proof of live Google login. Production dependency audit: no known vulnerabilities. The Study chart now has an initial size while waiting for browser measurement, avoiding its transient negative-dimension warning.

After deployment, run:

```
npm run test:deployment -- https://alltracker.vercel.app
```

This checks the deployed start/callback routes, state persistence and cookie binding using a simulated cancellation. It creates and consumes only its own temporary request. It does not verify Google's token exchange or Calendar access. Finish verification by signing in in a browser, then connecting Google Calendar from LifeOS.
