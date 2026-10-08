const fs = require('fs');

// ============================================================
// FIX 1: [P1] Initialization-order crash in DayPlanner.jsx
// ============================================================
function fix1() {
  const path = 'src/components/ui/DayPlanner.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Current broken order (lines 44-56):
  //   44: nowMin = ...
  //   45: baselines = ...
  //   46: baseline = ...
  //   47: comparison = planComparison(referencePlans, ...)   ← uses referencePlans BEFORE it exists
  //   48-53: useState declarations
  //   54: [comparisonMode, setComparisonMode] = useState('current')
  //   55: (blank)
  //   56: referencePlans = ...                              ← defined too late

  // We need to replace lines 47 through 56 with the correct order.
  const oldBlock = [
    `  const comparison = planComparison(referencePlans, entries, nowMin)`,
    `  const [open, setOpen] = useState(false)`,
    `  const [actualsOpen, setActualsOpen] = useState(false)`,
    `  const [expanded, setExpanded] = useState(null)`,
    `  const [draftDate, setDraftDate] = useState(date)`,
    `  const [draft, setDraft] = useState([])`,
    `  const [actualDraft, setActualDraft] = useState(null)`,
    `  const [comparisonMode, setComparisonMode] = useState('current')`,
    `  `,
    `  const referencePlans = comparisonMode === 'original' && baseline ? baseline.slots : plans`,
  ].join('\r\n');

  const newBlock = [
    `  const [open, setOpen] = useState(false)`,
    `  const [actualsOpen, setActualsOpen] = useState(false)`,
    `  const [expanded, setExpanded] = useState(null)`,
    `  const [draftDate, setDraftDate] = useState(date)`,
    `  const [draft, setDraft] = useState([])`,
    `  const [actualDraft, setActualDraft] = useState(null)`,
    `  const [comparisonMode, setComparisonMode] = useState('current')`,
    `  const referencePlans = comparisonMode === 'original' && baseline ? baseline.slots : plans`,
    `  const comparison = planComparison(referencePlans, entries, nowMin)`,
  ].join('\r\n');

  if (c.includes(oldBlock)) {
    c = c.replace(oldBlock, newBlock);
    fs.writeFileSync(path, c);
    console.log('FIX 1 applied: initialization order fixed');
    return true;
  }
  console.log('FIX 1 FAILED: old block not found');
  return false;
}

// ============================================================
// FIX 2: [P1] activityId inheritance — only inherit when
//         category matches the planned slot, else new uuid
// ============================================================
function fix2() {
  const path = 'src/components/ui/DayPlanner.jsx';
  let c = fs.readFileSync(path, 'utf8');
  let changed = false;

  // Fix 2a: Manual check-in (saveCheck) — line 299
  // Current: activityId: slot.activityId || uuid(),
  // Should: only inherit if category matches
  const oldCheckin = `            activityId: slot.activityId || uuid(),`;
  const newCheckin = `            activityId: (category === slot.category && slot.activityId) ? slot.activityId : uuid(),`;
  if (c.includes(oldCheckin)) {
    c = c.replace(oldCheckin, newCheckin);
    changed = true;
    console.log('FIX 2a applied: saveCheck activityId conditional on category match');
  } else {
    console.log('FIX 2a skipped: target not found');
  }

  // Fix 2b: Diary import (commitActualDraft) — line 136
  // Current: activityId: (plans.find(p => p.id === act.planSlotId) || {}).activityId || uuid(),
  // Should: only inherit if category matches
  const oldDiary = `            activityId: (plans.find(p => p.id === act.planSlotId) || {}).activityId || uuid(),`;
  const newDiary = `            activityId: (() => { const matchedPlan = plans.find(p => p.id === act.planSlotId); return (matchedPlan && matchedPlan.category === act.category && matchedPlan.activityId) ? matchedPlan.activityId : uuid(); })(),`;
  if (c.includes(oldDiary)) {
    c = c.replace(oldDiary, newDiary);
    changed = true;
    console.log('FIX 2b applied: diary import activityId conditional on category match');
  } else {
    console.log('FIX 2b skipped: target not found');
  }

  if (changed) {
    fs.writeFileSync(path, c);
    console.log('FIX 2 done');
  }
  return changed;
}

