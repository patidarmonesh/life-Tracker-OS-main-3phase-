import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Inbox, Image, Mic } from 'lucide-react'
import { Page, Card, Button, Tabs } from '../ui/index'
import { useAppState, useAppActions } from '../context/appHooks'
import { ownerDate, uid } from '../domain/planning/index'
import { canonicalCategories, parseMoneyMessage } from '../domain/capture/index'

export default function Capture() {
  const state = useAppState()
  const { updateModule } = useAppActions()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const defaultType = params.get('type') || 'note'
  const captures = state.captures || { items: [], draftText: '', retainRaw: false }
  
  const [kind, setKind] = useState(defaultType)
  const [error, setError] = useState('')
  const timezone = state.settings?.profile?.timezone || 'Asia/Kolkata'
  const today = ownerDate(new Date(), timezone)
  const categories = canonicalCategories(state.finance?.categories?.length ? state.finance.categories : state.settings?.preferences?.expenseCategories || ['Miscellaneous'])

  const tabs = [
    { key: 'note', label: 'Note' },
    { key: 'expense', label: 'Expense' },
    { key: 'time', label: 'Time' },
    { key: 'diary', label: 'Plan' },
  ]

  function changeText(value) {
    updateModule('captures', c => ({ ...c, draftText: value }))
    setError('')
  }

  function add() {
    try {
      if (!captures.draftText.trim()) throw new Error('Type or paste something first.')
      const item = { 
        id: uid('capture'), kind, text: captures.draftText.trim(), 
        status: 'pending', localDate: today, createdAt: new Date().toISOString(), source: 'intentional-text' 
      }
      if (kind === 'expense') {
        item.proposal = parseMoneyMessage(item.text, { captureDate: today, categories: categories.map(c => ({ id: c.id, name: c.label })) })
        if (item.proposal.status === 'excluded') throw new Error(item.proposal.warnings.join(' '))
      }
      updateModule('captures', c => ({ items: [...c.items, item], draftText: c.retainRaw ? c.draftText : '', retainRaw: c.retainRaw }))
      navigate('/me')
    } catch (err) {
      setError(err.message)
    }
  }

  return <Page title="Capture" icon={Inbox} color="#818CF8" back="/">
    <Tabs tabs={tabs} value={kind} onChange={setKind} id="capture" />
    
    <Card>
      <textarea className="ui-input" rows={6} value={captures.draftText} style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#2f352b', color: '#f4f4f5' }} 
        onChange={e => changeText(e.target.value)} 
        placeholder={kind === 'expense' ? "e.g. Swiggy 400" : "Jot down a thought..."} />
      
      {error && <div style={{ color: 'var(--warning-ink)', fontSize: '.82rem', marginTop: 12 }}>{error}</div>}
      
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Button variant="ghost" icon={Mic} onClick={() => alert("Dictate not implemented")}>Dictate</Button>
        <Button variant="ghost" icon={Image} onClick={() => alert("Image capture not implemented")}>Image</Button>
        <div style={{ flex: 1 }} />
        <Button variant="primary" onClick={add}>Save</Button>
      </div>
    </Card>
  </Page>
}
