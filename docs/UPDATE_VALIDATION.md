# Drive, calendar and diary update — 4 October 2026

## Implemented

- Optional Google Drive read-only consent, old LifeOS folder discovery, recognized-module selection and preview, owner-bound merge, conflict preservation and local recovery copies. Existing Drive originals are never changed.
- Day/week/month calendar with date navigation and planned-versus-actual records. Check-ins preserve Done/Partial/not-started/replacement work separately from timing.
- Manual English/Hindi/Hinglish time ranges plus an optional authenticated Gemini diary-draft endpoint. AI suggestions remain editable and unapproved.
- Ten-minute Calendar popup reminders by default, date/block check-in links, stable event IDs and safe removal of obsolete unchanged managed events on approved re-export.
- Planning/outcome charts in Insights and net-spend/money-movement charts in Finance, using canonical domain metrics. Unknown dates remain gaps. Tables accompany charts.
- Responsive navigation, calendar transitions and reduced-motion support. Original areas and legacy records remain available.

## Verification

- `npm run check`: ESLint passed; **124 domain/backend tests passed**; production Vite/PWA build succeeded.
- Full `npm run test:browser`: **15 browser workflows passed**. Tests run against this checkout using dedicated local API/frontend ports.
- The two new calendar/import browser workflows were rerun after final import/name-display changes: **2 passed**. The finance import workflow was rerun after its mobile typography adjustment.
- `git diff --check`: no whitespace errors.
- Desktop calendar, narrow-screen calendar, populated Finance and Insights screenshots were inspected. Screenshots use fixture data, not the user's private Google records.

The new tests cover Drive folder membership and file allowlists, pagination/escaped names, payload caps, duplicate/conflict preservation, repeated import after migration, time-range ambiguity and explicit dates, validated AI drafts, ten-minute reminder/check-in payloads, and Calendar ETag protection during removal. Browser tests exercise preview/merge/re-import, queued account persistence, historical Finance, diary approval, day/month navigation, replacement work and reload.

## External verification still required

Provider calls in tests are mocked. This update has not used the user's Google consent, imported their actual Drive files, tested two live devices or confirmed phone notification delivery. After deploying, connect Drive import and Calendar in the same Google account, import a selected old module, export one approved block and verify it in Google Calendar. No new environment variable or SQL migration is introduced. Existing auth credentials and encryption key should be preserved.

Automatic Google Calendar busy-event import, automatic task-completion detection, Drive attachment download and continuous Drive backup are not included. Task completion requires a check-in; notification delivery depends on Google Calendar/device settings. Existing baseline limitations in DELIVERY.md remain applicable except where superseded above.