// ============================================================
// FIX 3: [P1] Drive merge — register new collections
// ============================================================
function fix3() {
  const path = 'src/context/AppContext.jsx';
  let c = fs.readFileSync(path, 'utf8');

  const oldLine = `  timeflow: ['entries', 'plans', 'calendarQueue'],`;
  const newLine = `  timeflow: ['entries', 'plans', 'calendarQueue', 'planBaselines', 'planRevisions', 'displacedDecisions'],`;

  if (c.includes(oldLine)) {
    c = c.replace(oldLine, newLine);
    fs.writeFileSync(path, c);
    console.log('FIX 3 applied: new collections registered for merge');
    return true;
  }
  console.log('FIX 3 FAILED: target not found');
  return false;
}

// ============================================================
// FIX 4: [P2] Diary confirmation validation — add overlap
//         check with existing entries, future-time guard,
//         and unconditional session cleanup
// ============================================================
function fix4() {
  const path = 'src/components/ui/DayPlanner.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix 4a: Add overlap + future-time check after validateSlots
  const oldValidation = `        validateSlots(actualDraft.filter(a => a.planOutcome !== 'missed'))
        for (const act of actualDraft) {`;
  const newValidation = `        const nonMissed = actualDraft.filter(a => a.planOutcome !== 'missed')
        validateSlots(nonMissed)
        // Reject future end times
        if (nonMissed.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), timeMinutes(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))))) throw new Error('Actual diary entries cannot extend into future time.')
        // Reject overlaps with existing manual actuals
        const retained = entries.filter(e => e.source !== 'auto-diary' && !e.ghost && e.planOutcome !== 'missed')
        const combined = [...retained, ...nonMissed]
        validateSlots(combined)
        for (const act of actualDraft) {`;
  if (c.includes(oldValidation)) {
    c = c.replace(oldValidation, newValidation);
    console.log('FIX 4a applied: full validation in commitActualDraft');
  } else {
    console.log('FIX 4a skipped: target not found');
  }

  // Fix 4b: Make session cleanup unconditional (remove `if (sessions.length)` wrapper)
  const oldSessionCleanup = `        if (sessions.length) {
          setModule('study', current => {
             const oldAutoSessions = new Set((current.sessions || []).filter(s => s.date === draftDate && s.source === 'auto-diary').map(s => s.id))
             return {
               ...current,
               sessions: [...(current.sessions || []).filter(s => !oldAutoSessions.has(s.id)), ...sessions]
             }
          })
        }`;
  const newSessionCleanup = `        setModule('study', current => {
           const oldAutoSessions = new Set((current.sessions || []).filter(s => s.date === draftDate && s.source === 'auto-diary').map(s => s.id))
           return {
             ...current,
             sessions: [...(current.sessions || []).filter(s => !oldAutoSessions.has(s.id)), ...sessions]
           }
        })`;
  if (c.includes(oldSessionCleanup)) {
    c = c.replace(oldSessionCleanup, newSessionCleanup);
    console.log('FIX 4b applied: unconditional session cleanup');
  } else {
    console.log('FIX 4b skipped: target not found');
  }

  fs.writeFileSync(path, c);
  return true;
}

