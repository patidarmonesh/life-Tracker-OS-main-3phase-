# LifeOS 3.0 — Final Implementation Plan
### "Old app's soul, new app's spine, plus the missing pieces"

**Prepared:** 4 October 2026 · **For:** Nilesh · **Hand this file + both repo folders to Claude Code / Codex.**
**Inputs reviewed:** `life-Tracker-OS-main-3phase--main_old` (v1, ~1.8 MB source) and `life-Tracker-OS-main-3phase--main_new` (v2.0.0, incl. `docs/PLAN.md`, `DELIVERY.md`, `FINAL_SETUP.md`, screenshots, tests).
**Method:** static source review of both repos (neither app was run for this plan). Every "verify" item below must be checked live during implementation.

---

## 0. How to use this document

1. Work in a **fresh repo `lifeos-final`** created from the **new** repo (reasons in §1). Copy the old repo's `src/` into `reference/old-src/` (read-only, never imported by the build) so the agent can port UI from it.
2. Implement **phase by phase** (§17). Each phase ends with its acceptance checklist green, `npm run check` green, and Playwright workflows green.
3. When this plan and `docs/PLAN.md` (new repo) disagree on **UI/UX**, this plan wins. When they disagree on **data truthfulness rules** (unknown ≠ zero, plan ≠ evidence, no fabricated data), `docs/PLAN.md` wins — those rules are correct and stay.
4. Never port an old page as one giant file. Old `Finance.jsx` (136 KB) and `TimeFlow.jsx` (131 KB) are to be **decomposed** into feature folders (§16).

---

## 1. The verdict in one page

| Question | Decision |
|---|---|
| Which repo is the base? | **New repo.** It has the parts that are expensive and easy to get wrong: canonical metrics engine (`src/domain/metrics`), interval union + conflict resolution, timezone/DST, paise-integer ledger, durable timers with leases, diary parser, plan revisions/approval, Google Calendar export with stable event IDs + ETag safety, server-side OAuth with refresh tokens, Supabase sync/outbox, privacy, 124 unit tests + 15 browser workflows. Rebuilding that on the old code would take far longer than porting old UI onto it. |
| What comes from the old repo? | The **experience**: Finance (6 tabs, spending calendar, bills, savings, subscriptions/EMI/debt, account filter, yearly view), Time Flow (live clock, time-of-day theming, AI text/voice/photo logging, timeline, distribution, week view, optimizer), month calendars inside every area, unified multi-module calendar, the animation system (≈35 keyframes), the hero/home energy, Study tabs (flashcards, courses, soundscapes), Health charts, Journal mood calendar, Analytics heatmap + time-of-day productivity, Year in Review. |
| What comes from the new repo? | Everything under `src/domain/`, `server/`, `api/`, `tests/`; Today/Plan/Capture flow; diary → draft → approve → Google Calendar; check-ins; timers; sync; migration/backup; Drive import; shares; coach memory. |
| What is genuinely new (from neither)? | **Dual-lane Planned-vs-Actual timeline**, **Sync score + burn-up graph**, **Google Calendar mirroring of outcomes** (event colour/title updates + optional "LifeOS Actual" calendar), **block-end check-in push**, **experience-sampling pings** to fill the actual timeline, **evening "what I actually did" AI parse**, **24-hour ring for Time Flow**, **gap-filling**, **reusable heat-calendar component across all areas**, **learning loop** (estimate multiplier, best/worst hours) that feeds the scheduler, **safe-to-spend & month-end forecast**, proper **EMI amortisation**. |
| What dies? | From old: client-side Gemini key, fake smartwatch data, life-score with free 50-point defaults, `monthlyBudget/30` daily judgement, public Drive-file sharing, XP for logging/spending, inline-style soup, duplicate manifests. From new: audit-language UI as the *first* thing you see ("Unknown · incomplete · 0 observations · Coverage 0.9%"), the date `<input>` as primary navigation, list-only planned/actual view, Diary plan as a separate nav item from Calendar, flat colourless pages. |

**Design philosophy:** *Rigorous underneath, joyful on top.* The new repo computes honestly; the old repo makes you want to open the app. Truth stays in the engine and is always one tap away ("How is this calculated?"), but the surface is warm, animated and motivating.

---

## 2. Audit summary — what each repo actually does

### 2.1 Old repo (v1) — strengths
- **Finance** (`pages/Finance.jsx`): tabs Today / This Month / Yearly / Bills / Savings / Subscriptions & Debt; interactive month spending calendar with amount per cell (`1.2k` style) and colour by budget ratio; daily spent + left + progress bar; account filter chips; spend by account; category pie; daily bar chart; AI insights cards (Top insight, Savings tip, Category alert, Weekly pattern, Prediction); yearly monthly bars + best/worst month; bill upload queue with drag-drop, paste, HEIC/PDF, thumbnails and Gemini extraction; savings goals with deposit/withdraw; subscriptions, EMIs (with rate), loans lent/borrowed with settle.
- **Time Flow** (`pages/TimeFlow.jsx`): `LiveClock` with seconds ring and time-of-day theme (morning/afternoon/evening/night gradients + floating orbs); Productive/Waste/Unlogged summary; timeline entries; donut distribution; 7-day line; week view (avg/day, best/worst day); smart start/end times (continues from last entry); AI day analysis from free text; **AI Quick Add "Bol ya Likh"** with voice; **diary photo → entries**; **AI Time Optimizer** (maximise study); save analysis to journal; tags.
- **Calendars everywhere**: Finance, Habits, Journal (mood), Analytics (90-day heatmap), CalendarView (all modules per day with emoji + colour, click-through to module).
- **Motion**: `pageEnter`, `cardEntrance`, `cardSlideIn`, `numberPop`, `countUp`, `progressFill`, `scoreRingFill`, `drawerSlideUp`, `slideUpSheet`, `toastSlideIn/Out`, `colonPulse`, `floatOrb`, `heroGlow`, `shimmer`, `confettiFall`, `checkTick`, `typingDots`, `navPillSlide`, spring easing tokens.
- Study tabs (Today, Stats, Subjects, Flashcards, Courses, AI Planner) and soundscapes; FocusMode noise/binaural generator; Health (body metrics, water quick-add, steps, gym journal, nutrition, Hevy workouts); Journal mood trend; Analytics correlations, month-over-month, time-of-day productivity; Year in Review.

### 2.2 Old repo — problems (confirmed in source; most also listed in new `docs/PLAN.md` §2)
- Time maths: overlaps double-counted; overnight entries rejected; unlogged = `1440 − logged` even for future hours; 7-day series anchored on today, not the selected date; Sleep/Meals inconsistently counted as productive across pages.
- Finance maths: daily budget = `monthly/30` → a rent day turns the calendar red and the "score" collapses; SMS regex can read `Rs.1,250.00` as `1`; subscriptions treat every non-monthly cycle as yearly (`/12`) — weekly/quarterly wrong; EMI stores rate but never amortises.
- Life score gives 50 points for "no habits", full points for missing data; XP rewards number of logs and expenses.
- Health "smartwatch sync" writes random steps/sleep/HR/SpO₂ into real logs.
- Gemini key in the browser; Drive module files shared `anyone: reader`; implicit OAuth with hourly re-login.
- ~2,900 inline `style={{}}` objects; monolithic pages; multiple fonts with tiny sizes.

### 2.3 New repo (v2) — strengths
- `src/domain/metrics/*`: canonical activity adapter, allocation buckets (`Focus, Health, Essentials, Leisure, Drift, Sleep, Other, Conflict`), `resolveSegments` (interval union + conflict), elapsed vs future, coverage, circular sleep clock stats, effective-dated study goal, streak without 30-day cap, routines occurrences, ledger in minor units, metric envelope with version/coverage.
- `src/domain/planning`: Hinglish/Hindi/Devanagari-digit diary parser (`baje`, `se`, `subah/shaam/raat`, ranges, durations, must/should), deterministic scheduler with buffers/busy/unscheduled tray, revisioned approval (idempotent), original-commitment tracking, timer segments, check-in → activities with provenance.
- `server/`: OAuth code flow + PKCE + encrypted refresh token, sessions/CSRF, Supabase records/outbox, Calendar export into a dedicated **"LifeOS Plan"** calendar with stable IDs, 10-min popup reminders, check-in deep link in event description, ETag-safe removal; Drive read-only import of old data; AI gateway with quota; web-push scheduler (VAPID); static revocable shares; privacy export/delete.
- Tests, Playwright, migration/backup with checksum, one-writer Web Lock.

