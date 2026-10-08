const fs = require('fs');
const path = 'src/utils/planning.js';
let content = fs.readFileSync(path, 'utf8');

const target = `const same = a && (p.category && a.category ? p.category === a.category : a.planSlotId === p.id && a.planOutcome === 'followed')
      const status = a ? (same ? 'followed' : 'changed') : explicitlyMissed ? 'changed' : 'pending'`;

const repl = `const same = a && ((p.activityId && a.activityId && p.activityId === a.activityId) || (p.category && a.category ? p.category === a.category : a.planSlotId === p.id && a.planOutcome === 'followed'))
      const status = a ? (same ? 'followed' : 'changed') : explicitlyMissed ? 'changed' : 'pending'`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync(path, content);
    console.log('activityId check injected');
} else {
    console.log('target not found');
}
