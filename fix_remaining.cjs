const fs = require('fs');

function fixDayPlanner() {
  const path = 'src/components/ui/DayPlanner.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix 1: generateActuals missed-only logic
  const p1 = c.indexOf(`validateSlots(result.actuals.filter(a => a.planOutcome !== 'missed'))`);
  const p2 = c.indexOf(`const mapped = result.actuals.map(act => ({`);
  if (p1 !== -1 && p2 !== -1) {
    const newBlock = `const nonMissedGen = result.actuals.filter(a => a.planOutcome !== 'missed')
        if (nonMissedGen.length > 0) {
           validateSlots(nonMissedGen)
           if (nonMissedGen.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), nowMin))) throw new Error('Actual diary entries cannot extend into future time.')
        } else if (result.actuals.length === 0) {
           throw new Error('Add at least one activity to log.')
        }
        const missedGen = result.actuals.filter(a => a.planOutcome === 'missed')
        for (const m of missedGen) {
           if (!m.start || !m.end || timeMinutes(m.start) >= timeMinutes(m.end)) throw new Error('Invalid times for missed activity.')
        }
        
        `;
    c = c.substring(0, p1) + newBlock + c.substring(p2);
    console.log('DayPlanner Fix 1 (Missed-only validation in generateActuals) applied.');
  }

  // Fix 3 part a: savePlan clears pendingRescheduleSlotId and persists decision
  const oldReturn = `return {
            ...current,
            comparisonMode: 'current',
            planBaselines: newBaselines,
            planRevisions: [...revisions, newRevision],
            plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],
            calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))]
          }`;
  const newReturn = `const pendingId = current.pendingRescheduleSlotId;
          const newDecisions = [...(current.displacedDecisions || [])];
          if (pendingId) {
             newDecisions.push({ id: uuid(), sourceSlotId: pendingId, status: 'rescheduled', date: updatedAt });
          }
          return {
            ...current,
            pendingRescheduleSlotId: null,
            displacedDecisions: newDecisions,
            comparisonMode: 'current',
            planBaselines: newBaselines,
            planRevisions: [...revisions, newRevision],
            plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],
            calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))]
          }`;
  if (c.includes(oldReturn)) {
    c = c.replace(oldReturn, newReturn);
    console.log('DayPlanner Fix 3a (savePlan handles pending reschedule) applied.');
  } else {
    // If exact whitespace didn't match
    const returnIdx = c.indexOf(`return {
            ...current,
            comparisonMode: 'current',`);
    if (returnIdx !== -1) {
      c = c.substring(0, returnIdx) + newReturn + c.substring(returnIdx + oldReturn.length);
      console.log('DayPlanner Fix 3a (savePlan handles pending reschedule) applied via index.');
    } else {
      console.log('Could not find oldReturn in DayPlanner.jsx');
    }
  }

  // Fix 3 part c: Modal onClose clears pendingRescheduleSlotId
  const oldModal = `<Modal isOpen={open} onClose={() => { if (!busy) setOpen(false) }} title={\`Plan your day A \${draftDate}\`}>`;
  const oldModalAlt = `<Modal isOpen={open} onClose={() => { if (!busy) setOpen(false) }} title={\`Plan your day · \${draftDate}\`}>`;
  const oldModalAlt2 = c.match(/<Modal isOpen=\{open\} onClose=\{\(\) => \{ if \(!busy\) setOpen\(false\) \}\} title=\{`Plan your day.*`\}>/);
  
  const newModal = `<Modal isOpen={open} onClose={() => { if (!busy) { setOpen(false); if (state.timeflow?.pendingRescheduleSlotId) { setModule('timeflow', current => ({ ...current, pendingRescheduleSlotId: null })); } } }} title={\`Plan your day · \${draftDate}\`}>`;
  if (oldModalAlt2) {
    c = c.replace(oldModalAlt2[0], newModal);
    console.log('DayPlanner Fix 3c (Modal onClose clears pending reschedule) applied.');
  }

  fs.writeFileSync(path, c);
}

function fixTimeFlow() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix 2: Empty tomorrow day par baseline missing hai
  const oldTomorrowBaseline = `if (!baselines.find(b => b.date === tomorrowStr) && destPlans.length > 0) {
           newBaselines.push({ id: uuid(), date: tomorrowStr, timezone: slot.timezone || 'Asia/Kolkata', capturedAt: updatedAt, origin: 'existing-plan-snapshot', slots: structuredClone(destPlans) })
        }`;
  const newTomorrowBaseline = `if (!baselines.find(b => b.date === tomorrowStr)) {
           const isFirstSave = destPlans.length === 0;
           const newTomorrowSlot = { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt };
           const baselineSlots = isFirstSave ? [newTomorrowSlot] : structuredClone(destPlans);
           newBaselines.push({ id: uuid(), date: tomorrowStr, timezone: slot.timezone || 'Asia/Kolkata', capturedAt: updatedAt, origin: isFirstSave ? 'first-save' : 'existing-plan-snapshot', slots: baselineSlots })
        }`;
  if (c.includes(oldTomorrowBaseline)) {
    c = c.replace(oldTomorrowBaseline, newTomorrowBaseline);
    console.log('TimeFlow Fix 2 (Empty tomorrow baseline) applied.');
  }

  // Fix 3 part b: Reschedule button only sets pending ID
  const oldRescheduleBtn = `onClick={() => {
                            dispatchDecision(d.sourceSlotId, 'rescheduled')
                            const editBtn = Array.from(document.querySelectorAll('[data-edit-action]')).find(b => b.textContent.includes('Edit plan'))
                            if(editBtn) editBtn.click()
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}`;
  const newRescheduleBtn = `onClick={() => {
                            setModule('timeflow', current => ({ ...current, pendingRescheduleSlotId: d.sourceSlotId }))
                            const editBtn = Array.from(document.querySelectorAll('[data-edit-action]')).find(b => b.textContent.includes('Edit plan'))
                            if(editBtn) editBtn.click()
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}`;
  if (c.includes(oldRescheduleBtn)) {
    c = c.replace(oldRescheduleBtn, newRescheduleBtn);
    console.log('TimeFlow Fix 3b (Reschedule sets pending ID) applied.');
  }

  fs.writeFileSync(path, c);
}

fixDayPlanner();
fixTimeFlow();
