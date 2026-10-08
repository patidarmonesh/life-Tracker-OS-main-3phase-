const fs = require('fs');
const path = 'src/utils/planning.js';
let content = fs.readFileSync(path, 'utf8');

const target = `return { planned, followed, changed, pending, reviewed, adherence: reviewed ? Math.round(100 * followed / reviewed) : null, rows, minuteStates }`;

const repl = `const displaced = slots.map((s, idx) => {
      const row = rows[idx];
      if (row.changed > 0 && timeMinutes(s.start) < cutoff) {
          // If the slot is in the past and has changed minutes, it's partially or fully displaced
          return {
             id: 'disp-' + s.id,
             date: s.date,
             sourceSlotId: s.id,
             activityId: s.activityId || s.id,
             name: s.name,
             affectedMinutes: row.changed,
             status: 'suggested'
          };
      }
      return null;
    }).filter(Boolean);

    return { planned, followed, changed, pending, reviewed, adherence: reviewed ? Math.round(100 * followed / reviewed) : null, rows, minuteStates, displaced }`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync(path, content);
    console.log('planning.js displaced logic injected');
} else {
    console.log('Target not found');
}