// ============================================================
// FIX 5: [P2] Cumulative graph — filter plans by selected date,
//         use normalizeDay for actuals, fix current-time endpoint
// ============================================================
function fix5() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  const oldGraph = `    const referencePlans = (state.timeflow?.comparisonMode === 'original' && baseline) ? baseline.slots : allPlans;
    const planMins = resolveMinutes(referencePlans).mins;
    const actualMins = resolveMinutes(allEntries.filter(e => e.date === selectedDate)).mins;`;
  const newGraph = `    const datePlans = allPlans.filter(p => p.date === selectedDate);
    const referencePlans = (state.timeflow?.comparisonMode === 'original' && baseline) ? baseline.slots : datePlans;
    const planMins = resolveMinutes(referencePlans).mins;
    const actualMins = resolveMinutes(normalizeDay(allEntries, selectedDate)).mins;`;

  if (c.includes(oldGraph)) {
    c = c.replace(oldGraph, newGraph);
    console.log('FIX 5a applied: graph filters plans by date, uses normalizeDay');
  } else {
    console.log('FIX 5a skipped: target not found');
  }

  // Fix the current-time endpoint: sample AT minute i, not i+1
  const oldEndpoint = `       if ((i + 1) % 15 === 0 || i === 1439 || (selectedDate === today && i === nowMinute)) {
         data.push({
           time: \`\${Math.floor((i+1)/60).toString().padStart(2,'0')}:\${((i+1)%60).toString().padStart(2,'0')}\`,
           planned: pt,
           actual: (selectedDate < today || (selectedDate === today && i <= nowMinute)) ? at : null
         });
       }`;
  const newEndpoint = `       if (i % 15 === 0 || i === 1439 || (selectedDate === today && i === nowMinute)) {
         const h = Math.floor(i / 60).toString().padStart(2, '0');
         const m = (i % 60).toString().padStart(2, '0');
         data.push({
           time: \`\${h}:\${m}\`,
           planned: pt,
           actual: (selectedDate < today || (selectedDate === today && i <= nowMinute)) ? at : null
         });
       }`;
  if (c.includes(oldEndpoint)) {
    c = c.replace(oldEndpoint, newEndpoint);
    console.log('FIX 5b applied: fixed graph sampling timestamps');
  } else {
    console.log('FIX 5b skipped: target not found');
  }

  fs.writeFileSync(path, c);
  return true;
}

// ============================================================
// FIX 6: [P2] moveTomorrow — use savePlan-style revision,
//         validate destination, unique ID, mark displaced minutes
// ============================================================
function fix6() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  const oldMove = `  const moveTomorrow = (d) => {
    const slot = allPlans.find(p => p.id === d.sourceSlotId)
    if (!slot) return
    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    
    setModule('timeflow', current => ({
      ...current,
      plans: [...(current.plans || []), { ...slot, id: slot.id + '-moved', date: tomorrowStr, calendarEventKey: slot.calendarEventKey + '-moved' }],
      displacedDecisions: [...(current.displacedDecisions || []), { sourceSlotId: d.sourceSlotId, status: 'moved', date: new Date().toISOString() }]
    }))
  }`;

  const newMove = `  const moveTomorrow = (d) => {
    const slot = allPlans.find(p => p.id === d.sourceSlotId)
    if (!slot) return
    const tomorrow = new Date(selectedDate + 'T00:00:00')
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const newSlotId = uuid()
    const newActivityId = uuid()
    const affectedMins = d.affectedMinutes || durationMinutes(slot.start, slot.end)

    // Check for overlaps at destination
    const destPlans = (state.timeflow?.plans || []).filter(p => p.date === tomorrowStr)
    const destConflict = destPlans.some(p => Math.max(timeMinutes(p.start), timeMinutes(slot.start)) < Math.min(timeMinutes(p.end), timeMinutes(slot.end)))
    if (destConflict) {
      showToast('Time slot conflicts with tomorrow\\'s plan. Please reschedule manually.', 'error')
      return
    }

    const updatedAt = new Date().toISOString()
    setModule('timeflow', current => {
      const revisions = current.planRevisions || []
      const newRevision = {
        id: uuid(),
        date: tomorrowStr,
        parentRevisionId: [...revisions].filter(r => r.date === tomorrowStr).pop()?.id || null,
        createdAt: updatedAt,
        reason: 'Displaced activity moved from ' + selectedDate,
        slots: [...destPlans, { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr }].map(s => structuredClone(s))
      }
      return {
        ...current,
        plans: [...(current.plans || []), { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }],
        planRevisions: [...revisions, newRevision],
        displacedDecisions: [...(current.displacedDecisions || []), { id: uuid(), sourceSlotId: d.sourceSlotId, status: 'moved', affectedMinutes: affectedMins, destinationDate: tomorrowStr, destinationSlotId: newSlotId, date: updatedAt }]
      }
    })
    showToast(\`Moved "\${slot.name}" to \${tomorrowStr}\`, 'success')
  }`;

  if (c.includes(oldMove)) {
    c = c.replace(oldMove, newMove);
    fs.writeFileSync(path, c);
    console.log('FIX 6 applied: moveTomorrow validated with revisions');
    return true;
  }
  console.log('FIX 6 FAILED: target not found');
  return false;
}

