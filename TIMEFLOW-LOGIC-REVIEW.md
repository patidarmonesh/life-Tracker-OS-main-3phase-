# Time Flow: implemented fixes and recommended next changes

## Chosen rule: category and judgment are independent

Your latest request explicitly says to put the activities marked waste into waste, while keeping their normal categories. This implementation follows that rule. The pasted older summary also mentions a stricter “everything except study is waste” policy; that is a different policy and is not silently enabled.

| Entry | Category | Waste flag | Accountability bucket |
| --- | --- | --- | --- |
| 00:00–02:00 Rishi se baat, waste | Talk with Dost / your social category | true | Waste: 120m |
| 02:00–09:00 Soya, waste | Sleep | true | Waste: 420m |
| 09:00–11:00 Padhai | Study | false | Padhai: 120m |

The category chart still shows Social 2h, Sleep 7h, Study 2h. The accountability bar shows Waste 9h and Padhai 2h. Sleep is already included in waste here: never add another 7h to that bar. Non-study activities without a waste flag stay “Other / unflagged”. Known waste categories, including legacy Waste Time and custom names containing waste/timepass/scroll, still default to waste. Use a normal category when you need to classify that activity independently.

## Fixes implemented

- Preserve AI-generated waste flags in editable plan drafts; expose a waste checkbox without changing category.
- Inherit the planned flag in a check-in. Changing the actual category resets its default flag; the actual flag can be set before saving.
- Preserve waste flags in diary actual imports and pass planned flags to the AI prompt.
- Creating an additional actual segment creates a new ID. Editing a segment finds that exact ID, rather than grabbing the first entry linked to the slot.
- Reject actual overlaps, including multiple actuals linked to the same plan slot. Ignore ghost/missed markers when checking physical overlaps.
- Do not generate automatic missed ghost records just because one activity overlapped half of another planned slot. Actual overlap itself supplies the deviation evidence.
- Explicit missed check-ins remain review markers and never become logged time, category totals, or study sessions.
- Reject invalid/overlapping diary actual imports and imports overlapping retained manual logs. Reimport replaces prior diary-generated study sessions in the actual Study module instead of accumulating duplicates in Time Flow.
- Manual and diary actuals cannot save future elapsed time. For an ongoing activity use Partial and set the end to the time actually completed.
- All category totals, productivity totals, waste totals, and ribbons use the same minute allocation: latest edited entry wins historical overlaps. Each minute counts once.
- Clip today's totals to the current minute; refresh periodically. Past days use the full day and future days have zero elapsed minutes.
- Keep category names intact in the category breakdown instead of replacing them with internal group names such as selfcare or waste.
- Keep sleep as an independent category statistic. Weekly stacked bars use unflagged sleep so waste-flagged sleep cannot be counted twice.
- Correct the plan preview totals, the missing timeline component import, the midnight axis label, the broken actual-time separator, and the duplicate timeline hint.
- Show planned study by the current time, logged study, and their signed difference. Missing logs are unknown, so this is a recorded difference, not proof of what the person was actually doing.

## Exact mathematics

For selected-day elapsed cutoff `C` (0 through 1440):

- `Logged = number of resolved actual minutes before C`.
- `Past Gap = C − Logged`.
- `Remaining = 1440 − C`.
- `Logged + Past Gap + Remaining = 1440`.
- `Padhai + Waste + Other/unflagged = Logged`.
- Sleep is a category total that may overlap Waste or Other; it is not an extra additive accountability bucket.

At 18:55, with actual logs covering 00:00–17:30, Logged is 1050m, Past Gap is 85m, and Remaining is 305m. The original 6.5h past gap incorrectly included the future.

Plan comparison uses the same wall-clock minute for both rows. A matching category is followed; a different actual category is changed. A minute without an actual stays pending unless explicitly reviewed as missed. Future minutes stay pending. Linking an entry to a plan slot does not force it to count as followed.

`Adherence = Followed ÷ (Followed + Changed) × 100`, or no percentage when no minutes have been reviewed. Pending minutes are excluded. Planned waste is included in adherence because adherence measures following the schedule, not being productive.

For Lunch planned 14:00–14:30 but actual 14:00–14:50, followed lunch is 30m. The 20m overrun changes the next Study slot. ID-card work 14:50–16:30 changes another 100m; Study 16:30–17:00 follows 30m. Across those two planned slots: 60m followed, 120m changed, adherence 33%.

For the complete pasted day through 17:30, matching categories give 930m followed, 120m changed, and 390m pending out of 1440m. Reviewed adherence rounds to 89%. Of those pending minutes at 18:55, 85m are overdue/unknown and 305m are future. A high adherence percentage can coexist with low study time.

## Graph recommendation

1. Keep the aligned horizontal Plan and Actual timelines on one 24-hour axis. Use category colors. Show deviations only where actual evidence or an explicit missed check-in exists; future/unknown slots are not failures.
2. Keep one category donut for “what happened”, with exact durations and percentages of logged time. Category totals must sum to logged time.
3. Use the horizontal Padhai / Waste / Other bar for accountability. Gray represents unflagged time; unknown time must not be silently called waste. Use exact minute values in text, rounded hours only for compact display.
4. Keep the Followed / Changed / Pending bar next to adherence. The percentage should always have its reviewed-time context.
5. Keep daily stacked columns for the week with non-overlapping categories: Padhai, Waste, unflagged Sleep, other unflagged time, and unlogged time.
6. Next optional graph: cumulative study minutes over the day, planned line versus actual line, stopping the actual line at now. It answers “by now how far behind am I?” better than another donut. Not added in this change.

## Remaining design work — explicitly not implemented

- **Frozen baseline and revisions.** Current adherence compares the current saved plan, and the UI now says so. Editing it can change historical adherence. Next version should snapshot the first confirmed plan, keep editable current-plan revisions separately, and offer Original vs Current comparison. Actuals remain independent. For existing days the original cannot be reconstructed honestly; start a baseline from the earliest version still available and label that limitation. Calendar sync should follow only the current version.
- **Displaced activities.** Do not automatically move or delete planned tasks when actuals overrun. A separate tray with Keep, Reschedule, Skip, and Tomorrow actions needs explicit fixed/flexible slot rules. This is a feature requiring its own persistence and calendar behavior, not a mathematical correction.
- **Specific activity matching.** Current adherence matches category: Study Maths and Study Physics both count as Study. To measure subject-level fidelity, add an explicit activity/subject ID instead of guessing from titles.
- **Diary preview.** The existing diary actual-import action still saves its validated result directly. A separate editable preview before committing would make corrections easier. Malformed and conflicting imports are now rejected.
- Existing old records whose waste flag was already dropped cannot be reliably recovered from the saved data. Edit those plans/check-ins once to restore the intended flags. There is no bulk relabeling of historical records.
- Live Google Calendar/Drive account writes were not exercised. Existing calendar service tests cover event IDs, updates, midnight handling, and deletion behavior; this change does not redesign calendar sync.

## Verification

Automated accounting tests cover independent category/waste totals, overlap resolution, midnight/overnight records, current-time clipping, future days, explicit missed records, pending exclusion, lunch overruns, and multiple actual segments. The browser regression covers plan flag inheritance, actual persistence after reload, distinct IDs for extra segments, same-slot overlap rejection, and the mobile layout. Source lint and production build are checked separately.
