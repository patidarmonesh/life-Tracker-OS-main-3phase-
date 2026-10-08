const fs = require('fs');

const path = 'src/pages/TimeFlow.jsx';
let c = fs.readFileSync(path, 'utf8');

const p1 = c.indexOf(`      setModule('timeflow', current => {`);
// Find the exact one inside moveTomorrow
const p0 = c.indexOf(`const moveTomorrow =`);
const actualP1 = c.indexOf(`setModule('timeflow', current => {`, p0);
const actualP2 = c.indexOf(`})`, actualP1) + 2;

if (actualP1 !== -1 && actualP2 !== -1) {
  const newBlock = `setModule('timeflow', current => {
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
      
  c = c.substring(0, actualP1) + newBlock + c.substring(actualP2);
  fs.writeFileSync(path, c);
  console.log('TimeFlow Fix 3 (Baseline creation on move to tomorrow) applied using indices.');
}

