const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states
const stateTarget = `  const [draft, setDraft] = useState([])`;
const stateRepl = `  const [draft, setDraft] = useState([])
  const [actualDraft, setActualDraft] = useState(null)
  const [comparisonMode, setComparisonMode] = useState('current')`;
if (content.includes(stateTarget)) content = content.replace(stateTarget, stateRepl);

// 2. Setup referencePlans and comparison
const compTarget = `  const comparison = planComparison(plans, entries, nowMin)`;
const compRepl = `  const baselines = state.timeflow?.planBaselines || []
  const baseline = baselines.find(b => b.date === date)
  const referencePlans = comparisonMode === 'original' && baseline ? baseline.slots : plans
  const comparison = planComparison(referencePlans, entries, nowMin)`;
if (content.includes(compTarget)) content = content.replace(compTarget, compRepl);

// 3. Render comparison toggle
const planVsActualTarget = `<PlanVsActual 
          plans={plans} 
          entries={entries.filter(e => plans.some(p => p.id === e.planSlotId))} 
        />`;
const planVsActualRepl = `{baseline && (
           <div style={{ marginBottom: 12, display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>Compare against:</span>
              <label style={{ display: 'flex', gap: 4 }}><input type="radio" name="comp" checked={comparisonMode === 'original'} onChange={() => setComparisonMode('original')} /> Original plan</label>
              <label style={{ display: 'flex', gap: 4 }}><input type="radio" name="comp" checked={comparisonMode === 'current'} onChange={() => setComparisonMode('current')} /> Current plan</label>
           </div>
        )}
        <PlanVsActual 
          plans={referencePlans} 
          entries={entries.filter(e => referencePlans.some(p => p.id === e.planSlotId))} 
        />`;
if (content.includes(planVsActualTarget)) content = content.replace(planVsActualTarget, planVsActualRepl);

// 4. Update savePlan
const savePlanTarget = `setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === draftDate)
        const kept = new Set(slots.map(s => s.id))
        const removed = old.filter(p => (!kept.has(p.id) || !calendarEnabled) && p.calendarEnabled)
        return { ...current,
          plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...slots.map(s => ({ ...s, name: s.name.trim(), date: draftDate, timezone, calendarEnabled, calendarEventKey: calendarEnabled && old.find(p => p.id === s.id)?.calendarEnabled === false ? uuid() : s.calendarEventKey || s.id, reminderMinutes: reminder, updatedAt, createdAt: s.createdAt || updatedAt }))],
          calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
        }
      })`;
const savePlanRepl = `setModule('timeflow', current => {
        const old = (current.plans || []).filter(p => p.date === draftDate)
        const baselines = current.planBaselines || []
        const revisions = current.planRevisions || []
        
        let newBaselines = [...baselines]
        let existingBaseline = baselines.find(b => b.date === draftDate)
        
        const finalSlots = slots.map(s => ({ ...s, name: s.name.trim(), date: draftDate, timezone, calendarEnabled, calendarEventKey: calendarEnabled && old.find(p => p.id === s.id)?.calendarEnabled === false ? uuid() : s.calendarEventKey || s.id, reminderMinutes: reminder, updatedAt, createdAt: s.createdAt || updatedAt }))

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
      })`;
if (content.includes(savePlanTarget)) content = content.replace(savePlanTarget, savePlanRepl);

fs.writeFileSync(path, content);
console.log('DayPlanner baselines injected successfully');
