const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

// Inject planComparison import if not there
if (!content.includes('planComparison')) {
    content = content.replace("import { summarizeDay,", "import { summarizeDay, planComparison,");
}

// In TimeFlow.jsx, replace `timeSummary.displaced` with `comparison.displaced`
// First we need to actually run planComparison inside TimeFlow.jsx
const target = `const { productiveMins, wasteMins, sleepMins } = timeSummary`;
const repl = `const { productiveMins, wasteMins, sleepMins } = timeSummary
    const comparison = useMemo(() => planComparison(allPlans.filter(p => p.date === selectedDate), dayEntries, nowMinute), [allPlans, dayEntries, nowMinute, selectedDate])`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    content = content.replace(/timeSummary\.displaced/g, 'comparison.displaced');
    fs.writeFileSync(path, content);
    console.log('Fix 6 applied: connected displaced tray to planComparison');
} else {
    console.log('Fix 6 target not found');
}
