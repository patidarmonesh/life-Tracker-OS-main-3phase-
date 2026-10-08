const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const p1 = c.indexOf('calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],');

if (p1 !== -1) {
  const lineEnd = c.indexOf(']', p1 + 130);
  const nextLines = c.substring(p1, p1 + 300);
  console.log("Found at:", p1);
  console.log("Context:", nextLines);
  
  if (nextLines.includes('}))],')) {
     c = c.replace('}))],', '');
     fs.writeFileSync(path, c);
     console.log('Removed extra characters');
  }
}
