const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const p1 = c.indexOf('const kept = new Set(slots.map(s => s.id))');
if (p1 !== -1) {
  const p2 = c.indexOf('return {', p1);
  const p3 = c.indexOf('}', p2);
  
  if (p2 !== -1 && p3 !== -1) {
    const oldBlock = c.substring(p2, p3 + 1);
    
    const newBlock = `const pendingId = current.pendingRescheduleSlotId;
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
          
    c = c.substring(0, p2) + newBlock + c.substring(p3 + 1);
    fs.writeFileSync(path, c);
    console.log('DayPlanner Fix 3a applied via string index.');
  }
}
