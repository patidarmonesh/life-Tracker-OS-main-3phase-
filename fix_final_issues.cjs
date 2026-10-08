const fs = require('fs');

function fixDayPlanner() {
  const path = 'src/components/ui/DayPlanner.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix 1: Restore Original Calendar update skip
  const oldRestoreFunc = `  function restoreOriginalPlan() {
    if(!confirm('Overwrite your current plan with the original baseline?')) return;
    try {
      const updatedAt = new Date().toISOString()
      setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === date)
        const revisions = current.planRevisions || []
        
        // Keep baseline IDs so check-ins stay linked!
        const restoredSlots = baseline.slots.map(s => ({ ...s, updatedAt }))
        
        const newRevision = {
           id: uuid(),
           date: date,
           parentRevisionId: [...revisions].filter(r => r.date === date).pop()?.id || null,
           createdAt: updatedAt,
           reason: "Restored to baseline",
           slots: structuredClone(restoredSlots)
        }

        const kept = new Set(restoredSlots.map(s => s.id))
        const removed = old.filter(p => !kept.has(p.id) && p.calendarEnabled)
        return { ...current,
          comparisonMode: 'current',
          planRevisions: [...revisions, newRevision],
          plans: [...(current.plans || []).filter(p => p.date !== date), ...restoredSlots],
          calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
        }
      })
      showToast('Restored to original plan.', 'success')
    } catch (e) { setError(e.message) }
  }`;

  const newRestoreFunc = `  function restoreOriginalPlan() {
    if(!confirm('Overwrite your current plan with the original baseline?')) return;
    try {
      const updatedAt = new Date().toISOString()
      setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === date)
        const revisions = current.planRevisions || []
        
        // Keep baseline IDs so check-ins stay linked!
        const restoredSlots = baseline.slots.map(s => {
           const rs = { ...s, updatedAt };
           delete rs.calendarFingerprint;
           return rs;
        })
        
        const newRevision = {
           id: uuid(),
           date: date,
           parentRevisionId: [...revisions].filter(r => r.date === date).pop()?.id || null,
           createdAt: updatedAt,
           reason: "Restored to baseline",
           slots: structuredClone(restoredSlots)
        }

        const removed = old.filter(p => {
           if (!p.calendarEnabled) return false;
           const r = restoredSlots.find(s => s.id === p.id);
           return !r || !r.calendarEnabled || r.calendarEventKey !== p.calendarEventKey;
        })
        return { ...current,
          comparisonMode: 'current',
          planRevisions: [...revisions, newRevision],
          plans: [...(current.plans || []).filter(p => p.date !== date), ...restoredSlots],
          calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
        }
      })
      showToast('Restored to original plan.', 'success')
    } catch (e) { setError(e.message) }
  }`;

  if (c.includes(oldRestoreFunc)) {
    c = c.replace(oldRestoreFunc, newRestoreFunc);
    console.log('DayPlanner Fix 1 (Restore original sync bypass) applied.');
  }

  // Fix 3: Baseline creation missing path on deletion
  const oldSavePlan = `if (!existingBaseline && finalSlots.length > 0) {`;
  const newSavePlan = `if (!existingBaseline && (finalSlots.length > 0 || old.length > 0)) {`;
  if (c.includes(oldSavePlan)) {
    c = c.replace(oldSavePlan, newSavePlan);
    console.log('DayPlanner Fix 3 (Baseline creation on deletion) applied.');
  }

  // Fix 4: Missed-only diary import reject
  const oldDiaryValid = `          const nonMissed = actualDraft.filter(a => a.planOutcome !== 'missed')
          validateSlots(nonMissed)
          // Reject future end times
          if (nonMissed.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), timeMinutes(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))))) throw new Error('Actual diary entries cannot extend into future time.')
          // Reject overlaps with existing manual actuals
          const retained = entries.filter(e => e.source !== 'auto-diary' && !e.ghost && e.planOutcome !== 'missed')
          const combined = [...retained, ...nonMissed]
          validateSlots(combined)`;

  const newDiaryValid = `          if (!actualDraft || actualDraft.length === 0) throw new Error('No entries to save.')
          const nonMissed = actualDraft.filter(a => a.planOutcome !== 'missed')
          if (nonMissed.length > 0) {
            validateSlots(nonMissed)
            // Reject future end times
            if (nonMissed.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), timeMinutes(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))))) throw new Error('Actual diary entries cannot extend into future time.')
            // Reject overlaps with existing manual actuals
            const retained = entries.filter(e => e.source !== 'auto-diary' && !e.ghost && e.planOutcome !== 'missed')
            const combined = [...retained, ...nonMissed]
            validateSlots(combined)
          }`;

  if (c.includes(oldDiaryValid)) {
    c = c.replace(oldDiaryValid, newDiaryValid);
    console.log('DayPlanner Fix 4 (Missed-only diary import validation) applied.');
  }

  fs.writeFileSync(path, c);
}

