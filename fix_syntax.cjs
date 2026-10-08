const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const badSyntax = `              calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
            }))],
          }`;

const goodSyntax = `              calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],
          }`;

if (c.includes(badSyntax)) {
  c = c.replace(badSyntax, goodSyntax);
  fs.writeFileSync(path, c);
  console.log('Fixed syntax error in DayPlanner.jsx');
} else {
  // Try CRLF
  const badSyntaxAlt = `              calendarQueue: [...(current.calendarQueue || []), ...removed.map(p => ({ id: uuid(), slotId: p.calendarEventKey || p.id, updatedAt }))],\r\n            }))],\r\n          }`;
  if (c.includes(badSyntaxAlt)) {
    c = c.replace(badSyntaxAlt, goodSyntax);
    fs.writeFileSync(path, c);
    console.log('Fixed syntax error in DayPlanner.jsx (CRLF)');
  }
}
