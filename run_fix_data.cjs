const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `const donutSorted = [...donutData].sort((a, b) => b.value - a.value).map(d => ({ ...d, fill: CATEGORY_COLORS[d.name] || categoryColor(d.name) }))`;

const repl = `const donutSorted = [...donutData].sort((a, b) => b.value - a.value).map(d => ({ ...d, fill: CATEGORY_COLORS[d.name] || categoryColor(d.name) }))
  
  const cumulativeData = useMemo(() => {
    let pt = 0, at = 0;
    const data = [];
    const actualMins = timeSummary.minuteStates.map(m => m ? m.actual : null);
    const planMins = timeSummary.minuteStates.map(m => m ? m.plan : null);

    for (let i = 0; i < 1440; i++) {
       if (planMins[i] && planMins[i].category === 'Study' && !planMins[i].isWaste) pt++;
       if (actualMins[i] && actualMins[i].category === 'Study' && !actualMins[i].isWaste) at++;
       if (i % 15 === 0) {
         data.push({
           time: \`\${Math.floor(i/60).toString().padStart(2,'0')}:\${(i%60).toString().padStart(2,'0')}\`,
           planned: pt,
           actual: (selectedDate < today || (selectedDate === today && i <= nowMinute)) ? at : null
         });
       }
    }
    return data;
  }, [timeSummary, selectedDate, today, nowMinute]);`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync(path, content);
    console.log('Cumulative Data injected');
}
