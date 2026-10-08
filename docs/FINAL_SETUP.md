# Deploy this LifeOS update

## Which folder to upload

Use the contents of `LifeOS-google-signin-fixed/LifeOS`, or extract `LifeOS-calendar-drive-final.zip` and use its `LifeOS` folder. Put `package.json`, `vercel.json`, `api`, `server`, `src` and `public` at the GitHub repository root. Include the lockfile and other source/config files. Do not upload node_modules, dist, .git or .env files. The ZIP excludes them.

Push this source to the GitHub repository already connected to your Vercel project. Vercel Root Directory should be `.` when package.json is at the repository root; otherwise select the containing LifeOS folder. Use the Vite preset, `npm run build`, output `dist`, and Node 22 or newer (minimum 22.12). Keep the API/server directories in the repository.

## Existing environment variables

Keep your working Google client ID and matching secret. These features require no new secret names. Production should keep:

```text
APP_ORIGIN=https://alltracker.vercel.app
SUPABASE_URL=https://szpstmmggqxetuidnedz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<existing server key>
GOOGLE_CLIENT_ID=<existing working OAuth web client ID>
GOOGLE_CLIENT_SECRET=<secret from that same web client>
TOKEN_ENCRYPTION_KEY=<keep your existing encryption key unchanged>
GEMINI_API_KEY=<existing Gemini key, for optional AI drafting>
GEMINI_MODEL=<a model supported by your Gemini project>
```

Never prefix secrets with VITE_. Existing VAPID and CRON settings are only for separate LifeOS web push; Google Calendar reminders do not require them. Preserve the SQL tables already installed by migrations 001 and 002. This update adds no SQL migration. Redeploy after editing environment variables. Open the production domain above, rather than a temporary preview hostname.

## Google setup (one time)

In the same Google Cloud project as your working OAuth web client:

1. Enable **Google Drive API** and **Google Calendar API** in APIs & Services > Library.
2. Keep the web client origin `https://alltracker.vercel.app` and authorized redirect URI `https://alltracker.vercel.app/api/oauth/callback`.
3. In Google Auth Platform > Data Access, configure the scopes requested by the integrations: `https://www.googleapis.com/auth/drive.readonly` and `https://www.googleapis.com/auth/calendar.app.created`, alongside identity scopes. If the app is in Testing, add your Google account under Audience > Test users.
4. Drive import asks for separate consent because an older OAuth client may have created the files. Read-only Drive access is a restricted scope; public rollout may require Google verification. Testing accounts can use the configured testing flow. Existing sign-in alone does not grant Drive or Calendar access.

References: [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar reminders](https://developers.google.com/workspace/calendar/api/concepts/reminders).

## Bring back old data

1. Sign into LifeOS using the Google account that owns your old Drive folder.
2. Open **Me > Import old Google Drive data > Connect Drive import** and grant read-only consent.
3. Select **Find my old data**. The default folder name is `LifeOS-Data`; change it if the old app used another name.
4. Review the listed JSON files, select **Preview selected records**, then **Merge into my LifeOS account**. You can download originals and differences before merging.
5. Open Finance, Timeline, Journal or Insights and select dates containing your old records. History does not become today's data. Account sync uploads the imported records to Supabase.

The importer supports the old finance, timeflow, study, habits, health, journal, wisdom, goals, decisions, CRM, second-brain, reading, meditation, settings and AI-chat JSON modules. It never deletes or changes the Drive originals. Existing values win conflicting IDs; both versions are preserved in a local recovery copy. Identical records are skipped. Unknown fields in recognized modules are retained, though not every legacy feature has its old UI. Bill/photo attachment files are not downloaded. The combined selection is limited to 3 MB; import smaller selections if needed. Do not clear browser storage before downloading recovery copies.

## Diary -> Calendar -> What actually happened

1. Open **Calendar**, choose a date, then **Write this day's plan**.
2. Write one task per line, for example:

```text
09:00-10:30 Study thermodynamics
14:00-15:00 Project work
shaam 6 se 7 baje walk
```

3. Choose **Prepare editable draft** (works without AI), or **Draft with AI** for free-form diary text. The AI button sends only the displayed text. A saved journal entry can be appended from the entry selector.
4. Review times, duration, priorities, assumptions and conflicts. Approve the date and export it using **Approve & add to Google Calendar**, or approve first then **Export approved date**. Connect Calendar when prompted. Only a synced approved date is exported.
5. Events appear in the separate **LifeOS Plan** calendar with a default ten-minute reminder. Enable that calendar's sync/visibility and notifications in Google Calendar and your phone/browser settings. Delivery depends on those settings; exporting an event does not itself prove notification delivery.
6. After work, open its dated Calendar view or the check-in link inside the Google event. Choose **Done**, **Partial**, **Did not start**, or **Did something else**, then confirm or adjust the actual time. Passing the scheduled time never automatically marks work done.
7. Review the planned/actual day view, weekly/monthly calendar, commitment charts in Insights, and finance charts. Re-exporting the same approved blocks reuses their events. Approved replans update events and remove obsolete unchanged managed events; external Google edits require review.

## Verification in this delivery

See `docs/UPDATE_VALIDATION.md` for the final automated results. Provider calls in automated tests use fixtures. Real Drive consent/import, your deployed sync and actual phone notification delivery must be checked in your own account after deployment. Existing Google sign-in was reported working by you; this update keeps that sign-in flow.