// ============================================================
// FIX 7: [P2] Tray cutoff — use date-aware cutoff, include
//         missed markers in dayEntries for comparison
// ============================================================
function fix7() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // The current comparison line uses nowMinute (always current time)
  // and dayEntries (which filters out missed/ghost). Fix both.
  const oldComparison = `    const comparison = useMemo(() => planComparison(allPlans.filter(p => p.date === selectedDate), dayEntries, nowMinute), [allPlans, dayEntries, nowMinute, selectedDate])`;
  const newComparison = `    const comparisonEntries = useMemo(() => normalizeDay(allEntries, selectedDate).filter(e => !e.ghost), [allEntries, selectedDate])
    const comparison = useMemo(() => planComparison(allPlans.filter(p => p.date === selectedDate), comparisonEntries, cutoff), [allPlans, comparisonEntries, cutoff, selectedDate])`;

  if (c.includes(oldComparison)) {
    c = c.replace(oldComparison, newComparison);
    fs.writeFileSync(path, c);
    console.log('FIX 7 applied: comparison uses cutoff and includes missed markers');
    return true;
  }
  console.log('FIX 7 FAILED: target not found');
  return false;
}

// ============================================================
// FIX 8: Add unique IDs to dispatchDecision calls (for merge)
// ============================================================
function fix8() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  const oldDispatch = `  const dispatchDecision = (sourceSlotId, status) => {
    setModule('timeflow', current => ({
      ...current,
      displacedDecisions: [...(current.displacedDecisions || []), { sourceSlotId, status, date: new Date().toISOString() }]
    }))
  }`;
  const newDispatch = `  const dispatchDecision = (sourceSlotId, status) => {
    setModule('timeflow', current => ({
      ...current,
      displacedDecisions: [...(current.displacedDecisions || []), { id: uuid(), sourceSlotId, status, date: new Date().toISOString() }]
    }))
  }`;

  if (c.includes(oldDispatch)) {
    c = c.replace(oldDispatch, newDispatch);
    fs.writeFileSync(path, c);
    console.log('FIX 8 applied: dispatchDecision with unique IDs');
    return true;
  }
  console.log('FIX 8 skipped: target not found');
  return false;
}

// ============================================================
// FIX 9: Ensure uuid is imported in TimeFlow.jsx
// ============================================================
function fix9() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  if (!c.includes("import { v4 as uuid }")) {
    // Add uuid import after the first import line
    c = c.replace(
      "import { useEffect, useMemo, useRef, useState, useCallback } from 'react'",
      "import { useEffect, useMemo, useRef, useState, useCallback } from 'react'\nimport { v4 as uuid } from 'uuid'"
    );
    fs.writeFileSync(path, c);
    console.log('FIX 9 applied: uuid import added to TimeFlow');
    return true;
  }
  console.log('FIX 9 skipped: uuid already imported');
  return true;
}

// ============================================================
// FIX 10: Ensure durationMinutes is available in TimeFlow
// (it's imported as slotDuration alias)
// ============================================================
function fix10() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Check if durationMinutes is used directly (in moveTomorrow)
  // It's imported as `durationMinutes as slotDuration`
  // Replace usage in moveTomorrow to use slotDuration
  if (c.includes('durationMinutes(slot.start, slot.end)') && !c.includes("import { v4 as uuid } from 'uuid'")) {
    // Already have slotDuration alias, use it
    c = c.replace(/durationMinutes\(slot\.start, slot\.end\)/g, 'slotDuration(slot.start, slot.end)');
    fs.writeFileSync(path, c);
    console.log('FIX 10 applied: use slotDuration alias');
    return true;
  }
  // If durationMinutes is used but imported as slotDuration, fix the reference
  if (c.includes('durationMinutes as slotDuration')) {
    c = c.replace(/(?<!\w)durationMinutes\(slot\.start/g, 'slotDuration(slot.start');
    fs.writeFileSync(path, c);
    console.log('FIX 10 applied: durationMinutes -> slotDuration');
    return true;
  }
  console.log('FIX 10 skipped');
  return true;
}

// Run all fixes
console.log('=== Starting all fixes ===\n');
fix1();
fix2();
fix3();
fix4();
fix5();
fix6();
fix7();
fix8();
fix9();
fix10();
console.log('\n=== All fixes attempted ===');
