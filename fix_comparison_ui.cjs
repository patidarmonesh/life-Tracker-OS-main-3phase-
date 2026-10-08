const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const target = `    {isOpen && <div id="day-plan-body" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
    {plans.length > 0 && <>`;

const repl = `    {isOpen && <div id="day-plan-body" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0' }}>Diary photo or typed notes → editable plan → Calendar reminders → actual check-ins.</p>
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

// Since line endings can be problematic, use string replace carefully
const p1 = c.indexOf(`    {isOpen && <div id="day-plan-body"`);
const p2 = c.indexOf(`    {plans.length > 0 && <>`, p1);

if (p1 !== -1 && p2 !== -1) {
  const oldStr = c.substring(p1, p2 + `    {plans.length > 0 && <>`.length);
  c = c.replace(oldStr, repl);
  
  // also fix PlanVsActual inside DayPlanner
  const oldChart = `<PlanVsActual \r\n          plans={plans} \r\n          entries={entries} nowMin={nowMin} \r\n        />`;
  const oldChart2 = `<PlanVsActual \n          plans={plans} \n          entries={entries} nowMin={nowMin} \n        />`;
  if (c.includes(oldChart)) c = c.replace(oldChart, oldChart.replace('plans={plans}', 'plans={referencePlans}'));
  if (c.includes(oldChart2)) c = c.replace(oldChart2, oldChart2.replace('plans={plans}', 'plans={referencePlans}'));
  
  fs.writeFileSync(path, c);
  console.log('UI injected successfully.');
} else {
  console.log('Could not find markers');
}
