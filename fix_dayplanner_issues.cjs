const fs = require('fs');

function fixDayPlanner() {
  const path = 'src/components/ui/DayPlanner.jsx';
  let c = fs.readFileSync(path, 'utf8');
  let changed = false;

  // 1. Strict Activity Identity in commitActualDraft (line ~142)
  const oldDiaryID = `activityId: (() => { const matchedPlan = plans.find(p => p.id === act.planSlotId); return (matchedPlan && matchedPlan.category === act.category && matchedPlan.activityId) ? matchedPlan.activityId : uuid(); })(),`;
  const newDiaryID = `activityId: (() => { const matchedPlan = plans.find(p => p.id === act.planSlotId); return (matchedPlan && matchedPlan.category === act.category && matchedPlan.name.trim() === act.name.trim() && matchedPlan.activityId) ? matchedPlan.activityId : uuid(); })(),`;
  if (c.includes(oldDiaryID)) {
    c = c.replace(oldDiaryID, newDiaryID);
    changed = true;
    console.log('DayPlanner Fix 4a (Diary ID stricter check) applied.');
  }

  // Strict Activity Identity in saveCheck (line ~303)
  const oldCheckID = `activityId: (category === slot.category && slot.activityId) ? slot.activityId : uuid(),`;
  const newCheckID = `activityId: (category === slot.category && name.trim() === slot.name.trim() && slot.activityId) ? slot.activityId : uuid(),`;
  if (c.includes(oldCheckID)) {
    c = c.replace(oldCheckID, newCheckID);
    changed = true;
    console.log('DayPlanner Fix 4b (Check-in ID stricter check) applied.');
  }

  // 2. Diary Import date reset (line ~355)
  const oldLogActuals = `onClick={() => { setActualsOpen(true); setText(''); setPhoto(null); setError('') }}`;
  const newLogActuals = `onClick={() => { setDraftDate(date); setActualDraft(null); setActualsOpen(true); setText(''); setPhoto(null); setError('') }}`;
  if (c.includes(oldLogActuals)) {
    c = c.replace(oldLogActuals, newLogActuals);
    changed = true;
    console.log('DayPlanner Fix 3 (Diary date reset) applied.');
  }

  // 3. Restore Original Logic (line ~375)
  // First, we add the restoreOriginalPlan function right before openCheck
  const restoreFunc = `
  function restoreOriginalPlan() {
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
  }
`;

  if (!c.includes('function restoreOriginalPlan')) {
    // Insert before openCheck
    const insertPoint = c.indexOf('  function openCheck(');
    if (insertPoint !== -1) {
      c = c.substring(0, insertPoint) + restoreFunc + c.substring(insertPoint);
      changed = true;
      console.log('DayPlanner Fix 2 (restoreOriginalPlan added).');
    }
  }

  // Now fix the onClick of Restore Original button
  const oldRestoreBtn1 = `if(confirm('Overwrite your current plan with the original baseline?')) {`;
  const p1 = c.indexOf(oldRestoreBtn1);
  if (p1 !== -1) {
    const btnEnd = c.indexOf(`}}`, p1);
    if (btnEnd !== -1) {
      // replace the whole onClick logic
      c = c.substring(0, p1) + `restoreOriginalPlan()` + c.substring(btnEnd);
      changed = true;
      console.log('DayPlanner Fix 2 (Restore Original button hooked up).');
    }
  }

  if (changed) {
    fs.writeFileSync(path, c);
    console.log('DayPlanner.jsx updated successfully.');
  } else {
    console.log('No changes applied to DayPlanner.jsx');
  }
}

fixDayPlanner();
