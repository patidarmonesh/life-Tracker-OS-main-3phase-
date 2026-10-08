const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `    const timeSummary = useMemo(() => summarizeDay(allEntries, selectedDate, 1440, allPlans), [allEntries, selectedDate, allPlans])`;
const repl = `    const timeSummary = useMemo(() => summarizeDay(allEntries, selectedDate, selectedDate === today ? nowMinute : 1440, allPlans), [allEntries, selectedDate, allPlans, today, nowMinute])`;

content = content.replace(target, repl);
fs.writeFileSync(path, content);
console.log('Fixed TimeFlow summary nowMin');
