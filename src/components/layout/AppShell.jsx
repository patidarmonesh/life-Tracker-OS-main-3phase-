import { useEffect, useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import KeyboardShortcuts from '../ui/KeyboardShortcuts'
import ScrollToTop from '../ui/ScrollToTop'
import CommandPalette from '../ui/CommandPalette'
import PWAInstallPrompt from '../ui/PWAInstallPrompt'
import ReconnectBanner from '../ui/ReconnectBanner'
import { useAppState, useAppActions } from '../../context/appHooks'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Plus, DollarSign, Clock, CheckSquare, Brain, X, Droplet, Mic, MicOff } from 'lucide-react'
import { useToast } from '../../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../../hooks/useHaptic'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { v4 as uuid } from 'uuid'

const MOBILE_BREAKPOINT = 900

export default function AppShell({ children }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )
  const state = useAppState()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // 'expense' | 'water' | 'study' | 'journal' | 'wisdom' | null

  // Forms Setup
  const currencySymbol = state.settings?.profile?.currency === 'INR' ? '₹' : (state.settings?.profile?.currency || '₹')
  const defaultExpenseCategories = state.settings?.preferences?.expenseCategories || [
    'Food', 'Drinks', 'Groceries', 'Transport', 'Gym Fitness', 'Study Education',
    'Shopping', 'Bills Utilities', 'Health Medical', 'Entertainment', 'Subscriptions',
    'Travel', 'Personal Care', 'Gifts', 'Miscellaneous'
  ]
  const defaultStudySubjects = state.study?.subjects || [
    'Mathematics', 'Physics', 'CS Theory', 'Machine Learning', 'Deep Learning',
    'DSA', 'Research Paper', 'Project Work', 'GATE Prep', 'Other'
  ]

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: defaultExpenseCategories[0] || 'Food',
    paymentMethod: 'UPI',
    description: '',
  })

  const [waterForm, setWaterForm] = useState({
    amountMl: 250,
  })

  const [studyForm, setStudyForm] = useState({
    subject: defaultStudySubjects[0] || 'Other',
    topic: '',
    durationMinutes: 60,
    notes: '',
  })

  const [journalForm, setJournalForm] = useState({
    title: '',
    content: '',
    mood: 4,
    energy: 3,
    gratitude: '',
  })

  const [wisdomForm, setWisdomForm] = useState({
    text: '',
    source: 'Bhagavad Gita',
  })

  const [isListening, setIsListening] = useState(false)

  // Save Handlers
  function handleQuickExpense() {
    if (!expenseForm.amount || isNaN(expenseForm.amount) || Number(expenseForm.amount) <= 0) {
      showToast('Please enter a valid amount', 'warning')
      return
    }

    const newExpense = {
      id: uuid(),
      amount: Number(expenseForm.amount),
      currency: state.settings?.profile?.currency || 'INR',
      category: expenseForm.category,
      subcategory: '',
      description: expenseForm.description.trim() || 'Quick Expense',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      paymentMethod: expenseForm.paymentMethod,
      isImpulsive: false,
      account: 'Cash',
      isRecurring: false,
      tags: ['quick-add'],
      billDriveFileId: null,
      billOCRText: null,
      createdAt: new Date().toISOString(),
    }

    const updatedExpenses = [newExpense, ...(state.finance?.expenses || [])]
    setModule('finance', {
      ...state.finance,
      expenses: updatedExpenses,
    })

    showToast('Expense added! 💸', 'success')
    playSuccessSound()
    hapticSuccess()
    setExpenseForm({ amount: '', category: defaultExpenseCategories[0] || 'Food', paymentMethod: 'UPI', description: '' })
    setActiveModal(null)
  }

  function handleQuickWater(amount) {
    const todayStr = new Date().toISOString().split('T')[0]
    const amountToLog = parseInt(amount || waterForm.amountMl)
    if (!amountToLog || amountToLog <= 0) return

    const newLog = {
      id: 'water_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      amountMl: amountToLog,
      date: todayStr,
      timestamp: new Date().toISOString(),
    }

    const waterLogs = state.health?.waterLogs || []
    const updatedLogs = [...waterLogs, newLog]

    setModule('health', {
      ...state.health,
      waterLogs: updatedLogs
    })

    showToast(`Logged ${amountToLog}ml of water! 💧`, 'success')
    playSuccessSound()
    hapticSuccess()
    setActiveModal(null)
  }

  function handleQuickStudy() {
    if (!studyForm.durationMinutes || isNaN(studyForm.durationMinutes) || Number(studyForm.durationMinutes) <= 0) {
      showToast('Please enter valid study minutes', 'warning')
      return
    }

    const newSession = {
      id: uuid(),
      subject: studyForm.subject,
      topic: studyForm.topic.trim(),
      focusType: 'Deep Focus',
      durationMinutes: Number(studyForm.durationMinutes),
      date: new Date().toISOString().split('T')[0],
      notes: studyForm.notes.trim(),
      rating: 4,
      pagesRead: 0,
      problemsSolved: 0,
      understood: true,
      source: 'quick-add',
      createdAt: new Date().toISOString(),
    }

    const updatedSessions = [newSession, ...(state.study?.sessions || [])]
    setModule('study', {
      ...state.study,
      sessions: updatedSessions,
    })

    showToast('Study session logged! 📚', 'success')
    playSuccessSound()
    hapticSuccess()
    setStudyForm({ subject: defaultStudySubjects[0] || 'Other', topic: '', durationMinutes: 60, notes: '' })
    setActiveModal(null)
  }

  function handleQuickJournal() {
    if (!journalForm.content.trim()) {
      showToast('Please write something in your journal entry', 'warning')
      return
    }

    const newEntry = {
      id: uuid(),
      date: new Date().toISOString().split('T')[0],
      title: journalForm.title.trim() || 'Quick Reflection',
      content: journalForm.content.trim(),
      mood: Number(journalForm.mood),
      energy: Number(journalForm.energy),
      gratitude: journalForm.gratitude.trim(),
      tags: ['quick-add'],
      aiSentiment: '',
      aiRecommendation: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updatedEntries = [newEntry, ...(state.journal?.entries || [])]
    setModule('journal', {
      ...state.journal,
      entries: updatedEntries,
    })

    showToast('Journal entry saved! 📝', 'success')
    playSuccessSound()
    hapticSuccess()
    setJournalForm({ title: '', content: '', mood: 4, energy: 3, gratitude: '' })
    setActiveModal(null)
  }

  function handleQuickWisdom() {
    if (!wisdomForm.text.trim()) {
      showToast('Please enter a wisdom quote or lesson', 'warning')
      return
    }

    const newEntry = {
      id: uuid(),
      text: wisdomForm.text.trim(),
      source: wisdomForm.source.trim() || 'Self Reflection',
      isFloating: (state.wisdom?.entries || []).length === 0,
      createdAt: new Date().toISOString(),
    }

    const updatedEntries = [newEntry, ...(state.wisdom?.entries || [])]
    setModule('wisdom', {
      ...state.wisdom,
      entries: updatedEntries,
    })

    showToast('Wisdom teaching saved! 🧠', 'success')
    playSuccessSound()
    hapticSuccess()
    setWisdomForm({ text: '', source: 'Bhagavad Gita' })
    setActiveModal(null)
  }

  function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('Speech recognition is not supported in this browser.', 'error')
      return
    }

    if (isListening) {
      setIsListening(false)
      playSubtleClick()
      hapticLight()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      playSubtleClick()
      hapticLight()
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setJournalForm(f => ({
        ...f,
        content: f.content + (f.content ? ' ' : '') + transcript
      }))
      playSuccessSound()
      hapticSuccess()
    }

    recognition.onerror = (event) => {
      console.error(event.error)
      showToast('Voice typing error: ' + event.error, 'error')
      setIsListening(false)
      playWarningBeep()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
  }

  const renderFAB = () => {
    const bottomPos = isMobile ? '88px' : '24px'
    const rightPos = isMobile ? '16px' : '24px'

    const actions = [
      { id: 'expense', label: 'Quick Expense', icon: DollarSign, color: '#EF4444' },
      { id: 'water', label: 'Log Water', icon: Droplet, color: '#3B82F6' },
      { id: 'study', label: 'Log Study', icon: Clock, color: '#8B5CF6' },
      { id: 'journal', label: 'Write Journal', icon: CheckSquare, color: '#10B981' },
      { id: 'wisdom', label: 'Save Wisdom', icon: Brain, color: '#EC4899' },
    ]

    return (
      <div style={{
        position: 'fixed',
        bottom: bottomPos,
        right: rightPos,
        zIndex: 99,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
      }}>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .fab-action-btn:hover {
            transform: scale(1.1);
            background: rgba(255, 255, 255, 0.05) !important;
          }
        `}</style>

        {/* Speed Dial Actions */}
        {quickAddOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '8px',
            marginBottom: '8px',
            animation: 'fadeInUp 0.2s ease-out forwards',
          }}>
            {actions.map((act, index) => {
              const Icon = act.icon
              return (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {/* Label */}
                  <span style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {act.label}
                  </span>
                  
                  {/* Circular button */}
                  <button
                    onClick={() => {
                      playSubtleClick();
                      hapticLight();
                      setActiveModal(act.id);
                      setQuickAddOpen(false);
                    }}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${act.color}40`,
                      color: act.color,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      transition: 'all 0.2s ease',
                    }}
                    className="fab-action-btn"
                  >
                    <Icon size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Main Toggle Button */}
        <button
          onClick={() => {
            playSubtleClick();
            hapticLight();
            setQuickAddOpen(!quickAddOpen);
          }}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-indigo) 0%, #4F46E5 100%)',
            border: 'none',
            color: '#FFFFFF',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.35)',
            transform: quickAddOpen ? 'rotate(45deg)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
        >
          <Plus size={24} style={{ transition: 'transform 0.3s ease' }} />
        </button>
      </div>
    )
  }

  const renderModals = () => {
    return (
      <>
        {/* 💸 Quick Expense Modal */}
        <Modal
          isOpen={activeModal === 'expense'}
          onClose={() => setActiveModal(null)}
          title="💸 Add Expense"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Amount ({currencySymbol})</label>
              <input
                type="number"
                style={inputStyle}
                placeholder="e.g. 250"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                style={inputStyle}
                value={expenseForm.category}
                onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
              >
                {defaultExpenseCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment Method</label>
              <select
                style={inputStyle}
                value={expenseForm.paymentMethod}
                onChange={e => setExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))}
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Description / Notes</label>
              <input
                style={inputStyle}
                placeholder="e.g. Lunch with friends"
                value={expenseForm.description}
                onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setActiveModal(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleQuickExpense} style={{ flex: 1 }} disabled={!expenseForm.amount}>Log Expense</Button>
            </div>
          </div>
        </Modal>

        {/* 💧 Log Water Modal */}
        <Modal
          isOpen={activeModal === 'water'}
          onClose={() => setActiveModal(null)}
          title="💧 Log Water Intake"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '36px', animation: 'pulse 2s infinite' }}>💧</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Choose a quick amount to log your hydration immediately.
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%' }}>
              {[150, 250, 500].map(ml => (
                <button
                  key={ml}
                  onClick={() => handleQuickWater(ml)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-indigo)'
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }}
                >
                  +{ml} ml
                </button>
              ))}
            </div>

            <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <label style={labelStyle}>Custom Amount (ml)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="e.g. 350"
                  value={waterForm.amountMl}
                  onChange={e => setWaterForm(f => ({ ...f, amountMl: e.target.value }))}
                />
                <Button onClick={() => handleQuickWater()} disabled={!waterForm.amountMl}>Log</Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* 📚 Log Study Session Modal */}
        <Modal
          isOpen={activeModal === 'study'}
          onClose={() => setActiveModal(null)}
          title="📚 Quick Study Logger"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Subject / Topic</label>
              <select
                style={inputStyle}
                value={studyForm.subject}
                onChange={e => setStudyForm(f => ({ ...f, subject: e.target.value }))}
              >
                {defaultStudySubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic studied</label>
              <input
                style={inputStyle}
                placeholder="e.g. Backpropagation, Linear Algebra section 4"
                value={studyForm.topic}
                onChange={e => setStudyForm(f => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Duration (Minutes)</label>
              <input
                type="number"
                style={inputStyle}
                placeholder="60"
                value={studyForm.durationMinutes}
                onChange={e => setStudyForm(f => ({ ...f, durationMinutes: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Reflection Notes</label>
              <input
                style={inputStyle}
                placeholder="Brief notes on what you completed..."
                value={studyForm.notes}
                onChange={e => setStudyForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setActiveModal(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleQuickStudy} style={{ flex: 1 }} disabled={!studyForm.durationMinutes}>Save Session</Button>
            </div>
          </div>
        </Modal>

        {/* 📝 Quick Journal Modal */}
        <Modal
          isOpen={activeModal === 'journal'}
          onClose={() => setActiveModal(null)}
          title="📝 Write Journal Entry"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input
                style={inputStyle}
                placeholder="Optional title (defaults to Quick Reflection)"
                value={journalForm.title}
                onChange={e => setJournalForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ ...labelStyle, margin: 0 }}>Entry Content</label>
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isListening ? '#EF4444' : 'var(--accent-indigo)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                  }}
                >
                  {isListening ? (
                    <>
                      <MicOff size={12} className="animate-pulse" /> Listening...
                    </>
                  ) : (
                    <>
                      <Mic size={12} /> Voice Typing
                    </>
                  )}
                </button>
              </div>
              <textarea
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="What are your thoughts right now? Or use voice typing..."
                value={journalForm.content}
                onChange={e => setJournalForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Mood Rating: {journalForm.mood}/5</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  style={{ width: '100%', accentColor: '#10B981' }}
                  value={journalForm.mood}
                  onChange={e => setJournalForm(f => ({ ...f, mood: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Energy Rating: {journalForm.energy}/5</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  style={{ width: '100%', accentColor: 'var(--accent-indigo)' }}
                  value={journalForm.energy}
                  onChange={e => setJournalForm(f => ({ ...f, energy: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>One thing you are grateful for</label>
              <input
                style={inputStyle}
                placeholder="e.g. Hot tea in the morning, solving a tough bug"
                value={journalForm.gratitude}
                onChange={e => setJournalForm(f => ({ ...f, gratitude: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setActiveModal(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleQuickJournal} style={{ flex: 1 }} disabled={!journalForm.content.trim()}>Save Reflection</Button>
            </div>
          </div>
        </Modal>

        {/* 🧠 Save Wisdom Modal */}
        <Modal
          isOpen={activeModal === 'wisdom'}
          onClose={() => setActiveModal(null)}
          title="🧠 Log Wisdom / Learning"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Core Learning / Quote / Vichar</label>
              <textarea
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="e.g. Vichar vritti se aate h isle hamesha socha karo..."
                value={wisdomForm.text}
                onChange={e => setWisdomForm(f => ({ ...f, text: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Source / Book / Mentor</label>
              <input
                style={inputStyle}
                placeholder="Bhagavad Gita, Marcus Aurelius, Podcast..."
                value={wisdomForm.source}
                onChange={e => setWisdomForm(f => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setActiveModal(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleQuickWisdom} style={{ flex: 1 }} disabled={!wisdomForm.text.trim()}>Save Wisdom</Button>
            </div>
          </div>
        </Modal>
      </>
    )
  }

  const activeFloating = state.wisdom?.entries?.find(e => e.isFloating)


  const renderFloatingWisdom = () => {
    if (!activeFloating) return null
    return (
      <div
        onClick={() => navigate('/wisdom')}
        style={{
          background: 'linear-gradient(90deg, rgba(99,102,241,0.06) 0%, rgba(236,72,153,0.06) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(99,102,241,0.15)',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 90,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        className="floating-wisdom-banner"
      >
        <Sparkles size={13} color="#EC4899" style={{ animation: 'spin 10s linear infinite', flexShrink: 0 }} />
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: 'var(--text-secondary)',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Focus Wisdom:
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          fontStyle: 'italic',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          "{activeFloating.text}"
        </span>
        {activeFloating.source && (
          <span style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            — {activeFloating.source}
          </span>
        )}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        minHeight: '100vh',
        overscrollBehavior: 'contain',
      }}>
        <TopBar isMobile />
        <ReconnectBanner />
        {renderFloatingWisdom()}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}>
          <div className="page-enter">
            {children}
          </div>
        </main>
        <BottomNav />
        <KeyboardShortcuts />
        <ScrollToTop />
        <CommandPalette />
        <PWAInstallPrompt />
        {renderFAB()}
        {renderModals()}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar isMobile={false} />
        <ReconnectBanner />
        {renderFloatingWisdom()}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
      <KeyboardShortcuts />
      <ScrollToTop />
      <CommandPalette />
      <PWAInstallPrompt />
      {renderFAB()}
      {renderModals()}
    </div>
  )
}
