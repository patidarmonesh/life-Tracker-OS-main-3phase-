const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const generateTarget = `  async function generateActuals() {
    setBusy(true); setError('')
    try {
      const result = await draftActualLogs({ text, image: photo, date: draftDate, categories, tentativePlans: plans })
      
      const newEntries = []
      const sessions = []
      const updatedAt = new Date().toISOString()
      
      validateSlots(result.actuals.filter(a => a.planOutcome !== 'missed'))
      if (result.actuals.some(a => a.planOutcome !== 'missed' && timeMinutes(a.end) > dayCutoff(draftDate, getTodayDateKey(timezone), nowMin))) throw new Error('Actual diary entries cannot extend into future time.')
      for (const act of result.actuals) {
        if (!act.start || !act.end) continue;
        const actualId = uuid()
        const wasteFlag = act.planOutcome !== 'missed' && isWasteEntry({ ...act, isWaste: act.isWaste ?? (plans.find(p => p.id === act.planSlotId && p.category === act.category)?.isWaste || false) })
        const isStudy = act.category === 'Study' && act.planOutcome !== 'missed' && !wasteFlag
        const studySessionId = isStudy ? \`plan-study-\${actualId}\` : null
        
        newEntries.push({
          id: actualId,
          date: draftDate,
          start: act.start,
          end: act.end,
          name: act.planOutcome === 'missed' ? 'Missed' : (act.name?.trim() || act.category),
          category: act.planOutcome === 'missed' ? 'Other' : act.category,
          durationMinutes: durationMinutes(act.start, act.end),
          planSlotId: act.planSlotId,
          planOutcome: act.planOutcome || 'followed',
          deviationReason: act.deviationReason?.trim() || '',
          isWaste: wasteFlag,
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
            startTime: act.start,
            endTime: act.end,
            duration: durationMinutes(act.start, act.end),
            topic: act.name?.trim() || 'Study',
            quality: 3,
            focus: 3,
            flow: false,
            createdAt: updatedAt,
            updatedAt
          })
        }
      }
      
      if (!newEntries.length) throw new Error('Could not parse any clear activities.')
      
      setModule('timeflow', current => ({
        ...current,
        entries: [...(current.entries || []).filter(e => e.date !== draftDate || e.source !== 'auto-diary'), ...newEntries]
      }))
      
      if (sessions.length) {
        setModule('study', current => {
           // Remove old sessions tied to auto-diary for this day
           const oldAutoSessions = new Set((state.timeflow?.entries || []).filter(e => e.date === draftDate && e.source === 'auto-diary' && e.studySessionId).map(e => e.studySessionId))
           return {
             ...current,
             sessions: [...(current.sessions || []).filter(s => !oldAutoSessions.has(s.id)), ...sessions]
           }
        })
      }
      
      setActualsOpen(false)
      setText('')
      setPhoto(null)
      showToast('Actuals logged!', 'success')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }`;

const generateRepl = `  async function generateActuals() {
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
              startTime: act.start,
              endTime: act.end,
              duration: durationMinutes(act.start, act.end),
              topic: act.name,
              quality: 3,
              focus: 3,
              flow: false,
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
             const oldAutoSessions = new Set((state.timeflow?.entries || []).filter(e => e.date === draftDate && e.source === 'auto-diary' && e.studySessionId).map(e => e.studySessionId))
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
  }`;

if (content.includes(generateTarget)) {
    content = content.replace(generateTarget, generateRepl);
}

// 5. Render actualDraft preview inside actualsOpen modal
const modalTarget = `        {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      </Modal>`;
const modalRepl = `        {actualDraft && (
           <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
             <h4 style={{ fontSize: 13, marginBottom: 12 }}>Preview Imports (Edit if needed)</h4>
             <div style={{ display: 'grid', gap: 12 }}>
               {actualDraft.map(act => (
                 <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <input style={input} value={act.name} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, name: e.target.value} : x))} />
                    <select style={input} value={act.category} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, category: e.target.value} : x))}>
                       {[...new Set([...categories, act.category])].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="time" style={input} value={act.start} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, start: e.target.value} : x))} />
                    <input type="time" style={input} value={act.end} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, end: e.target.value} : x))} />
                    <label style={{ gridColumn: '1 / -1', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                       <input type="checkbox" checked={act.isWaste} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, isWaste: e.target.checked} : x))} /> Mark as Waste
                    </label>
                 </div>
               ))}
             </div>
             <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
               <Button onClick={commitActualDraft} disabled={busy}>Confirm & Save Actuals</Button>
               <Button variant="secondary" onClick={() => setActualDraft(null)} disabled={busy}>Cancel</Button>
             </div>
           </div>
        )}
        {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      </Modal>`;

if (content.includes(modalTarget)) {
    content = content.replace(modalTarget, modalRepl);
}

fs.writeFileSync(path, content);
console.log('DayPlanner preview flow injected successfully');
