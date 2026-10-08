const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /function deleteEntry\(id\) \{/;
const repl = `const dispatchDecision = (sourceSlotId, status) => {
    setModule('timeflow', current => ({
      ...current,
      displacedDecisions: [...(current.displacedDecisions || []), { sourceSlotId, status, date: new Date().toISOString() }]
    }))
  }

  const moveTomorrow = (d) => {
    const slot = allPlans.find(p => p.id === d.sourceSlotId)
    if (!slot) return
    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    
    setModule('timeflow', current => ({
      ...current,
      plans: [...(current.plans || []), { ...slot, id: slot.id + '-moved', date: tomorrowStr, calendarEventKey: slot.calendarEventKey + '-moved' }],
      displacedDecisions: [...(current.displacedDecisions || []), { sourceSlotId: d.sourceSlotId, status: 'moved', date: new Date().toISOString() }]
    }))
  }

  function deleteEntry(id) {`;

if (regex.test(content)) {
    content = content.replace(regex, repl);
    fs.writeFileSync(path, content);
    console.log('Fix 6 handlers applied');
} else {
    console.log('regex match failed for Fix 6 handlers');
}
