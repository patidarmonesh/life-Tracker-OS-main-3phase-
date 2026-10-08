const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('async function generateActuals() {');
const endIdx = content.indexOf('  function updateSlot', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const original = content.substring(startIdx, endIdx);
    const repl = `async function generateActuals() {
    setBusy(true); setError('')
    try {
      const result = await draftActualLogs({ text, image: photo, date: draftDate, categories, tentativePlans: plans })
      
      validateSlots(result.actuals.filter(a => a.planOutcome !== 'missed'))
      if (result.actuals.some(a => a.planOutcome !== 'missed' && timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), nowMin))) throw new Error('Actual diary entries cannot extend into future time.')
      
      const mapped = result.actuals.map(act => ({
          ...act,
          id: uuid(),
          name: act.planOutcome === 'missed' ? 'Missed' : (act.name?.trim() || act.category),
          category: act.planOutcome === 'missed' ? 'Other' : act.category,
          isWaste: act.planOutcome !== 'missed' && isWasteEntry({ ...act, isWaste: act.isWaste ?? (plans.find(p => p.id === act.planSlotId && p.category === act.category)?.isWaste || false) })
      }))
      
      setActualDraft(mapped)
      setError('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function commitActualDraft() {
     setBusy(true)
     try {
        const newEntries = []
        const sessions = []
        const updatedAt = new Date().toISOString()
        
        validateSlots(actualDraft.filter(a => a.planOutcome !== 'missed'))
        for (const act of actualDraft) {
          if (!act.start || !act.end) continue;
          
          const isStudy = act.category === 'Study' && act.planOutcome !== 'missed' && !act.isWaste
          const studySessionId = isStudy ? \`plan-study-\${act.id}\` : null
          
          newEntries.push({
            id: act.id,
            date: draftDate,
            start: act.start,
            end: act.end,
            name: act.name,
            category: act.category,
            durationMinutes: durationMinutes(act.start, act.end),
            planSlotId: act.planSlotId,
            activityId: (plans.find(p => p.id === act.planSlotId) || {}).activityId || uuid(),
            planOutcome: act.planOutcome || 'followed',
            deviationReason: act.deviationReason?.trim() || '',
            isWaste: act.isWaste,
            productivityScore: 3,
            mood: 3,
            source: 'auto-diary',
            ghost: act.planOutcome === 'missed',
            createdAt: updatedAt,
            updatedAt,
            studySessionId
          })
          
          if (isStudy) {
            sessions.push({
              id: studySessionId,
              date: draftDate,
              subject: 'Other',
              topic: act.name,
              durationMinutes: durationMinutes(act.start, act.end),
              focusType: 'Deep Focus',
              rating: 3,
              notes: act.deviationReason?.trim() || '',
              source: 'auto-diary',
              createdAt: updatedAt,
              updatedAt
            })
          }
        }
        
        setModule('timeflow', current => ({
          ...current,
          entries: [...(current.entries || []).filter(e => e.date !== draftDate || e.source !== 'auto-diary'), ...newEntries]
        }))
        
        if (sessions.length) {
          setModule('study', current => {
             const oldAutoSessions = new Set((current.sessions || []).filter(s => s.date === draftDate && s.source === 'auto-diary').map(s => s.id))
             return {
               ...current,
               sessions: [...(current.sessions || []).filter(s => !oldAutoSessions.has(s.id)), ...sessions]
             }
          })
        }
        
        setActualsOpen(false)
        setActualDraft(null)
        setText('')
        setPhoto(null)
        showToast('Actuals saved!', 'success')
     } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

`;
    content = content.replace(original, repl);
    fs.writeFileSync(path, content);
    console.log('Fix 5 applied completely');
} else {
    console.log('Fix 5 bounds not found');
}
