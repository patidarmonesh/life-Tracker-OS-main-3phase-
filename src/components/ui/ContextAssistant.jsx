import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppState } from '../../context/appHooks'
import { askModuleAssistant } from '../../services/geminiService'
import Button from './Button'
import Modal from './Modal'

const MODULES = { timeflow: 'timeflow', finance: 'finance', study: 'study', habits: 'habits', health: 'health', journal: 'journal', goals: 'goals', wisdom: 'wisdom', decisions: 'decisions', crm: 'crm', brain: 'secondBrain', readings: 'readings', meditations: 'meditations' }
function compact(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/key|token|secret|picture|image|base64|rawText|billOCR/i.test(key)) return undefined
    if (typeof item === 'string') return item.slice(0, 2000)
    if (Array.isArray(item)) return [...item].sort((a, b) => String(b?.date || b?.updatedAt || '').localeCompare(String(a?.date || a?.updatedAt || ''))).slice(0, 60)
    return item
  }))
}
export default function ContextAssistant() {
  const state = useAppState()
  const { pathname } = useLocation()
  const page = pathname.split('/')[1] || 'home'
  const module = MODULES[page]
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('What should I focus on next?')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function ask() {
    setBusy(true); setError(''); setAnswer('')
    try {
      const data = module ? compact(state[module] || {}) : compact(Object.fromEntries(Object.values(MODULES).map(key => [key, state[key]])))
      setAnswer(await askModuleAssistant({ module: page, question, data }))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <>
    <div style={{ textAlign: 'right', padding: '6px 20px' }}><button onClick={() => { setOpen(true); setAnswer(''); setError('') }} style={{ color: 'var(--accent-indigo)', background: 'none', border: 0, cursor: 'pointer', fontSize: 12 }}>✦ Ask AI about {page.replaceAll('-', ' ')}</button></div>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={`AI · ${page.replaceAll('-', ' ')}`}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ask sends recent {module ? 'page' : 'app'} data to Gemini using your key from Settings. Suggestions are shown here for you to use.</p>
      <textarea aria-label="Question for AI" value={question} onChange={e => setQuestion(e.target.value)} rows={3} style={{ width: '100%', padding: 12, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 10 }} />
      <Button onClick={ask} disabled={busy || !question.trim()}>{busy ? 'Thinking…' : 'Ask AI'}</Button>
      {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      {answer && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 16 }}>{answer}</div>}
    </Modal>
  </>
}
