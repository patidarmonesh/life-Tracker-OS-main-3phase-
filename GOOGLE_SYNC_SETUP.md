# Google Calendar + lasting Drive sync (Vercel)

The app now uses a Google authorization-code flow with offline access. Access tokens refresh through `/api/google-auth`; the refresh token is encrypted in a Secure, HttpOnly, SameSite cookie and is never exposed to client JavaScript. The existing browser-only sign-in still works when the backend is not configured, but cannot provide lasting refresh.

## One-time setup

1. In the Google Cloud project used by this app, enable **Google Drive API** and **Google Calendar API**.
2. Configure a **Web application** OAuth client. Add your production origin to Authorized JavaScript origins, for example `https://your-app.vercel.app`.
3. Add this exact Authorized redirect URI (including query string):
   `https://your-app.vercel.app/api/google-auth?action=callback`
4. Configure the consent screen with `openid`, `email`, `profile`, `drive.file`, and `calendar.events`. Add your account as a test user if the app is in Testing.
5. For lasting use, move the OAuth consent screen to **Production** and complete any verification Google requires. External apps left in Testing normally receive refresh tokens that expire after seven days for these scopes. No application code can override that Google restriction.
6. In Vercel → Project → Settings → Environment Variables, set these for Production:

   | Variable | Value |
   | --- | --- |
   | `APP_URL` | Your exact production origin, e.g. `https://your-app.vercel.app` |
   | `GOOGLE_CLIENT_ID` | Web OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Web OAuth client secret; server-only |
   | `SESSION_SECRET` | Random secret at least 32 characters; server-only |
   | `VITE_GOOGLE_CLIENT_ID` | Same client ID (for the existing browser fallback) |
   | `VITE_GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |

   Generate a session secret locally with:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`

   Do **not** prefix the client secret or session secret with `VITE_`. Vite exposes such variables in the public browser bundle. Keep these values in Vercel, not source control or chat. `.env.example` contains placeholders only.

7. Redeploy. Open Settings → API Configuration → **Connect Google Calendar & Drive**. Allow both services once. The status should show automatic refresh enabled.
8. Add your personal Gemini API key in the existing app Settings and test it. The planner, diary reader and contextual assistant use that key. It stays in this browser, is excluded from Drive settings sync, and is sent only to Google's Gemini API. `VITE_GEMINI_API_KEY` is supported for legacy installations but embeds the key in the public bundle; prefer Settings.

Google can still require reconnection when access is revoked, cookies are cleared, the session expires, or Google invalidates the refresh token. The application cookie renews when used and expires after 180 days of inactivity. Changing `SESSION_SECRET` logs out all server sessions. Ordinary hourly access-token expiry no longer requires reconnecting.

## Daily workflow

- Time Flow → choose a date → **Plan my day**. Type notes, upload a diary image, take a photo on supported devices, or enter slots manually. AI accepts Hindi, Hinglish and English. Review suggested times and unclear handwriting before saving.
- Saved plans are separate from actual logs. Enabling Calendar sync sends events to the primary calendar, using the profile timezone. Each event has a reminder at its start and at the selected lead time. Allow Google Calendar notifications on your device.
- Sync runs while LifeOS is open. Network failures stay queued locally and retry when online, after token renewal, or once per minute. Events already synced continue to notify through Google Calendar while LifeOS is closed. This app does not run a Vercel cron or a background reminder service.
- After a slot ends, the app displays a check-in link across pages. In Time Flow record what happened, actual times and the reason for a change. You can link an existing actual log instead of duplicating it. Pending slots stay unknown until reviewed.
- Adherence is the confirmed matching time inside the planned slot divided by reviewed planned time. For partially completed tasks choose the same activity with its actual shorter times; add a reason. For another activity choose Changed/Missed. Overdue unanswered slots are not automatically labelled failures.
- Plan edits update the same Calendar event. Removing slots or turning off sync queues Calendar deletion. Actual logs are kept. Re-enabling sync creates a fresh event. This is **one-way plan-to-Calendar sync**; editing an event in Google does not rewrite your LifeOS plan.
- Use **Ask AI about…** on any page for contextual suggestions. No AI-generated change is silently saved by this new assistant.

## Local development and verification

`npm ci`, `npm run dev`, `npm run build`, `npm test`, `npm run test:browser`.

For browser tests run `npx playwright install chromium` once. Tests use isolated sample data and mocked Google/Gemini responses; they do not touch a real account.

`vite` alone serves the frontend. To exercise server auth locally use `npx vercel dev`, server environment variables, `APP_URL=http://localhost:3000`, and the matching localhost redirect URI in Google Cloud. Secure cookies are required on deployed HTTPS origins.

Live OAuth consent, refresh-token longevity, handwriting accuracy and device notifications must be checked against your configured Google project and Gemini key after deployment. These cannot be proven with local mocks.

Primary references: [Google offline OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server), [refresh token limits and Testing restriction](https://developers.google.com/identity/protocols/oauth2), [Calendar event fields and reminders](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Gemini models](https://ai.google.dev/gemini-api/docs/models).
