const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const blankRegex = /const blank = \(\) => \(\{ id: uuid\(\), name: '', start: '09:00', end: '10:00', category: 'Study' \}\)/;
if (blankRegex.test(content)) {
    content = content.replace(blankRegex, `const blank = () => ({ id: uuid(), activityId: uuid(), name: '', start: '09:00', end: '10:00', category: 'Study' })`);
}

// Inherit activityId from plans inside commitActualDraft
const actDraftRegex = /planSlotId: act\.planSlotId,/g;
content = content.replace(actDraftRegex, `planSlotId: act.planSlotId,\n            activityId: (plans.find(p => p.id === act.planSlotId) || {}).activityId || uuid(),`);

// Also inherit it in openCheck ? Wait, check-ins are handled in DayPlanner.jsx `saveCheck` or similar? 
// No, the user can manually check-in via UI. Let's see where manual actuals are saved.

fs.writeFileSync(path, content);
console.log('Fix 3 applied: activityId assigned');
