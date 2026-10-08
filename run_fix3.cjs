const fs = require('fs');
const path = 'src/utils/planning.js';
let content = fs.readFileSync(path, 'utf8');

// Use simple replacement for same logic
const target = /const same = a && \(\(p\.activityId && a\.activityId && p\.activityId === a\.activityId\) \|\| \(p\.category && a\.category \? p\.category === a\.category : a\.planSlotId === p\.id && a\.planOutcome === 'followed'\)\)/g;
const fallbackTarget = /const same = a && \(p\.category && a\.category \? p\.category === a\.category : a\.planSlotId === p\.id && a\.planOutcome === 'followed'\)/g;

const repl = `const same = a && (p.activityId && a.activityId ? p.activityId === a.activityId : p.category && a.category ? p.category === a.category : a.planSlotId === p.id && a.planOutcome === 'followed')`;

if (target.test(content)) {
    content = content.replace(target, repl);
} else if (fallbackTarget.test(content)) {
    content = content.replace(fallbackTarget, repl);
}
fs.writeFileSync(path, content);
console.log('Fix 3 applied: Activity matching logic fixed');
