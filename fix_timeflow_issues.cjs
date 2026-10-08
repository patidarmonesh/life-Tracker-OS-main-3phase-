const fs = require('fs');

function fix1_TimeFlow() {
  const path = 'src/pages/TimeFlow.jsx';
  let c = fs.readFileSync(path, 'utf8');
  let changed = false;

  // 1. "Move to tomorrow" fix
  const oldMove = `    const tomorrow = new Date(selectedDate + 'T00:00:00')
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const newSlotId = uuid()
    const newActivityId = uuid()
    const affectedMins = d.affectedMinutes || slotDuration(slot.start, slot.end)`;
    
  const newMove = `    const tomorrow = new Date(\`\${selectedDate}T00:00:00Z\`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const newSlotId = uuid()
    const newActivityId = uuid()
    const affectedMins = d.affectedMinutes || slotDuration(slot.start, slot.end)
    const startMin = timeMinutes(slot.start)
    const endMin = startMin + affectedMins
    const adjustedEnd = \`\${Math.floor(endMin / 60).toString().padStart(2, '0')}:\${(endMin % 60).toString().padStart(2, '0')}\``;

  if (c.includes(oldMove)) {
    c = c.replace(oldMove, newMove);
    
    // Now replace the slot insertion to use adjustedEnd
    const oldSlot = `[...destPlans, { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr }]`;
    const newSlot = `[...destPlans, { ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd }]`;
    
    const oldSlot2 = `{ ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }`;
    const newSlot2 = `{ ...slot, id: newSlotId, activityId: newActivityId, date: tomorrowStr, end: adjustedEnd, calendarEventKey: newSlotId, createdAt: updatedAt, updatedAt }`;
    
    c = c.replace(oldSlot, newSlot);
    c = c.replace(oldSlot2, newSlot2);
    
    changed = true;
    console.log('TimeFlow Fix 1 (Move to tomorrow) applied.');
  }

  // 2. Tray Ghost filter fix
  const oldComparison = `const comparisonEntries = useMemo(() => normalizeDay(allEntries, selectedDate).filter(e => !e.ghost), [allEntries, selectedDate])`;
  const newComparison = `const comparisonEntries = useMemo(() => normalizeDay(allEntries, selectedDate), [allEntries, selectedDate])`;
  if (c.includes(oldComparison)) {
    c = c.replace(oldComparison, newComparison);
    changed = true;
    console.log('TimeFlow Fix 5 (Tray missed filter) applied.');
  }

  // 3. Cumulative Graph 00:00 / 24:00 and boundary counts
  const oldGraphStart = `  const cumulativeData = useMemo(() => {
    let pt = 0, at = 0;
    const data = [{ time: '00:00', planned: 0, actual: 0 }];
    const baseline = (state.timeflow?.planBaselines || []).find(b => b.date === selectedDate);
    const datePlans = allPlans.filter(p => p.date === selectedDate);
    const referencePlans = (state.timeflow?.comparisonMode === 'original' && baseline) ? baseline.slots : datePlans;
    const planMins = resolveMinutes(referencePlans).mins;
    const actualMins = resolveMinutes(normalizeDay(allEntries, selectedDate)).mins;

    for (let i = 0; i < 1440; i++) {
       if (planMins[i] && planMins[i].category === 'Study' && !planMins[i].isWaste) pt++;
       if (actualMins[i] && actualMins[i].category === 'Study' && !actualMins[i].isWaste) at++;
       if (i % 15 === 0 || i === 1439 || (selectedDate === today && i === nowMinute)) {
         const h = Math.floor(i / 60).toString().padStart(2, '0');
         const m = (i % 60).toString().padStart(2, '0');
         data.push({
           time: \`\${h}:\${m}\`,
           planned: pt,
           actual: (selectedDate < today || (selectedDate === today && i <= nowMinute)) ? at : null
         });
       }
    }
    return data;
}, [selectedDate, today, nowMinute, allPlans, allEntries, state.timeflow?.planBaselines, state.timeflow?.comparisonMode]);`;

  const newGraph = `  const cumulativeData = useMemo(() => {
    let pt = 0, at = 0;
    const dataMap = new Map();
    dataMap.set('00:00', { time: '00:00', planned: 0, actual: 0 });
    
    const baseline = (state.timeflow?.planBaselines || []).find(b => b.date === selectedDate);
    const datePlans = allPlans.filter(p => p.date === selectedDate);
    const referencePlans = (state.timeflow?.comparisonMode === 'original' && baseline) ? baseline.slots : datePlans;
    const planMins = resolveMinutes(referencePlans).mins;
    const actualMins = resolveMinutes(normalizeDay(allEntries, selectedDate)).mins;

    for (let i = 0; i < 1440; i++) {
       if (planMins[i] && planMins[i].category === 'Study' && !planMins[i].isWaste) pt++;
       if (actualMins[i] && actualMins[i].category === 'Study' && !actualMins[i].isWaste) at++;
       
       const t = i + 1; // boundary after processing minute i
       
       if (t % 15 === 0 || t === 1440 || (selectedDate === today && t === nowMinute)) {
         const h = Math.floor(t / 60).toString().padStart(2, '0');
         const m = (t % 60).toString().padStart(2, '0');
         const timeKey = t === 1440 ? '24:00' : \`\${h}:\${m}\`;
         
         if (!dataMap.has(timeKey)) {
             dataMap.set(timeKey, {
               time: timeKey,
               planned: pt,
               actual: (selectedDate < today || (selectedDate === today && t <= nowMinute)) ? at : null
             });
         }
       }
    }
    return Array.from(dataMap.values());
}, [selectedDate, today, nowMinute, allPlans, allEntries, state.timeflow?.planBaselines, state.timeflow?.comparisonMode]);`;

  if (c.includes('const data = [{ time: \'00:00\', planned: 0, actual: 0 }];')) {
    // We will do a generic replacement of the whole block using substring since string match might fail on newlines
    const p1 = c.indexOf('const cumulativeData = useMemo(() => {');
    const p2 = c.indexOf('}, [selectedDate, today, nowMinute, allPlans, allEntries, state.timeflow?.planBaselines, state.timeflow?.comparisonMode]);');
    if (p1 !== -1 && p2 !== -1) {
       c = c.substring(0, p1) + newGraph + c.substring(p2 + '}, [selectedDate, today, nowMinute, allPlans, allEntries, state.timeflow?.planBaselines, state.timeflow?.comparisonMode]);'.length);
       changed = true;
       console.log('TimeFlow Fix 6 (Cumulative Graph boundary counts) applied.');
    }
  }
  
  if (changed) {
    fs.writeFileSync(path, c);
    console.log('TimeFlow.jsx updated successfully.');
  } else {
    console.log('No changes applied to TimeFlow.jsx');
  }
}

fix1_TimeFlow();
