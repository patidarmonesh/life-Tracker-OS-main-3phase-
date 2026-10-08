const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const oldReturn = `        return { ...current,
            planBaselines: newBaselines,
            planRevisions: [...revisions, newRevision],
            plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],
            calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
          }`;

const newReturn = `        const pendingId = current.pendingRescheduleSlotId;
          const newDecisions = [...(current.displacedDecisions || [])];
          if (pendingId) {
             newDecisions.push({ id: uuid(), sourceSlotId: pendingId, status: 'rescheduled', date: updatedAt });
          }
          return { ...current,
            pendingRescheduleSlotId: null,
            displacedDecisions: newDecisions,
            planBaselines: newBaselines,
            planRevisions: [...revisions, newRevision],
            plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],
            calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
          }`;

if (c.includes(oldReturn)) {
  c = c.replace(oldReturn, newReturn);
  fs.writeFileSync(path, c);
  console.log('DayPlanner Fix 3a applied.');
} else {
  // If the new lines are mixed with CR LF:
  const altOldReturn = `        return { ...current,\r\n            planBaselines: newBaselines,\r\n            planRevisions: [...revisions, newRevision],\r\n            plans: [...(current.plans || []).filter(p => p.date !== draftDate), ...finalSlots],\r\n            calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],\r\n          }`;
  if (c.includes(altOldReturn)) {
     c = c.replace(altOldReturn, newReturn);
     fs.writeFileSync(path, c);
     console.log('DayPlanner Fix 3a applied (CRLF).');
  } else {
     console.log('Still could not find the return statement.');
  }
}
