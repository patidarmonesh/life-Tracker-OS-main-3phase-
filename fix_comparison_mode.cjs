const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Remove useState for comparisonMode and use Redux
const oldState = `  const [comparisonMode, setComparisonMode] = useState('current')`;
const newState = `  const comparisonMode = state.timeflow?.comparisonMode || 'current'
  const setComparisonMode = (mode) => setModule('timeflow', current => ({ ...current, comparisonMode: mode }))`;
if (c.includes(oldState)) {
  c = c.replace(oldState, newState);
  console.log('Replaced useState with Redux for comparisonMode');
} else {
  console.log('useState comparisonMode not found. Already fixed?');
}

// 2. Fix the PlanVsActual prop to use referencePlans instead of plans
const oldChart = `<PlanVsActual 
          plans={plans} 
          entries={entries} nowMin={nowMin} 
        />`;
const newChart = `<PlanVsActual 
          plans={referencePlans} 
          entries={entries} nowMin={nowMin} 
        />`;
if (c.includes(oldChart)) {
  c = c.replace(oldChart, newChart);
  console.log('Replaced plans={plans} with plans={referencePlans} in PlanVsActual');
}

// 3. Insert the Comparison Mode Selector UI right above the chart
// and the Restore Revision button.
const oldUI = `    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
    {plans.length > 0 && <>`;
const newUI = `    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
    {plans.length > 0 && <>
      {baseline && (
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
           <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
             Compare against: 
             <select style={{...input, width: 'auto', padding: '4px 8px'}} value={comparisonMode} onChange={e => setComparisonMode(e.target.value)}>
               <option value="current">Current plan</option>
               <option value="original">Original plan</option>
             </select>
           </label>
           {comparisonMode === 'original' && (
             <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => {
                if(confirm('Overwrite your current plan with the original baseline?')) {
                  const updatedAt = new Date().toISOString()
                  const restoredSlots = baseline.slots.map(s => ({ ...s, id: uuid(), calendarEventKey: uuid(), updatedAt, createdAt: updatedAt }))
                  setModule('timeflow', current => ({
                    ...current,
                    comparisonMode: 'current',
                    plans: [...(current.plans || []).filter(p => p.date !== date), ...restoredSlots]
                  }))
                }
             }}>Restore Original</Button>
           )}
         </div>
      )}`;
if (c.includes(oldUI)) {
  c = c.replace(oldUI, newUI);
  console.log('Inserted Comparison Selector UI and Restore button');
}

fs.writeFileSync(path, c);
console.log('Fixes applied to DayPlanner.jsx');
