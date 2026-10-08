const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('function savePlan() {');
const endString = '  function openCheck';
const endIdx = content.indexOf(endString, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const original = content.substring(startIdx, endIdx);
    const repl = `function savePlan() {
    try {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(draftDate) || new Date(\`\${draftDate}T00:00:00Z\`).toISOString().slice(0, 10) !== draftDate) throw new Error('Choose a valid plan date.')
      let slots = draft.length ? validateSlots(draft) : []
      const updatedAt = new Date().toISOString()
      setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === draftDate)
        const baselines = current.planBaselines || []
        const revisions = current.planRevisions || []
        
        let newBaselines = [...baselines]
        let existingBaseline = baselines.find(b => b.date === draftDate)
        
        const finalSlots = slots.map(s => ({ ...s, activityId: s.activityId || uuid(), name: s.name.trim(), date: draftDate, timezone, calendarEnabled, calendarEventKey: calendarEnabled && old.find(p => p.id === s.id)?.calendarEnabled === false ? uuid() : s.calendarEventKey || s.id, reminderMinutes: reminder, updatedAt, createdAt: s.createdAt || updatedAt }))

        if (!existingBaseline && finalSlots.length > 0) {
          const baselineSlots = old.length > 0 ? structuredClone(old) : structuredClone(finalSlots)
          existingBaseline = {
            id: uuid(),
            date: draftDate,
            timezone,
            capturedAt: updatedAt,
            origin: old.length > 0 ? 'existing-plan-snapshot' : 'first-save',
            slots: baselineSlots
          }
          newBaselines.push(existingBaseline)
        }

        const previousRevisionId = [...revisions].filter(r => r.date === draftDate).pop()?.id || null
        const newRevision = {
           id: uuid(),
           date: draftDate,
           parentRevisionId: previousRevisionId,
           createdAt: updatedAt,
           reason: "Plan edit",
           slots: structuredClone(finalSlots)
        }

        const kept = new Set(slots.map(s => s.id))
        const removed = old.filter(p => (!kept.has(p.id) || !calendarEnabled) && p.calendarEnabled)
        return { ...current,
          planBaselines: newBaselines,
          planRevisions: [...revisions, newRevision],
          plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],
          calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
        }
      })
      setOpen(false)
      setExpanded(slots.length ? true : null)
      showToast(!slots.length ? 'Plan removed. Actual logs kept; Calendar cleanup queued.' : calendarEnabled ? 'Plan saved. Calendar sync queued.' : 'Tentative plan saved.', 'success')
    } catch (e) { setError(e.message) }
  }
`;
    content = content.replace(original, repl);
    fs.writeFileSync(path, content);
    console.log('Fix 4 applied');
} else {
    console.log('failed to find bounds for Fix 4');
}
