const fs = require('fs');
const path = 'src/utils/planning.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /const same = a && \(p\.category && a\.category \? p\.category === a\.category : a\.planSlotId === p\.id && a\.planOutcome === 'followed'\)/g;
content = content.replace(regex, "const same = a && ((p.activityId && a.activityId && p.activityId === a.activityId) || (p.category && a.category ? p.category === a.category : a.planSlotId === p.id && a.planOutcome === 'followed'))");

fs.writeFileSync(path, content);
console.log('activityId logic updated');
