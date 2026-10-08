const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = /planOutcome: actualOutcome,/g;
content = content.replace(target, `planOutcome: actualOutcome,
            activityId: slot.activityId || uuid(),`);

fs.writeFileSync(path, content);
console.log('Fix 3 applied: saveCheck activityId assigned');
