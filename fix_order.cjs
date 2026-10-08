const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

// The replacement script earlier failed because I matched LF but the file had something else or the target was wrong. Let me just do a manual string replace to move nowMinute up.
const target = `  const timeSummary = useMemo(() => summarizeDay(allEntries, selectedDate, selectedDate === today ? nowMinute : 1440, allPlans), [allEntries, selectedDate, allPlans, today, nowMinute])
  const { productiveMins, wasteMins, sleepMins, unloggedMins } = timeSummary
  const donutData = Object.entries(timeSummary.categories).map(([name, value]) => ({ name, value }))
  const donutSorted = [...donutData].sort((a, b) => b.value - a.value).map(d => ({ ...d, fill: CATEGORY_COLORS[d.name] || categoryColor(d.name) }))
  const donutTotal = donutSorted.reduce((a, d) => a + d.value, 0)
  const nowDate = new Date()
  const tzTime = new Intl.DateTimeFormat('en-US', { timeZone: state.settings?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).format(nowDate)
  const nowMinute = parseInt(tzTime.split(':')[0]) * 60 + parseInt(tzTime.split(':')[1])`;

const repl = `  const nowDate = new Date()
  const tzTime = new Intl.DateTimeFormat('en-US', { timeZone: state.settings?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).format(nowDate)
  const nowMinute = parseInt(tzTime.split(':')[0]) * 60 + parseInt(tzTime.split(':')[1])
  const timeSummary = useMemo(() => summarizeDay(allEntries, selectedDate, selectedDate === today ? nowMinute : 1440, allPlans), [allEntries, selectedDate, allPlans, today, nowMinute])
  const { productiveMins, wasteMins, sleepMins, unloggedMins } = timeSummary
  const donutData = Object.entries(timeSummary.categories).map(([name, value]) => ({ name, value }))
  const donutSorted = [...donutData].sort((a, b) => b.value - a.value).map(d => ({ ...d, fill: CATEGORY_COLORS[d.name] || categoryColor(d.name) }))
  const donutTotal = donutSorted.reduce((a, d) => a + d.value, 0)`;

// We have to ignore line endings carefully
function fixOrder() {
  let lines = content.split('\n');
  let summaryIdx = lines.findIndex(l => l.includes('const timeSummary = useMemo('));
  if (summaryIdx !== -1) {
     let dateIdx = lines.findIndex(l => l.includes('const nowDate = new Date()'));
     if (dateIdx > summaryIdx) {
        // swap block
        const dateBlock = lines.slice(dateIdx, dateIdx + 3);
        lines.splice(dateIdx, 3);
        lines.splice(summaryIdx, 0, ...dateBlock);
        fs.writeFileSync(path, lines.join('\n'));
        console.log('Moved nowMinute above timeSummary');
     } else {
        console.log('Already above');
     }
  }
}
fixOrder();