### 2.4 New repo — problems
- **UX is cold and audit-like.** Insights leads with "Unknown / incomplete / 0 observations / Coverage 0.9%" on every card. Truthful, but demotivating.
- **Planned vs Actual is two lists**, not a timeline; **no sync graph per day**; no burn-up; no derail explanation.
- Month calendar shows only "N planned"; Finance has **no spending calendar**, no yearly view, no subscriptions/EMI/debt UI (data is preserved by importer but invisible), no account filter, no bill gallery.
- Time Flow page is a thin records list (8.6 KB) — the best old page lost almost all its UI.
- Diary plan, Calendar and Today are separate destinations; the core loop feels like three tools.
- Calendar scope is `calendar.app.created` only → cannot read existing busy events (scheduler's `busy` input is always empty in practice).
- Diary **photo OCR removed**; AI only for text drafts.
- Tailwind 3 dev-dependency audit findings (fix = Tailwind 4).
- Large-year metrics computed synchronously on main thread (~1.5 s desktop) — will jank on phone.

---

## 3. Keep / Port / Rebuild / Drop matrix

Legend: **KEEP-NEW** = take new repo as is · **PORT-OLD** = bring old UI, rewire onto new domain selectors · **MERGE** = combine · **BUILD** = new work · **DROP**.

### 3.1 Modules

| Module | Decision | Notes |
|---|---|---|
| Today (Home) | MERGE | New's NOW/NEXT/check-in/plan-vs-actual order + old's hero (greeting, gradient name, time-of-day theme, stagger-in cards, count-up stats, quick actions). Add Sync ring + live burn-up mini chart. |
| Calendar + Diary plan | MERGE → **"Plan"** | One destination: Day / Week / Month / Year. Day view = dual-lane timeline + diary composer + draft editor. Old CalendarView's multi-module month (emoji dots) becomes the Month view's "All areas" layer. |
| Time Flow | PORT-OLD + KEEP-NEW maths | Old UI (clock, theme, AI quick add, voice, photo, optimizer, timeline, week view) on top of `resolveSegments`/buckets. Add 24h ring, gap filling, conflict resolver from new. |
| Finance → **Money** | PORT-OLD + KEEP-NEW ledger | All 6 old tabs come back. Ledger, paise, dedupe, review queue, CSV import from new. New maths (§9). |
| Capture (+) | KEEP-NEW, extend | Add photo OCR (bill + diary), voice, share-target, SMS paste. |
| Insights | MERGE | New's metric engine + share parity; old's heatmap, correlations, month-over-month, time-of-day; new Sync analytics. Truth labels in a disclosure, not the headline. |
| Study | PORT-OLD + KEEP-NEW | Old tabs (Today, Stats, Subjects, Flashcards, Courses, AI Planner) + new durable timer, effective goal, honest streak, unpositioned legacy sessions. |
| Focus Mode | PORT-OLD into timer | Old noise generator (white/pink/brown, rain, wind, binaural) inside `TaskTimer` full-screen mode. |
| Habits → **Routines** | PORT-OLD UI + KEEP-NEW maths | Old icons/colours/category + month heat calendar; new occurrence maths (daily / weekdays / N-per-week). |
| Health & Sleep | PORT-OLD charts, DROP fake sync | Old quick log, water, body metrics, gym journal, nutrition, Hevy paste; new sleep reconciliation + quarantine. |
| Journal | PORT-OLD | Mood calendar, mood trend, tags; evening review writes here only on explicit save. |
| Goals | KEEP-NEW | + WOOP fields (§12). |
| Wisdom + Second Brain + Decision Journal | MERGE → **Notes** | Types: note / quote / decision (with review date). |
| Reading, Meditation, Relationship CRM | KEEP (optional modules, off by default in nav) | Link sessions to canonical activities. |
| AI Chat → **Ask LifeOS** | MERGE | Old conversation UX (typing dots, message slide-in) + new grounded server gateway. Actions = proposals needing approval. |
| Year in Review | PORT-OLD + fixes | Selected year filter; no fallback sleep 7.2 h / mood 4.1. |
| RPG / XP / gear / bosses | DROP from default; archive | Data kept & exportable. Optional "Milestones" badges only for verifiable achievements (§12.6). |
| Setup Wizard | MERGE | 5 steps: name, timezone, wake/sleep window, monthly budget, top 3 areas. Integrations offered in context later. |
| Scoring Studio / Analysis Builder | DROP as pages | Custom report builder becomes "Compare two metrics" inside Insights. |
| Shared Dashboard | KEEP-NEW | Static revocable token snapshots rendered with the same components as the owner preview. |

### 3.2 Infrastructure

| Area | Decision |
|---|---|
| Storage | KEEP-NEW: local-first (IndexedDB/localStorage via `storage.js`) + Supabase outbox sync. **ADD** weekly encrypted JSON backup to the user's own Google Drive (`drive.file` scope, app-created folder `LifeOS-Backups`) — restores the old "my data lives in my Drive" comfort without public sharing. |
| Auth | KEEP-NEW server OAuth code flow + refresh tokens. |
| Google Calendar | KEEP-NEW export; **ADD** outcome mirroring, optional Actual calendar, optional free/busy read (§6.9). |
| AI | KEEP-NEW gateway; **ADD** endpoints for OCR, evening parse, finance insights, optimizer, bill extraction (§13). Remove every client-side provider call. |
| Push | KEEP-NEW `server/push.js`; **ADD** block-start (optional) and block-end check-in pushes, ESM pings, bill reminders, evening review nudge. |
| Styling | Tailwind **4** (CSS-first `@theme` tokens) + small component library. Inline styles allowed **only** for data-driven values (e.g., a category colour, a bar width). Fixes the audit finding too. |
| Motion | `motion` (Motion for React, `LazyMotion` + `domAnimation`) for layout/shared-element/sheet springs; CSS keyframes (ported from old `index.css`) for cheap loops; View Transitions API for route changes where supported. Full `prefers-reduced-motion` support. |
| Charts | Keep Recharts for standard charts. Custom SVG for: 24h ring, dual-lane timeline, burn-up overlay, heat calendars (CSS grid). |
| Heavy maths | Move year/range computation into a **Web Worker** (`src/workers/metrics.worker.js`) with memoised per-day summaries keyed by `sourceRevision`. |
| Dates | Keep new `dates.js` (Intl-based tz) + date-fns for formatting only. Never `new Date('YYYY-MM-DD')` for local days. |
| Tests | Keep all 124 + 15; add the fixtures in §18. |

---

## 4. Information architecture & navigation

### 4.1 Destinations
**Mobile bottom bar (5):** `Today` · `Plan` · **`＋`** · `Money` · `More`
- The 4th slot is **user-configurable** (default Money, alternatives: Time Flow, Study, Insights). You said Finance and Time Flow are the best → both must be ≤1 tap. Time Flow is reachable from Today's actual-timeline card and from `More`, or pin it.
- `＋` opens the Capture sheet (spring `drawerSlideUp`): Expense · Time log · Diary plan · Note · Photo (bill/diary) · Voice.

**Desktop sidebar:** Today · Plan · Time Flow · Money · Insights — divider — Areas (Study, Routines, Health & Sleep, Journal, Goals, Notes, + optional modules) — divider — Ask LifeOS · Me/Settings. Sidebar active pill animates with `navPillSlide` (layoutId).

### 4.2 Routes
```
/                      Today
/plan?date&view        Plan (day|week|month|year); day view hosts diary composer + draft editor + dual timeline
/plan/review?date      Evening review
/time?date&view        Time Flow (day|week|month)
/money?tab&month       Money (today|month|year|bills|savings|recurring)
/insights?range        Insights (overview|sync|time|study|sleep|money|routines|year)
/area/:module          Study, routines, health, journal, goals, notes, reading, meditation, people
/ask                   Ask LifeOS
/me                    Profile, integrations, preferences, privacy, export, import old Drive data
/checkin?date&block    Deep link target from Google Calendar & push (opens Plan day with check-in sheet)
/share/:token          Public static share
```
Redirect all old routes (`/finance`, `/timeflow`, `/calendar`, `/habits`, `/analytics`…) to the new ones (new repo already has a redirect table — extend it).

### 4.3 Global elements
- **Command palette** (keep old `CommandPalette.jsx`, ⌘K): navigation, "log 30 min study", "add ₹250 food", "plan tomorrow".
- **NL quick input** (old `NLInput.jsx`) wired to deterministic parsers first, AI fallback.
- **Ask LifeOS** contextual button on every page (passes page context + date range).
- **Reconnect banner** only on real revocation (new behaviour).

---

## 5. Design system — "Aurora" (old identity, new discipline)

### 5.1 Visual direction
Keep the **old app's identity** (deep navy, indigo accent, module colours, glass top bar, glowing rings) because it is distinctive and you like it; apply the **new app's discipline** (spacing scale, readable type, contrast, mobile-first, one token source). Light theme is first-class, not an afterthought.

### 5.2 Tokens (`src/styles/tokens.css`, consumed by Tailwind 4 `@theme`)
```css
:root[data-theme="dark"] {
  --bg-0:#070B17; --bg-1:#0A0F1E; --bg-2:#111827; --card:#151D2E; --card-hover:#1A2438;
  --line:rgba(255,255,255,.07); --line-strong:rgba(255,255,255,.14);
  --text-1:#F1F5F9; --text-2:#A7B4C8; --text-3:#7C8AA0;   /* text-3 raised from old #475569 for AA contrast */
  --accent:#6366F1; --accent-2:#8B5CF6; --success:#10B981; --warn:#F59E0B; --danger:#F43F5E; --info:#06B6D4;
  /* module identity (from old) */
  --m-money:#10B981; --m-time:#F59E0B; --m-study:#3B82F6; --m-routine:#6366F1; --m-health:#EC4899; --m-journal:#8B5CF6; --m-plan:#22D3EE;
  /* allocation buckets (new maths, old palette) */
  --b-focus:#3B82F6; --b-health:#10B981; --b-essentials:#F59E0B; --b-leisure:#EC4899; --b-drift:#EF4444;
  --b-sleep:#8B5CF6; --b-other:#64748B; --b-conflict:#F97316; /* conflict & drift also get a hatch pattern, never colour alone */
  --radius-s:8px; --radius-m:12px; --radius-l:18px; --radius-xl:24px;
  --shadow-card:0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.35);
  --glow-accent:0 0 24px rgba(99,102,241,.35);
  --ease-spring:cubic-bezier(.32,.72,0,1); --ease-out-expo:cubic-bezier(.19,1,.22,1);
  --dur-1:120ms; --dur-2:220ms; --dur-3:420ms; --dur-4:700ms;
}
:root[data-theme="light"] { --bg-0:#EEF2FF; --bg-1:#F5F7FF; --bg-2:#FFFFFF; --card:#FFFFFF; --card-hover:#F8FAFC;
  --line:rgba(15,23,42,.08); --text-1:#0F172A; --text-2:#475569; --text-3:#64748B; /* same accents */ }
```

### 5.3 Typography
| Role | Font | Use |
|---|---|---|
| Display | **Syne** 700/800 (self-hosted via `@fontsource`) | Page titles, hero greeting, the one big number per card |
| UI/body | **Inter Variable** (already bundled in new repo) | Everything else |
| Numeric | **JetBrains Mono** 500/700 with `font-variant-numeric: tabular-nums` | Money, durations, clocks, percentages |

Scale (rem @16px): 0.75 caption · 0.875 small · 1 body · 1.125 · 1.375 h3 · 1.75 h2 · 2.25 h1 · 3 hero number. **Inputs always 16px** (prevents iOS zoom). Nothing below 12px. Drop DM Sans (old) to keep three families max.

### 5.4 Motion catalogue (port old keyframes into `src/styles/motion.css` + `src/ui/motion.js`)
| Name | Where | Spec |
|---|---|---|
| `pageEnter` | Route change | fade + 8px rise, 220ms, ease-out-expo; View Transition cross-fade when supported |
| `stagger-in` | Card grids | children delay 40ms each, max 8 |
| `numberPop` / count-up | Big numbers | `useCountUp` 600ms, only on first mount or value change |
| `progressFill` / `scoreRingFill` | Bars, rings (Sync ring, budget bar) | 700ms spring |
| `drawerSlideUp` / `slideUpSheet` | Mobile sheets (Capture, check-in) | spring, drag-to-dismiss |
| `navPillSlide` | Sidebar/bottom bar/tab pill | shared `layoutId` |
| `colonPulse` + seconds ring | Time Flow LiveClock | 1s loop (pause when tab hidden) |
| `floatOrb` + time-of-day gradient | Today hero & Time Flow clock **only** | 8–10s loop, blur 50–60px, `pointer-events:none` |
| `shimmer` | Skeletons | 1.4s |
| `checkTick` | Routine done, check-in Done | 300ms stroke draw |
| `confettiFall` | **Rare, earned** moments only (§12.6) | 1.2s, max once per day |
| Shared-element | Month cell → Day view; Expense row → edit sheet; Timeline block → check-in sheet | Motion `layoutId` |
| `toastSlideIn/Out` | Toasts | keep |

Rules: animate `transform/opacity` only; no animation blocks reading; all loops stop under `prefers-reduced-motion: reduce` (replace with instant state changes); battery-saver: pause orbs when `document.hidden`.

### 5.5 Component library (`src/ui/`)
`Card`, `StatCard` (label, value, unit, delta, sparkline, status badge, "How calculated" popover), `Tabs` (animated pill), `Sheet` (mobile bottom / desktop dialog), `Modal`, `Button` (primary/secondary/ghost/danger, sizes, loading), `Chip`/`ChipGroup`, `Field` (Input/Select/Textarea, 16px, error text), `TimeRangeField` (start, end, **ends next day** toggle), `MoneyField` (₹ prefix, Indian grouping, paise internally), `SegmentedControl`, `Ring`, `ProgressBar`, `EmptyState` (old illustrations + action), `Skeleton`, `Toast`, `ConfirmDelete`, `DateNavigator` (‹ Today ›, swipe left/right on mobile, tap title opens mini month picker — replaces raw date input), **`HeatCalendar`** (§10), **`YearHeatmap`**, **`DualTimeline`** (§6.6), **`DayRing`** (§8.3), `ChartFrame` (title, legend, "view data" table toggle for a11y), `TruthBadge` (§5.6).

### 5.6 How to show truth without killing motivation (key UX fix for the new repo)
- Headline shows the **best honest number** in big type (e.g., `3h 40m focus`).
- A small **TruthBadge** next to it: ✓ *complete*, ◐ *partial (62% of day logged)*, ? *not enough data*. Tap → popover with numerator/denominator, coverage, metric version, excluded records.
- Unknown values render as a soft dashed placeholder with an **action**: "Log last night's sleep", "Check in 2 blocks", not the word *Unknown* in 36px.
- Ranges when evidence is pending: `57% → up to 77%` (§7).
- Warnings live in a collapsible "Data quality" strip at the bottom of the page, not on every card.

### 5.7 Mobile rules
Thumb zone for primary actions; 44×44 min targets; bottom sheets instead of centred modals; safe-area insets; swipe between days in Plan/Time/Money; pull-to-refresh triggers sync; charts horizontally scrollable with sticky axis; tested at 320, 360, 390, 414, 768, 1024, 1280, 1440 widths, 200% text.

---

## 6. FLAGSHIP: Diary → Plan → Google Calendar → Check-in → Actual → Sync

This is the loop you described ("aaj 4 October… diary me likhu… tentative timeline… Google Calendar pe… notification… actual timeline… graph ki dono kitne sync me the"). It is the spine of the product, so it gets the most detail.

### 6.1 The loop
```
 Night before / morning                During the day                         Night
 ───────────────────────               ─────────────────────                 ────────────────
 1 Write diary (text/voice/photo)  →  5 Reminder 10 min before (Google)  →  9 Evening review
 2 Parse → "understood as" review     6 Start timer / it just happens         - resolve unknowns
 3 Visual draft timeline (drag)       7 Block-end push: "Kya hua?"            - see Sync graph
 4 Approve → Google "LifeOS Plan"     8 Actual timeline fills from:           - win + lesson
     (+ reminders, + check-in link)      timers · check-ins · quick logs ·      - carry-over
                                         ESM pings · evening AI parse         10 Tomorrow's draft seeded
```

### 6.2 Step 1 — Write the diary (`/plan?date=2026-10-04&view=day` → "Write today's plan")
- **Composer** (full-height sheet on mobile): big textarea with lined-paper styling, date chip (defaults: before 17:00 → today, after → tomorrow; always editable), language-agnostic.
- Input modes: **type**, **voice** (Web Speech API `hi-IN` / `en-IN`, toggle; fallback message on unsupported browsers), **photo of handwritten diary page** (camera/file; server OCR §13), **paste**, **"use yesterday's carry-over"** button, **template** (your saved typical day, e.g., office day / weekend / exam day).
- Example accepted input:
  ```
  6:30 uthna, 7-8 gym
  9 se 11 GATE thermo must
  11:30-1 office standup + emails
  lunch 1-1:45
  2 se 4 project work
  shaam 6 se 7 walk with Tina
  raat 10:30 sona
  ```
- Autosave the raw text as a `diary` record (never lost even if parsing fails).

### 6.3 Step 2 — Parse & "understood as"
- **Deterministic first**: new `parseDiary()` (keep; add the **waking-window rule** for bare hours — resolve to the single AM/PM reading inside the user's wake–sleep window, ask only when both fit — and extend with: `"baje tak"`, `"dopahar"`→pm context, `"half past"`/`"saade"` = :30, `"sava"` = :15, `"paune"` = −:15, `"tak"` as range end, comma-separated multiple tasks per line, emoji bullets).
- **AI fallback** only when deterministic parse leaves >30% of lines without time/duration or the user taps "Draft with AI" (server `planning/diary`, existing; keep schema & validation).
- Output shown as a **review list**: each task row = title · start–end · duration · category chip (auto colour) · priority chip (Must/Should/Could) · fixed/flexible toggle · reminder (0/5/10/15/30) · warning chip (e.g., "7 baje — AM or PM?" with two buttons that resolve inline).
- Nothing is exported until every warning is resolved (new `approveRevision` already enforces this — keep).

### 6.4 Step 3 — Visual draft editor (BUILD; replaces new repo's form-only Plan page)
- **Vertical day canvas** 00:00–24:00, auto-scrolled to the waking window; 1 px = 1 min at default zoom, pinch/ctrl-wheel zoom (15-min / 5-min snap).
- Blocks are draggable (move) and resizable (top/bottom handles), snap 5 min; long-press on mobile to drag; keyboard: arrows move 5 min, shift+arrows resize.
- **Unscheduled tray** (bottom drawer) for tasks without time → drag onto canvas, or "Auto-place" (new `scheduleDraft`, honouring buffers, work window, busy events, priority).
- **Constraints shown live**: overlap → red hatch + message; outside waking window → amber; sleep window shaded; existing Google busy events (if free/busy enabled, §6.9) shown as grey locked blocks.
- **Capacity bar** at top: `Planned focus 6h 30m / your typical achieved 4h 10m (P75 of last 28 days) → Overcommitted ×1.56` (§7.6). Suggest moving Could-tasks to tomorrow; never silently shorten sleep.
- **Estimate realism hint** per block: "Study blocks usually take 1.3× your estimate (n=14)" with "Apply" (§7.5).
- Buttons: `Save draft` · `Approve day` · **`Approve & add to Google Calendar`** (primary).

### 6.5 Step 4 — Approve & export to Google Calendar
Keep new `server/calendar.js` export (dedicated **LifeOS Plan** calendar, stable `calendarEventId(owner, planId, blockId)`, `extendedProperties.private`, ETag-safe updates/removals). Add:
- **Per-block reminders**: `reminders.overrides` from the block's `reminderMinutes` (default 10; allow up to 2 values, e.g., 10 and 0). Popup method.
- **Event colour by category** (`colorId` mapping table, e.g., Study=9 blueberry, Exercise=10 basil, Meals=5 banana, Deep Work=7 peacock, Drift n/a).
- **Event description** (keep check-in link) + add `Done means: …` (completion criterion) + one-line implementation intention: "If it's 9:00, then I open the thermo notes." (§12.1).
- **Export status chip** per day: `Synced to Google · 7 events · 2 min ago` / `Pending (offline)` / `Needs reconnect`.

### 6.6 Steps 5–8 — During the day: building the ACTUAL timeline
Sources, in order of evidential strength (provenance stored on each activity, already modelled in new repo):

| Source | Provenance | How it gets in |
|---|---|---|
| Timer (TaskTimer / Focus mode) | `timer-observed` | Start from Today NOW card, from the block, or from the push notification action. Segments persisted, lease-protected (new). |
| Check-in at block end | `confirmed-check-in` / `user-estimated` | Push at block end (+ in-app sheet). Done / Partial / Didn't start / Did something else → timing: Same / Adjust / Unknown (new `CheckInDialog`; restyle as sheet). "Did something else" asks *what* (chips: phone/YouTube/insta, family, work emergency, rest, other + free text) → creates replacement activity. |
| Quick log (Time Flow) | `manual` | Old Time Flow add/AI quick-add/voice (§8). |
| **ESM ping** (BUILD, optional) | `esm-ping` | During waking hours, every 60/90 min (configurable, quiet hours respected, **only when no timer is running and no block check-in is due**): push "Abhi kya kar rahe ho?" with 4 one-tap actions (top predicted categories) + "Other". Records the 30 min *preceding* the ping as `user-estimated` unless user edits. (Experience-sampling method — the standard research technique for capturing what people actually do without full logging.) |
| Evening AI parse | `ai-proposed` → `user-estimated` after confirm | Evening review: "Aaj kya kya kiya? Bol ya likh" → server parse → review table → confirm. Fills gaps only; never overwrites stronger evidence. |
| Diary photo of actual day | `ai-proposed` | Same as above via OCR. |

**Resolution:** all sources → `adaptActivities` → `resolveSegments` (new). Stronger provenance wins **only for exact duplicates of the same activity**; contradictory activities become **Conflict** until the user resolves (new rule — keep).

**Google Calendar mirroring (BUILD):**
- After a check-in: patch the plan event → title prefix `✅` Done / `◐` Partial / `✗` Not started / `↪` Replaced, and `colorId` → green / yellow / grey / red (configurable "mirror outcomes" toggle, default on). Your Google Calendar becomes an honest history at a glance.
- Optional second app-created calendar **"LifeOS Actual"**: write confirmed actual activities (timer/check-in/confirmed logs) as events. In Google Calendar's day view you then see Plan and Actual side by side. Batch-written at most every 15 min + on evening review; same stable-ID + ETag approach as export. Both calendars fit inside the existing `calendar.app.created` scope.

### 6.7 The comparison view (Plan day view, "Compare" mode) — BUILD `DualTimeline`
```
 Time   │ PLANNED                     │ ACTUAL                        │ Sync
 09:00  │ ███ GATE thermo (Must)      │ ░ (late start +20m)           │
 09:20  │ ███                         │ ███ GATE thermo ⏱ timer       │ ◕ 78%
 10:30  │                             │ ▓▓▓ YouTube (drift) ⚠         │
 11:00  │ ███ Office standup          │ ▓▓▓ YouTube (drift)           │ ◔ 50%
 11:30  │ ███                         │ ███ Office standup ✓          │
 12:15  │                             │ ███ (ran over 15m)            │
```
- Two lanes sharing one time axis; blocks in category colours; **drift** = red hatch; **conflict** = orange hatch; **unknown** (planned window with no evidence) = dashed outline grey; **future** = dimmed.
- **Connector ribbons** between a planned block and its matched actual segment(s) (SVG paths), so shifts are visible.
- Per-block badge: `On time` / `Late +20m` / `Shifted` / `Ran over +15m` / `Skipped` / `Replaced by YouTube 30m` / `Unknown – check in`.
- Tap a block → check-in sheet (shared-element animation).
- Mobile: lanes stack as two narrow columns (each ≥140 px) with horizontal scroll fallback at 320 px; or toggle "Overlay" mode where actual is drawn as an inner bar inside each planned block.
- Below the timeline: **Sync panel** (§6.8).

### 6.8 The Sync graphs (what "dono kitne sync me the" becomes)
1. **Sync ring** (big): timing sync % with range when evidence pending (`57% → up to 77%`), plus three small stats: Outcome done `1/3`, Effort `62%`, Median start delay `+25m`.
2. **Burn-up chart (signature chart):** x = time of day, y = cumulative minutes.
   - Line A (dashed, plan colour): cumulative **planned** minutes (the "ideal you").
   - Line B (solid, success colour): cumulative **on-plan actual** minutes.
   - Line C (thin, focus colour): cumulative **any focus** minutes (to show work done but off-schedule).
   - Shaded area between A and B = the gap; red tint where actual was Drift; vertical "now" line; markers at block starts.
   - Live during the day (updates every minute, cheap: recompute only today).
3. **Per-block bars**: planned length vs on-time / shifted / drift / unknown stacked.
4. **Derail list**: "Lost 30m to YouTube during Office standup", "Gym: no check-in".
5. **Week view**: 7 mini burn-ups (sparklines) + Sync % trend line (ratio of sums, §7.4).
6. **Month**: `HeatCalendar` coloured by daily Sync % (unknown days hatched, no-plan days blank).
7. **Hour-of-day × weekday heatmap** (last 8 weeks): sync rate per cell — "Your best hours: 06–09 (82%), worst: 14–16 (31%)". Feeds scheduler suggestions (§7.7).

### 6.9 Optional: read existing calendar busy time
New repo cannot see your other Google events (scope `calendar.app.created` only). Add an **opt-in** incremental scope `https://www.googleapis.com/auth/calendar.freebusy` (busy intervals only, no titles) requested from Plan when the user taps "Avoid my existing meetings". Call FreeBusy for selected calendars for the planning date; pass to `scheduleDraft({ busy })`. Verify scope classification in Google Cloud console at implementation time; keep it optional so testing-mode consent stays simple.

### 6.10 Step 9 — Evening review (`/plan/review?date`)
Triggered by push at user's review time (default 21:30) and on Today after the last block.
1. Resolve: list unknown blocks → one-tap check-ins (batch).
2. Fill gaps: "You have 3h 10m unlogged between 13:00 and 18:00" → quick fill / evening AI parse.
3. See: Sync ring + burn-up + derail list.
4. Reflect: one win, one lesson (chips + free text), energy 1–5, mood 1–5 (→ Journal **only if** "Save to journal" toggled).
5. Money: "₹ spent today — confirm 2 pending transactions / confirm no-spend day".
6. Carry-over: unfinished Must/Should tasks → tomorrow's draft tray (with original estimate and delay count).
7. Tomorrow: "Draft tomorrow now?" → opens composer pre-filled with carry-over + template.
Confetti only if: day had ≥1 Must, all Musts done, Sync ≥ 80%, and review completed.

### 6.11 Data model additions (extend new `planning` state)
```js
PlanBlock { ...existing, reminderMinutes:[10], colorId, implementationIntention?, energy?:'high'|'low', originalEstimateMinutes }
Checkin   { ...existing, replacementCategory?, derailReason?: 'distracted'|'tired'|'unexpected-work'|'family'|'estimate'|'priority'|'health'|'other' }
Activity  { ...existing, source: + 'esm-ping' | 'ai-evening-parse' | 'ocr-diary', matchedBlockId?, matchMethod:'link'|'reviewed'|'suggested' }
CalendarMirror { planEventId, outcomeMirroredAt, actualEventId?, etag }
DayReview { localDate, win, lesson, energy, mood, carriedTaskIds[], completedAt }
EsmPing   { id, sentAt, answeredAt?, category?, note? }
```
Server tables (new migration `003_mirror_esm.sql`): `lifeos_calendar_actuals (owner, local_date, activity_id, event_id, etag, revision)`; extend `lifeos_reminders` with `kind in ('block_start','block_end','esm','review','bill')`.

### 6.12 Edge cases (must have tests)
Overnight block (23:00–01:00, `endsNextDay`); plan approved after some blocks already passed; replan mid-day (freeze past, original commitments retained — new `commitmentSummary` keeps the original denominator); offline approval (export pending); Google disconnected (local continues, banner); two devices (timer lease); user edits/deletes event inside Google (ETag mismatch → review prompt, never overwrite); notification permission denied (in-app pending check-ins + Google reminders still work); DST timezone travel (timezone stored per plan).

---

## 7. Sync & planning mathematics (exact spec — implement in `src/domain/planning/sync.js`)

Notation for a local date `d`, cutoff `C = min(now, end of day)` (past days `C = E(d)`):
- Planned block `j`: interval `P_j=[s_j,e_j)`, elapsed planned minutes `p_j = |P_j ∩ [B,C)|`, priority weight `w_j` (Must 2, Should 1, Could 0.5).
- Matched actual for `j`: `A_j` = resolved segments linked to `j` (explicit `blockId`, or user-reviewed match; auto-suggested matches only count after confirmation). **One actual minute matches at most one block.**
- Unknown minutes `U_j` = part of `P_j ∩ [B,C)` with no resolved evidence of any kind.

| Metric | Formula | Notes |
|---|---|---|
| On-time minutes | `O_j = |P_j ∩ A_j|` | |
| Shifted minutes | `S_j = min(|A_j|, p_j) − O_j` | work done for this block but outside its window, same day |
| **Timing sync** | `Σ w_j O_j / Σ w_j p_j` | headline; zero denominator → n/a |
| Upper bound | `Σ w_j (O_j + U_j) / Σ w_j p_j` | show `lower → upper` until unknowns resolved |
| Effort fulfilment | `Σ w_j (O_j+S_j) / Σ w_j p_j` | "did the work, maybe not on time" |
| Outcome completion | `done tasks / committed tasks` (original revision) | finishing early = success; independent of minutes |
| Must completion | `done Musts / Musts` | |
| Start delay | `first matched start − s_j` (signed) | report median and share within ±10 min ("punctuality") |
| Overrun | `max(0, last matched end − e_j)` | |
| Drift in plan | `Σ_j |P_j ∩ Drift segments|` | user-confirmed drift only |
| Block fit (detail only) | `|P_j ∩ A_j| / |P_j ∪ A_j|` | Jaccard/IoU, penalises both lateness and overrun |
| Check-in response | answered due check-ins / due check-ins | separate from completion; missed ping ≠ failure |

### 7.1 Worked example (use as unit-test fixture `sync-basic`)
Plan: Study 09:00–10:30 (Must, 90), Office 11:00–12:00 (Should, 60), Gym 14:00–15:00 (Should, 60). Now = 16:00.
Actual: Study timer 09:20–10:30; YouTube (confirmed drift) 10:30–11:30; Office check-in "adjust" 11:30–12:15; Gym no check-in.
- `O`: Study 70, Office 30 (11:30–12:00), Gym 0. `U`: Gym 60. `S`: Office `min(45,60) − 30 = 15`.
- `Σw·p = 2·90 + 60 + 60 = 300`. `Σw·O = 140 + 30 = 170`.
- **Timing sync = 56.7% → up to 76.7%** (if Gym is confirmed on time).
- Effort = `(140 + 45)/300 = 61.7%`. Outcome: Study done, Office partial, Gym unknown → `1/3 done, 1 unknown`.
- Start delays: +20, +30 → median +25 m. Drift in plan: 30 m (YouTube during Office).
- Display: big ring `57%`, caption "up to 77% once Gym is checked in".

### 7.2 Live burn-up series
For each minute `t` in `[B, C]` (sampled every 5 min for the chart): `planned(t) = Σ_j |P_j ∩ [B,t)|`, `onPlan(t) = Σ_j |P_j ∩ A_j ∩ [B,t)|`, `focus(t) = |Focus segments ∩ [B,t)|`. Future part of `planned(t)` drawn dimmed up to `E(d)`.

### 7.3 Replans
Metrics are computed against the **original approved revision** by default ("what I committed to in the morning"); a toggle shows "current revision". Blocks cancelled **before start** with explicit user approval are excluded from the current-revision denominator only. (Matches new repo `commitmentSummary` intent — keep.)

### 7.4 Aggregation over ranges
Week/month sync = `Σ_days Σ_j w_j O_j / Σ_days Σ_j w_j p_j` (ratio of sums, never average of daily percentages). Show `n` days with a plan. Days with >30% unknown planned minutes are shown hatched and listed as "incomplete".

### 7.5 Learning loop — estimate multiplier (planning fallacy correction)
For completed tasks with timer/confirmed effort: `ratio_i = actualEffort_i / originalEstimate_i`. Per category (and per subject for Study): `med = median(ratio)`, `n = count`. Shrunk multiplier `m̂ = (n·med + k·1)/(n + k)` with `k = 5`. Show only if `n ≥ 8`; display "Study tasks usually take 1.3× your estimate (n=14)". Suggest, never auto-apply.

### 7.6 Overcommitment check
`capacity = P75 of achieved Focus minutes over the last 28 complete days with coverage ≥ 60%` (fallback: user-configured capacity; label "default, not learned" when n < 10). `overcommit = planned Focus minutes / capacity`. >1.25 → amber warning with "move Could-tasks" helper; >1.6 → red.

### 7.7 Best-hours model
For the last 56 days, per weekday×hour cell: `rate = Σ O / Σ p` over planned minutes in that cell; show only cells with `Σ p ≥ 60`. Scheduler "Auto-place" prefers high-rate hours for Must tasks when the user enables "Use my best hours".

### 7.8 Invariants (property tests)
No NaN/∞; `0 ≤ O_j ≤ p_j`; `O_j + S_j ≤ p_j`; lower ≤ upper; one actual minute → ≤ 1 block; editing a future block never changes past days; sum of rounded displays never used for totals.

---

## 8. Time Flow — old UI, new maths, new visuals (`/time`)

### 8.1 Layout (Day tab)
1. **LiveClock hero** (port old `LiveClock` + `getTimeTheme`): seconds ring, colon pulse, time-of-day gradient & orbs, greeting. Summary chips under the clock change from old `Productive / Waste / Unlogged` to **`Focus · Drift · Unlogged · Sleep`** (from `buildDailySummary`). Clock uses one `requestAnimationFrame` loop that pauses when hidden.
2. **DayRing (BUILD, signature visual)** — 24-hour donut: each resolved segment is an arc in its bucket colour, unlogged gaps are dashed arcs, future part dimmed, a "now" needle. Centre shows `logged / elapsed` coverage. Tap an arc → edit; tap a gap → quick add prefilled with that interval. Ring + timeline are two views of the same `resolveSegments` output.
3. **Stat row**: Focus, Health, Essentials, Leisure, Drift, Sleep (each `StatCard` with count-up and TruthBadge). Optional combined "Investment time" card that lists its included buckets (configurable, default Focus+Health).
4. **Timeline** (port old `TimelineEntry` look: vertical line, coloured dots, cardSlideIn stagger) built from resolved segments. **Gap rows** inserted between entries for gaps ≥15 min inside the waking window: "1h 20m unlogged · Fill". **Conflict rows** inline with "Resolve" (new resolver UI: keep A / keep B / split / trim).
5. **Distribution** donut (old) by bucket, with a toggle to see raw categories.
6. **Duration-only legacy logs** list ("timing unknown") — never drawn on the ring.

### 8.2 Logging modes (all old, rewired)
| Mode | From old | Change |
|---|---|---|
| Manual add/edit | `saveEntry` modal | Use `TimeRangeField` with **ends next day**; `normalizeManualInterval` (new); smart start = end of last entry (old `getSmartStartTime`); smart end = start + typical duration for that category. |
| AI Quick Add "Bol ya Likh" | `handleQuickAISend` + voice | Server `ai/parse-activities`; returns entries for review table; deterministic parser first for simple "9 se 11 padhai". |
| Day analysis from free text | `analyseWithAI` / `runAutoTimelineAnalysis` | Same endpoint, range = whole day; fills **gaps only**; shows diff before saving. |
| Diary photo → entries | `processDiaryPhoto` | Server OCR (§13) → text → parse → review. |
| Optimizer | `runTimeOptimizer` | Becomes **"Suggest tomorrow's plan"** → creates a *draft* in Plan (never touches actual data). |
| Save analysis to journal | `saveAnalysisToJournal` | Explicit button only. |

### 8.3 Week & Month tabs
- **Week** (selected-date anchored `[d−6, d]` or calendar week toggle — label which): stacked bars per day by bucket (replaces old 2-line chart), coverage dots under each bar; avg/day = `Σ minutes / days with coverage ≥ 60%` with "n of 7 days" label; best/worst day by Focus among complete days; drift trend.
- **Month**: `HeatCalendar` metric selector — Focus hours (default), Drift, Coverage, Sleep, Sync.
- **Patterns** card: time-of-day stacked area (old Analytics "Time-of-Day Productivity" moved here) using resolved minutes per hour over the range.

### 8.4 Classification settings
Category → default bucket + default intentionality (old `WASTE_CATEGORIES` become *suggested* drift, user confirms). Rename label "Drift" ↔ "Waste" per preference; definition unchanged. Category edits are **effective-dated** (no silent rewrite of history; optional explicit recalculation with version label).

### 8.5 Acceptance
Study 10:00–11:00 + Instagram 10:30–11:30 shows 90 min logged, 30 Focus, 30 Conflict, 30 Leisure/Drift (new PLAN §6.3 example); at 10:00 with 2 h logged: elapsed 600, unlogged 480, future 840 (not failure); overnight 23:30–07:00 splits across dates on the ring and timeline, belongs to wake date in Sleep.

---

## 9. Money — all old tabs back, honest maths (`/money`)

### 9.1 Tabs (old structure retained)
`Today` · `Month` · `Year` · `Bills` · `Savings` · `Recurring & Debt` — plus the **account filter chip row** (old) on every tab and a currency selector (multi-currency kept separate, new rule).

### 9.2 Today tab
1. **Spending HeatCalendar (month)** — old look: day number + compact amount (`1.2k`, Indian `1.2L` above 1 lakh), tap → selects day. New colouring rule (§9.6). Income dot (green), fixed-obligation pin 📌, bill thumbnail dot 🧾, "no-spend confirmed" ✓.
2. **Big number card**: spent on selected day; **Safe-to-spend today** (§9.6) with progress bar; "₹X left of ₹Y today".
3. **Transactions list** (old `ExpenseRow`: emoji category, merchant, account, time, tags, bill thumbnail, edit/delete with swipe on mobile).
4. Empty state: "No spending recorded" + **"Confirm no-spend day"** (new) — celebratory 🎉 only after confirmation.

### 9.3 Month tab
Month navigator (old) · cards: Spent, Budget, Remaining, **Projected month-end** (§9.6, with band) · budget usage bar (old colours green/amber/red with 0.6 s fill) · **variable-spend pace chart** (cumulative actual vs ideal straight line — same burn-up idea as Plan) · spend by account (old) · category donut (old) with **change vs 3-month average** per category · daily bar chart (old) with fixed obligations in a separate colour · **weekday pattern** (deterministic: mean spend per weekday) · AI insights cards (old 5 cards, now server-generated from computed numbers only) · all transactions with search/filter/sort.

### 9.4 Year tab
Old monthly bars + Year total / Monthly average / Best / Worst month; add **YearHeatmap** (365 cells, GitHub style), category stacked area across months, savings rate per month (if income logged), expandable month rows (old `expandedYearlyMonth`).

### 9.5 Bills, Savings, Recurring & Debt
- **Bills**: old upload queue (drag-drop, paste, HEIC/PDF, thumbnails) → **server** extraction (`ai/extract-bill`) → review → creates transaction linked to bill. Bill files stored in user's Drive `LifeOS-Bills` folder via `drive.file` scope (old behaviour, minus public sharing) or IndexedDB if Drive not connected.
- **Savings goals**: old deposit/withdraw UI + required monthly contribution, projected completion date, on-track badge.
- **Recurring & Debt** (old `RecurringDebtTab`, data already preserved by new importer): subscriptions (cycle: weekly/monthly/quarterly/half-yearly/yearly), EMIs (principal, rate, tenure), loans lent/borrowed (settle). Bill-reminder push N days before renewal/EMI date (default 2).

### 9.6 Finance mathematics (`src/domain/metrics/finance.js` — extend)
All amounts integer **paise**; display rounding only.

| Metric | Formula |
|---|---|
| Spending | confirmed expenses − linked refunds; own-account transfers excluded (new) |
| Fixed obligations (month) | Σ subscriptions monthly-equivalent + EMIs + rent/bills flagged fixed |
| Variable budget | `B_var = monthly budget − fixed obligations planned this month` |
| **Safe-to-spend today** | `max(0, B_var − S_var(before today) − R_upcoming_var) / D_remaining_incl_today` |
| Day colour ratio | past day: `r = variable spend(day) / (B_var / days in month)`; today: `r = variable spend / safe-to-spend` |
| Cell colour | no records & not confirmed → **no fill** (unknown); confirmed no-spend → green ✓; `r ≤ 0.5` light green, `≤ 1` green, `≤ 1.5` amber, `> 1.5` red. Fixed obligations never colour a day (📌 icon instead). |
| Budget utilisation | eligible spending / period budget; no budget → n/a |
| Variable pace | cumulative variable spend vs `B_var × elapsed completed days / days in month` |
| **Projected month-end** | `MTD_var + median(daily var spend of completed logged days) × remaining days + unpaid fixed`; band from P25/P75 daily values; if < 5 logged days this month, use last 60 days; if still < 5 → "Not enough history" |
| Savings rate | `(income − spending) / income` (only when income logged that month) |
| Category change | `(this month − mean of previous 3 months) / mean`; flag when |Δ| ≥ 30% and amount ≥ ₹500 |
| Weekday pattern | mean spend per weekday over weeks with ≥ 5 logged days |
| Subscription monthly-eq | weekly × 52/12 · monthly × 1 · quarterly / 3 · half-yearly / 6 · yearly / 12 (fixes old `/12` for everything) |
| EMI | `r = annualRate/12/100`; `EMI = P·r(1+r)^n / ((1+r)^n − 1)` (r=0 → `P/n`); outstanding after k payments `= P(1+r)^k − EMI·((1+r)^k − 1)/r`; next interest `= outstanding × r`. If only EMI & remaining months known (old data): outstanding `= EMI·(1 − (1+r)^−m)/r`. |
| Savings goal | required/month `= (target − saved) / months left`; projected date from mean contribution of last 3 months |
| Net debt | Σ borrowed outstanding − Σ lent outstanding |

### 9.7 Capture paths (new, keep)
Paste SMS/UPI (`parseMoneyMessage`: ₹1,25,000.50 → 12,500,050 paise; debit/credit/refund/failed; ignores balance & OTP), CSV statement import, manual, bill photo. Strong dedupe on bank/UPI reference; fuzzy matches → review queue. Merchant rules: after the user recategorises the same merchant twice, offer "Always categorise Swiggy as Food" (explicit rule, editable).

### 9.8 Acceptance
Rent ₹12,000 on Oct 1 does **not** turn Oct 1 red; weekly ₹99 subscription = ₹429/month-eq; EMI ₹5,00,000 @ 10% for 36 months = ₹16,134/month (±₹1); old SMS `Rs.1,250.00` parses as ₹1,250.00; a month with 3 logged days shows "Not enough history" for projection.

---

## 10. Calendars everywhere — one component, every area

### 10.1 `HeatCalendar` (BUILD, `src/ui/calendar/HeatCalendar.jsx`)
Props: `month`, `getDayValue(date) → { value, status: 'observed'|'confirmed-zero'|'unknown'|'n/a', label, badges[] }`, `scale` (thresholds + colours), `onSelect`, `selected`, `weekStart` (Mon default, configurable), `renderCell?`.
Behaviour: 7-col CSS grid; cell shows day number + compact label (₹ amount / `3.5h` / `82%` / mood emoji); colour intensity from scale; unknown = transparent with faint dashed border (never "good" colour); today ring; selected = accent fill with shared-element transition to the day detail; swipe/arrow to change month; "Jump to today" (old); keyboard grid navigation (arrow keys, Enter) + `aria-label` per cell ("4 October, ₹520 spent, within budget").
`YearHeatmap`: 53×7 grid, same `getDayValue`.

### 10.2 Where it appears
| Area | Cell value | Colour scale |
|---|---|---|
| Plan | daily timing Sync % (+ dot if plan exists) | red→amber→green; unknown hatched |
| Time Flow | Focus hours (switchable: Drift, Coverage, Sleep) | blue intensity |
| Money | variable spend (§9.6) | green→amber→red |
| Study | study minutes vs effective goal | blue intensity; ✓ when goal met |
| Routines | due-occurrence completion % | indigo intensity; n/a when nothing due |
| Health/Sleep | sleep duration vs target | violet intensity |
| Journal | mood emoji (old) | mood colour |
| Insights | any metric (picker) | metric's scale |

### 10.3 Unified calendar (Plan → Month → "All areas" layer)
Port old `CalendarView` concept: each day cell shows module dots/emoji (💸 ⏱️ 📚 ✅ 📝 💪 + 🗓 plan), tap → **day sheet** listing everything that happened that day across modules with deep links (old `handleEventClick`) and the dual timeline preview.

---

## 11. Other areas (port old UI onto new domain)

| Area | Keep from old | Keep from new | Add |
|---|---|---|---|
| **Study** | Tabs Today/Stats/Subjects/Flashcards/Courses/AI Planner; 7-day bars; recent sessions; soundscapes | Durable timer + lease; one canonical activity (no double count with Time Flow via `studySessionId`); effective-dated goal; streak with today-pending rule; unpositioned legacy minutes | Spaced-repetition scheduling for flashcards (SM-2: EF, interval, repetitions; due queue on Today); subject heat calendar; "AI Planner" outputs a *draft* into Plan |
| **Focus Mode** | Noise generator (white/pink/brown/wind/rain, binaural/isochronic) | Timer segments | Full-screen focus inside `TaskTimer`; optional break reminder (Pomodoro 25/5 or 50/10, user-set); "Did you stay on task?" at stop (self-report, not measured attention) |
| **Routines** | Icons, colours, categories, heatmap | Occurrence maths (daily / weekdays / N-per-week; pending ≠ failed; strict streak + optional recovery indicator) | Time window + reminder; habit stacking field ("after brushing → 5 min stretch") |
| **Health & Sleep** | Quick log, water +250/500/750, body metrics + trends, steps (manual), gym journal, volume, nutrition (calories/protein), Hevy paste | Sleep episode model (wake-date ownership, naps, circular mean bedtime, consistency needs ≥5 nights), quarantine of simulated fields, attainment vs efficiency naming | Health Connect / native adapters remain future work — show "Not connected", never fake |
| **Journal** | Mood calendar, mood trend, tags, top tags, free writing | Explicit save from review | Prompts library (gratitude, win/lesson, weekly review) |
| **Goals** | — | Milestones, progress units | WOOP fields (Wish, Outcome, Obstacle, Plan) + "next action" that can be dropped into a Plan draft |
| **Notes** | Wisdom + Second Brain + Decision journal UIs | — | One list with type filter; decision review-date reminder |
| **Year in Review** | Old visual story | Selected-year filter, no fallbacks | Sync %, Money, Focus, Sleep year cards; shareable static snapshot |

---

## 12. Life-management science → concrete features

Keep claims modest in UI copy; these are well-known, evidence-informed techniques, not guarantees.

1. **Implementation intentions** (if-then planning; Gollwitzer & Sheeran meta-analysis shows reliable benefits for goal attainment): optional "If [time/place], then I [first action]" field per Must block, auto-suggested ("If it's 09:00, then I open the thermo notes"); included in the Google event description.
2. **Planning fallacy correction** (people underestimate task durations): estimate multiplier §7.5 and overcommit check §7.6.
3. **Time-blocking / timeboxing**: the whole Plan canvas; buffers default 10 min.
4. **Experience sampling**: ESM pings §6.6 to see where time really goes with low effort.
5. **Habit formation is gradual and a single miss is not fatal** (Lally et al. 2010: median ~66 days, wide spread): strict streak shown truthfully + separate "recovered after a miss" indicator ("never miss twice" prompt the day after a miss).
6. **Celebrate real progress, not activity** (progress principle): milestones for verifiable outcomes only — first full week with all Musts done, Sync ≥80% three days running, under budget for the month, 10 flashcard reviews streak. No XP for number of logs or expenses.
7. **Weekly review** (GTD-style): Sunday review screen — last week's Sync, Focus, Money vs budget, routines, wins/lessons; choose **one experiment** for next week (new repo's coach experiments: max 2 active) e.g. "Move GATE to 06:30 on weekdays".
8. **Fresh-start moments**: Monday/1st-of-month gentle prompt to set the week/month intention.
9. **Shutdown ritual**: evening review ends with "Day closed" state; reduces open loops.
10. **Energy-aware scheduling**: best-hours model §7.7 + optional energy tag (high/low) on blocks; Auto-place puts high-energy tasks in high-sync hours.
11. **Accountability tone**: direct, factual, kind — "GATE was skipped on 3 of 5 planned afternoons; 2 times you marked tired. Try a morning slot?" Never insulting, no moral "integrity score".

---

## 13. AI layer (server only — `server/ai.js` gateway, Gemini)

All endpoints: authenticated session + CSRF, per-user quota (existing `lifeos_consume_quota`), JSON schema in `generationConfig.responseMimeType`, server-side validation of every field, diary/SMS/OCR text treated as **untrusted content, not instructions**, temperature ≤0.2 for extraction. AI never writes data directly — it returns proposals the user approves.

| Endpoint | Input | Output | Used by |
|---|---|---|---|
| `POST planning/diary` (exists) | diary text, date, tz | tasks[] | Plan composer |
| `POST ai/ocr` (new) | image (≤5 MB, jpeg/png/heic converted client-side), purpose `diary`/`bill`/`timelog` | plain text + per-line confidence | Capture, Plan, Time Flow |
| `POST ai/parse-activities` (new) | text, date, tz, existing segments summary | activities[] (start/end/category/description, warnings) for **gaps only** | Time Flow quick add, evening review |
| `POST ai/extract-bill` (new) | OCR text or image | merchant, date, total (paise), items[], category suggestion | Money → Bills |
| `POST ai/finance-insights` (new) | **computed** numbers only (no raw SMS, no merchants unless user allows) | 5 insight cards with cited numbers | Money → Month |
| `POST ai/suggest-plan` (new) | carry-over, goals, best hours, multipliers, constraints | draft tasks (optimizer) | Time Flow optimizer, Study AI Planner |
| `POST ai/ask` (exists as gateway) | question + selected context range (server recomputes metrics) | answer with dated citations + optional typed proposals (`create_draft_block`, `log_activity`, `add_expense`) shown as approve/reject chips | Ask LifeOS |

Coach memory (new `coaching.js`): keep limits (12 facts, 8 preferences, 2 active experiments), confirmed-only memories, private-data exclusions.

---

## 14. Data, sync, storage & auth

- **Keep** new architecture: local-first state (`src/context/storage.js`) scoped per account, outbox → `server/routes.js sync` → Supabase `lifeos_records/lifeos_mutations` with RLS; one-writer Web Lock per account; conflict records; checksum backups.
- **Keep** Drive import of old data (`Me → Import old Google Drive data`) — extend importer UI to show **subscriptions, emis, loans, flashcards** now that UIs exist.
- **Add** Drive backup (opt-in): weekly + on-demand encrypted JSON (`AES-GCM`, key derived from a user passphrase or server-held per-user key — decide in Phase 7; default: server-held key so restore is one tap) into app-created folder via `drive.file` scope. Retain last 8 backups.
- **Scopes summary**: login (openid/email/profile) · `calendar.app.created` (plan + actual calendars, outcome mirroring) · optional `calendar.freebusy` · optional `drive.file` (backups, bill files) · existing optional `drive.readonly` only for one-time old-data import (can be revoked after import; explain this in UI).
- **Schema migration** `lifeos-data/3.0.0`: adds planning fields (§6.11), finance recurring normalisation (cycle enum, principal/rate/tenure), flashcard SM-2 fields; backup-before-migrate (new `createBackup`) and idempotent re-run tests.

---

## 15. Notifications & PWA

| Notification | Channel | Default |
|---|---|---|
| Block reminder (N min before) | Google Calendar popup (reliable, works with app closed) | 10 min |
| Block start (optional) | Web push | off |
| **Block end check-in** "Kya hua? GATE thermo" with actions Done / Partial / Other | Web push (actions where supported; tap → `/checkin`) | on |
| ESM ping | Web push | off (opt-in) |
| Evening review | Web push | 21:30 |
| Bill/EMI/subscription due | Web push | 2 days before, 09:00 |
| Morning "plan your day" (if no plan by 08:30) | Web push | on |

Rules: quiet hours (new `inQuietHours`), max 12 pushes/day, collapse duplicates (`tag`), feature-detect action buttons (iOS Home-Screen PWA ≥16.4 supports push; actions vary — fallback to tap-through). Single manifest via `vite-plugin-pwa` (remove manual link). Web Share Target (Android) so you can **share a bank SMS or screenshot into LifeOS Capture**. Update prompt stays opt-in (new).

---

## 16. Target folder structure

```
src/
  app/            App.jsx, routes.jsx, redirects.js, providers.jsx
  ui/             Card, StatCard, Tabs, Sheet, Field, MoneyField, TimeRangeField, Ring, ProgressBar, TruthBadge,
                  DateNavigator, EmptyState, Skeleton, Toast, ChartFrame
  ui/calendar/    HeatCalendar.jsx, YearHeatmap.jsx, MiniMonth.jsx
  ui/timeline/    DualTimeline.jsx, DayCanvas.jsx (drag/resize), DayRing.jsx, BurnUpChart.jsx
  styles/         tokens.css, base.css, motion.css, utilities.css
  features/
    today/        TodayPage.jsx, NowCard, NextList, SyncMini, QuickActions, Hero
    plan/         PlanPage.jsx, DiaryComposer, ParseReview, DraftEditor, CompareView, SyncPanel, EveningReview, WeekView, MonthView, YearView
    time/         TimePage.jsx, LiveClock, DayView, WeekView, MonthView, QuickAddSheet, ConflictResolver, GapRow, TimelineEntry
    money/        MoneyPage.jsx, tabs/{Today,Month,Year,Bills,Savings,Recurring}.jsx, ExpenseRow, ExpenseSheet, BillQueue, AccountFilter
    capture/      CaptureSheet, CaptureInbox, SmsPaste, PhotoCapture, VoiceCapture
    insights/     InsightsPage, SyncInsights, TimeInsights, MoneyInsights, ..., YearInReview, WeeklyReview
    areas/        study/, routines/, health/, journal/, goals/, notes/, reading/, meditation/, people/
    ask/          AskPage, AskSheet, ProposalChip
    me/           MePage, Integrations, Preferences, Privacy, ImportDrive, Backups
  domain/         (keep new) metrics/, planning/ (+ sync.js, learning.js), capture/, finance/ (+ recurring.js, emi.js, forecast.js), coaching.js, migration.js
  workers/        metrics.worker.js
  services/       (keep new) apiClient, authService, calendarService, syncService, timerService, ...
  hooks/          (keep) + useLiveNow, useReducedMotion, useSwipeNav
server/           (keep) + calendar.js mirror/actuals, ai.js endpoints, push.js kinds, migrations/003_*.sql
reference/old-src/  read-only copy of old repo src (not built)
```
Lint rule: max 400 lines per component file; no `style={{}}` except data-driven properties (enforce via ESLint custom rule or review).

---

## 17. Phased roadmap

Estimated effort assumes one developer + AI coding agent. Each phase ships behind no flags unless noted; each ends with tests + screenshots in both themes at 390 px and 1440 px.

### Phase 0 — Foundation (2–3 days)
- Create `lifeos-final` from new repo; copy old `src/` to `reference/old-src/`.
- Upgrade Tailwind 3 → 4 (`@tailwindcss/vite`), move tokens to `styles/tokens.css`; add `motion`, `@fontsource/syne`, `@fontsource/jetbrains-mono`.
- Port old keyframes into `styles/motion.css`; reduced-motion layer.
- Set up `metrics.worker.js` with day-summary memo keyed by `sourceRevision`.
- **Accept:** `npm run check` green; all existing 124 tests + 15 Playwright pass unchanged; audit shows no Tailwind glob findings.

### Phase 1 — Design system & shell (4–5 days)
- Build `src/ui/*` components (§5.5) with Storybook-lite page `/dev/ui` (dev only).
- New AppShell: sidebar (desktop) with `navPillSlide`, bottom bar with configurable slot and `＋` Capture sheet, glass top bar, View Transitions.
- `DateNavigator` replaces raw date inputs across pages.
- TruthBadge pattern applied to existing Insights cards (headline first, details in popover).
- **Accept:** keyboard nav + focus restore; AA contrast both themes; no layout shift at 320 px; Lighthouse a11y ≥ 95 on Today.

### Phase 2 — Flagship loop (8–10 days)
- `DayCanvas` drag/resize, unscheduled tray, capacity bar; `ParseReview` with inline ambiguity resolution; extended Hinglish parser cases (§20.3).
- Calendar export additions: per-block reminders, colours, intention text; **outcome mirroring**; **LifeOS Actual** calendar; migration `003`.
- Block-end push + `/checkin` deep link; check-in as Sheet with replacement capture & derail reasons.
- `domain/planning/sync.js` (§7) + `DualTimeline` + `BurnUpChart` + `SyncPanel`.
- Evening review flow + carry-over + "draft tomorrow".
- ESM pings (opt-in) + evening AI parse (`ai/parse-activities`).
- **Accept:** fixture `sync-basic` gives 56.7% → 76.7%, effort 61.7%, median delay +25 m; approving twice creates one revision; re-export reuses events; mirroring sets ✅ and colour after Done; user-edited Google event is never overwritten (ETag test); offline approval exports when back online; overnight block renders on both dates.

### Phase 3 — Time Flow (5–6 days)
- Port LiveClock/theme, timeline, distribution, quick-add (manual/AI/voice/photo), week view; build DayRing, gap rows, conflict resolver integration, month heat calendar, patterns.
- **Accept:** §8.5 cases; tapping a gap pre-fills its interval; no double counting with Study-linked sessions; clock loop paused when hidden.

### Phase 4 — Money (6–7 days)
- Decompose old Finance into `features/money/tabs/*`; rewire to ledger (paise) and `finance.js` extensions (`recurring.js`, `emi.js`, `forecast.js`).
- Spending HeatCalendar with new colour rule; safe-to-spend; projection with band; pace chart; category change; weekday pattern; account filter; yearly heatmap.
- Bills queue with server OCR/extraction; Drive `drive.file` storage of bill files; savings goal maths; recurring & debt UI; bill reminders.
- **Accept:** §9.8 cases; import of old finance JSON shows subscriptions/EMIs/loans; currency totals never mixed.

### Phase 5 — Areas & calendars everywhere (6–8 days)
- `HeatCalendar`/`YearHeatmap` in Study, Routines, Health/Sleep, Journal, Insights; unified "All areas" month layer + day sheet.
- Port Study tabs (+ SM-2 flashcards), Focus soundscapes inside timer, Routines UI, Health charts (no fake sync), Journal mood calendar, Notes merge, Year in Review fixes.
- **Accept:** unknown days never coloured as good; routine N-per-week maths tests; flashcard due queue on Today.

### Phase 6 — Today, Insights & coach (4–5 days)
- Today: hero (old greeting/gradient/orbs) + NOW/NEXT + check-ins + Sync mini ring + live burn-up + quick actions + Money/Focus/Sleep/Routines strip.
- Insights: Overview, Sync (hour×weekday heatmap, trend, derail reasons breakdown, estimate multipliers), Time, Study, Sleep, Money, Routines, Year; "Compare two metrics" (correlation shown only with ≥21 paired days, existing coaching limit; correlation ≠ causation note).
- Weekly review + experiments; milestones (§12.6); Ask LifeOS sheet with proposals.
- **Accept:** share preview equals shared page (parity test); insights numbers equal Area numbers for same range.

### Phase 7 — Hardening & release (4–5 days)
- Drive backups; privacy export includes new entities; Web Share Target; push kinds + quiet hours + daily cap; performance (year view < 300 ms on mid-range Android via worker; route JS < 200 KB gz each); error monitoring hook; README + setup docs updated.
- Real-account verification checklist (§18.3).

**Total ≈ 6–8 weeks** of focused work. Fastest path to daily value: Phase 0 → 1 (minimal) → **2** → 4 → 3.

---

## 18. Testing plan

### 18.1 Unit/property (node --test, keep existing style)
`sync.test.js` (§7.1 fixture + invariants §7.8 with randomized blocks/segments), `learning.test.js` (multiplier shrinkage, n thresholds), `finance-forecast.test.js`, `emi.test.js`, `recurring.test.js` (all cycles), `heatcalendar-status.test.js` (unknown vs zero), `parser-hinglish.test.js` (§20.3 table), `mirror.test.js` (ETag, colour, title prefix idempotency), `esm.test.js` (no ping during timer/check-in/quiet hours), `migration-3.test.js` (idempotent, backup first).

### 18.2 Playwright workflows (add to existing 15)
1. Diary text → parse → resolve "7 baje" → drag a block → approve & export (mocked Google) → reminder payload correct.
2. Block end → check-in "Did something else: YouTube 30m" → DualTimeline shows drift ribbon → Sync updates.
3. Evening review → carry-over → tomorrow draft contains carried task.
4. Money: rent day not red; paste SMS → review → confirm → calendar cell updates with animation.
5. Time Flow: tap gap on DayRing → quick add prefilled → ring closes gap.
6. Offline: approve plan offline, reconnect, export happens once.
7. Reduced motion: no running animations (check `getAnimations()` length) on Today.
8. Mobile 320 px: Plan compare view usable; bottom sheet drag-to-dismiss.

### 18.3 Real-world verification (cannot be mocked — do on your account)
Google consent for calendar + optional freebusy/drive.file; event appears in **LifeOS Plan** with 10-min popup on your phone; check-in link opens the right block; outcome mirroring visible in Google Calendar; push on Android Chrome installed PWA and iPhone Home-Screen PWA; two-device timer takeover; old Drive data import of your real files; backup → restore round trip.

---

## 19. Risks & open decisions

| Risk / decision | Recommendation |
|---|---|
| Push reliability on iPhone | Google Calendar reminders are the guaranteed path; push is a bonus. Show status in Me → Notifications ("Last push delivered 09:50"). |
| ESM ping fatigue | Off by default; max every 60 min; auto-pause after 3 ignored pings in a row; "snooze today". |
| AI cost/quota | Deterministic parsers first; AI only on demand; per-user daily char quota (exists). |
| `calendar.freebusy` & `drive.file` consent | Request incrementally only when the feature is used; app in Testing mode needs you as test user. |
| Scope creep from optional modules | Reading/Meditation/CRM ported last, behind "Optional modules" toggle. |
| Old monolith porting introduces old maths | Rule: pages may **only** read numbers from `domain/` selectors; ESLint `no-restricted-imports` blocks pages from importing raw state helpers for metrics. |
| Gamification removal disappoints | Milestones + celebrations for earned outcomes (§12.6) keep the joy without fake incentives. RPG data stays exportable. |
| Phone performance | Worker + memoised day summaries; virtualise long transaction/timeline lists (`@tanstack/react-virtual`). |

---

## 20. Appendices

### 20.1 Old → new field mapping (for migration & ports)
| Old | New canonical |
|---|---|
| `timeflow.entries{date,startTime,endTime,durationMinutes,category,description,tags,studySessionId}` | Activity (`startAt/endAt` via `normalizeManualInterval`, tz; duration-only if no times; keep `studySessionId` link) |
| `study.sessions{date,subject,durationMinutes}` | Activity tagged study (linked if `studySessionId`), else unpositioned reported study |
| `finance.expenses{amount,category,account,date,tags,billId}` | Transaction (`amountMinor`, currency, type, canonical categoryId, account) |
| `finance.subscriptions{name,amount,cycle,nextRenewal}` | Recurring (cycle enum, monthlyEquivalentMinor derived) |
| `finance.emis{name,amount,remainingMonths,totalMonths,rate}` | Loan/EMI (derive outstanding via annuity PV) |
| `finance.loans{person,amount,type,dueDate}` | Debt (direction lent/borrowed, settledAt) |
| `habits.checkpoints/dailyLogs` | Routine + occurrences |
| `health.bodyLogs` (smartwatch rows) | Manual fields kept; simulated fields quarantined (new `quarantineSyntheticHealth`) |
| `journal.entries{mood}` | Journal entry (mood 1–5) |
| `study.flashcards` | Flashcard + SM-2 fields (`ef=2.5, interval=0, reps=0, due=today`) |

### 20.2 Keyframes to port from old `index.css`
`pageEnter, cardEntrance, cardSlideIn, fadeSlideIn, numberPop, countUp, progressFill, scoreRingFill, ringGlow, pulseGlow, livePulse, drawerSlideUp, slideUpSheet, modalFadeIn, modalBackdropFadeIn, toastSlideIn, toastSlideOut, tooltipIn, navPillSlide, colonPulse, floatOrb, heroGlow, shimmer, checkTick, confettiFall, typingDots, messageSlideIn, reasoningPulse, cursorBlink, spin`. Drop: `borderGlow` loops on cards, `floatUp` decorative quotes, unsolicited sounds (keep `useAudio` only for timer end/check-in, user-toggleable).

### 20.3 Hinglish parser fixtures (expected start–end)
| Input | Expected |
|---|---|
| `9 se 11 GATE thermo must` | 09:00–11:00, Must, Study (rule: a bare hour resolves to the only interpretation that falls inside the user's waking window; if both AM and PM fit, ask) |
| `shaam 6 se 7 baje walk` | 18:00–19:00 Exercise |
| `subah 6:30 uthna` | 06:30 point task, 30 m assumed (flagged) |
| `dopahar 2 se 4 project` | 14:00–16:00 |
| `saade 9 se 11 tak padhai` | 09:30–11:00 Study |
| `sava 10 meeting 45 min` | 10:15–11:00 |
| `paune 8 nashta` | 07:45, 30 m assumed, Meals |
| `raat 11 se 1 movie` | 23:00–01:00 next day |
| `7 baje call` | **warning: AM or PM?** (both 07:00 and 19:00 are inside the waking window) |
| `२ से ४ बजे पढ़ाई` | 14:00–16:00 Study (02:00 is outside the waking window, so only PM fits) |
| `2026-10-05 dentist 5pm` on plan for 10-04 | warning: date differs |

### 20.4 Ready-to-paste starting instruction for the coding agent
> You are implementing LifeOS 3.0. The working repo is the new LifeOS (v2) codebase; `reference/old-src/` contains the old app for UI porting only. Read `LifeOS_Final_Implementation_Plan.md` fully, then `docs/PLAN.md` for data-truth rules and `AGENTS.md` invariants. Start with Phase 0. Pages must read all numbers from `src/domain` selectors — never re-implement maths in components. Port old UI by decomposing files into `src/features/*` per §16, using the design tokens and components in §5. After each phase: run `npm run check`, the Playwright workflows, capture screenshots at 390 px and 1440 px in both themes, and list anything not verified live. Do not call mocked provider tests live verification.

