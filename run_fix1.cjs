const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { summarizeDay, durationMinutes as slotDuration, timeMinutes } from '../utils/planning'",
  "import { summarizeDay, durationMinutes as slotDuration, timeMinutes, resolveMinutes } from '../utils/planning'"
);

const targetRegex = /const cumulativeData = useMemo\(\(\) => \{[\s\S]*?\}, \[timeSummary, selectedDate, today, nowMinute\]\);/;
const repl = `const cumulativeData = useMemo(() => {
    let pt = 0, at = 0;
    const data = [{ time: '00:00', planned: 0, actual: 0 }];
    const baseline = (state.timeflow?.planBaselines || []).find(b => b.date === selectedDate);
    const referencePlans = (state.timeflow?.comparisonMode === 'original' && baseline) ? baseline.slots : allPlans;
    const planMins = resolveMinutes(referencePlans).mins;
    const actualMins = resolveMinutes(allEntries.filter(e => e.date === selectedDate)).mins;

    for (let i = 0; i < 1440; i++) {
       if (planMins[i] && planMins[i].category === 'Study' && !planMins[i].isWaste) pt++;
       if (actualMins[i] && actualMins[i].category === 'Study' && !actualMins[i].isWaste) at++;
       if ((i + 1) % 15 === 0 || i === 1439 || (selectedDate === today && i === nowMinute)) {
         data.push({
           time: \`\${Math.floor((i+1)/60).toString().padStart(2,'0')}:\${((i+1)%60).toString().padStart(2,'0')}\`,
           planned: pt,
           actual: (selectedDate < today || (selectedDate === today && i <= nowMinute)) ? at : null
         });
       }
    }
    return data;
}, [selectedDate, today, nowMinute, allPlans, allEntries, state.timeflow?.planBaselines, state.timeflow?.comparisonMode]);`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, repl);
    fs.writeFileSync(path, content);
    console.log('Fix 1 applied: cumulativeData fixed');
} else {
    console.log('Fix 1 target not found');
}