function fixTimeFlow() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix 2: Partial move overlap check wrong end-time
  const oldDestConflict = `const destConflict = destPlans.some(p => Math.max(timeMinutes(p.start), timeMinutes(slot.start)) < Math.min(timeMinutes(p.end), timeMinutes(slot.end)))`;
  const newDestConflict = `const destConflict = destPlans.some(p => Math.max(timeMinutes(p.start), timeMinutes(slot.start)) < Math.min(timeMinutes(p.end), timeMinutes(adjustedEnd)))`;
  if (c.includes(oldDestConflict)) {
    c = c.replace(oldDestConflict, newDestConflict);
    console.log('TimeFlow Fix 2 (Partial move overlap logic) applied.');
  }

  // Fix 3 (part 2): Move to tomorrow missing baseline creation
  const oldMoveToTomorrowRedux = `      setModule('timeflow', current => {
        const revisions = current.planRevisions || []
        const newRevision = {
          id: uuid(),
          date: tomorrowStr,
          parentRevisionId: [...revisions].filter(r => r.date === tomorrowStr).pop()?.id || null,
          createdAt: updatedAt,
          reason: 'Displaced activity moved from ' + selectedDate,
          slots: [...destPlans, { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd }].map(s => structuredClone(s))
        }
        return {
          ...current,
          plans: [...(current.plans || []), { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }],
          planRevisions: [...revisions, newRevision],
          displacedDecisions: [...(current.displacedDecisions || []), { id: uuid(), sourceSlotId: d.sourceSlotId, status: 'moved', affectedMinutes: affectedMins, destinationDate: tomorrowStr, destinationSlotId: newSlotId, date: updatedAt }]
        }
      })`;
      
  const oldMoveToTomorrowRedux2 = `      setModule('timeflow', current => {
        const revisions = current.planRevisions || []
        const newRevision = {
          id: uuid(),
          date: tomorrowStr,
          parentRevisionId: [...revisions].filter(r => r.date === tomorrowStr).pop()?.id || null,
          createdAt: updatedAt,
          reason: 'Displaced activity moved from ' + selectedDate,
          slots: [...destPlans, { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }].map(s => structuredClone(s))
        }
        return {
          ...current,
          plans: [...(current.plans || []), { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }],
          planRevisions: [...revisions, newRevision],
          displacedDecisions: [...(current.displacedDecisions || []), { id: uuid(), sourceSlotId: d.sourceSlotId, status: 'moved', affectedMinutes: affectedMins, destinationDate: tomorrowStr, destinationSlotId: newSlotId, date: updatedAt }]
        }
      })`;

  const newMoveToTomorrowRedux = `      setModule('timeflow', current => {
        const destPlans = (current.plans || []).filter(p => p.date === tomorrowStr)
        const baselines = current.planBaselines || []
        let newBaselines = [...baselines]
        if (!baselines.find(b => b.date === tomorrowStr) && destPlans.length > 0) {
           newBaselines.push({ id: uuid(), date: tomorrowStr, timezone: slot.timezone || 'Asia/Kolkata', capturedAt: updatedAt, origin: 'existing-plan-snapshot', slots: structuredClone(destPlans) })
        }
        
        const revisions = current.planRevisions || []
        const newRevision = {
          id: uuid(),
          date: tomorrowStr,
          parentRevisionId: [...revisions].filter(r => r.date === tomorrowStr).pop()?.id || null,
          createdAt: updatedAt,
          reason: 'Displaced activity moved from ' + selectedDate,
          slots: [...destPlans, { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }].map(s => structuredClone(s))
        }
        return {
          ...current,
          planBaselines: newBaselines,
          plans: [...(current.plans || []), { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }],
          planRevisions: [...revisions, newRevision],
          displacedDecisions: [...(current.displacedDecisions || []), { id: uuid(), sourceSlotId: d.sourceSlotId, status: 'moved', affectedMinutes: affectedMins, destinationDate: tomorrowStr, destinationSlotId: newSlotId, date: updatedAt }]
        }
      })`;

  if (c.includes(oldMoveToTomorrowRedux2)) {
    c = c.replace(oldMoveToTomorrowRedux2, newMoveToTomorrowRedux);
    console.log('TimeFlow Fix 3 (Baseline creation on move to tomorrow) applied.');
  } else if (c.includes(oldMoveToTomorrowRedux)) {
    c = c.replace(oldMoveToTomorrowRedux, newMoveToTomorrowRedux);
    console.log('TimeFlow Fix 3 (Baseline creation on move to tomorrow) applied.');
  }

  // Feature pending: Reschedule today modal hook
  const oldRescheduleAlert = `onClick={() => alert('Reschedule today modal would open here')}`;
  const newRescheduleBtn = `onClick={() => {
                            dispatchDecision(d.sourceSlotId, 'rescheduled')
                            const editBtn = Array.from(document.querySelectorAll('[data-edit-action]')).find(b => b.textContent.includes('Edit plan'))
                            if(editBtn) editBtn.click()
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}`;
  if (c.includes(oldRescheduleAlert)) {
    c = c.replace(oldRescheduleAlert, newRescheduleBtn);
    console.log('TimeFlow Feature Pending (Reschedule today hook) applied.');
  }

  fs.writeFileSync(path, c);
}

fixDayPlanner();
fixTimeFlow();
