const fs = require('fs');

const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const p1 = c.indexOf(`const nonMissed = actualDraft.filter(a => a.planOutcome !== 'missed')`);
const p2 = c.indexOf(`for (const act of actualDraft) {`);

if (p1 !== -1 && p2 !== -1) {
  const oldBlock = c.substring(p1, p2);
  const newBlock = `if (!actualDraft || actualDraft.length === 0) throw new Error('No entries to save.')
          const nonMissed = actualDraft.filter(a => a.planOutcome !== 'missed')
          if (nonMissed.length > 0) {
            validateSlots(nonMissed)
            // Reject future end times
            if (nonMissed.some(a => timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), timeMinutes(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))))) throw new Error('Actual diary entries cannot extend into future time.')
            // Reject overlaps with existing manual actuals
            const retained = entries.filter(e => e.source !== 'auto-diary' && !e.ghost && e.planOutcome !== 'missed')
            const combined = [...retained, ...nonMissed]
            validateSlots(combined)
          }
          `;
  c = c.substring(0, p1) + newBlock + c.substring(p2);
  fs.writeFileSync(path, c);
  console.log('DayPlanner Fix 4 (Missed-only diary import validation) applied using indices.');
}
