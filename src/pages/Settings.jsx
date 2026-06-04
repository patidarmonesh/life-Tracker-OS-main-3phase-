import { useEffect, useMemo, useRef, useState } from 'react'
import {
  User, Target, KeyRound, Bell, Palette, Database,
  Info, Upload, Download, Trash2, Plus, X, Check, Wallet, HardDriveDownload, AlertTriangle, Volume2
} from 'lucide-react'
import { useAppActions, useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import { saveGeminiApiKey, testGeminiApiKey, getGeminiApiKey } from '../services/geminiService'
import Button from '../components/ui/Button'
import { useToast } from '../context/toastContextCore'
import { getCurrencySymbol, normalizeCurrency } from '../utils/currency'
import { playSuccessSound, playWarningBeep, playNoticeChime, playSubtleClick } from '../hooks/useAudio'
import { hapticSuccess, hapticWarning, hapticMedium, hapticLight } from '../hooks/useHaptic'

const AVATARS = ['🧠', '🚀', '💻', '📚', '🎯', '🔥', '⚡', '🌙', '🏋️', '🎵', '🪴', '🧩']
const DEFAULT_EXPENSE_CATEGORIES = [
  'Food', 'Drinks', 'Groceries', 'Transport', 'Gym Fitness', 'Study Education',
  'Shopping', 'Bills Utilities', 'Health Medical', 'Entertainment', 'Subscriptions',
  'Travel', 'Personal Care', 'Gifts', 'Miscellaneous'
]
const DEFAULT_STUDY_SUBJECTS = [
  'Mathematics', 'Physics', 'CS Theory', 'Machine Learning', 'Deep Learning',
  'DSA', 'Research Paper', 'Project Work', 'GATE Prep', 'Other',
]
const DEFAULT_TIME_CATEGORIES = [
  'Sleep', 'Morning Routine', 'Exercise', 'Study', 'Deep Work',
  'Meals', 'Social Media', 'Entertainment', 'Travel', 'Self-Care', 'Waste Time', 'Other',
]

export default function Settings() {
  const state = useAppState()
  const { setModule, patchModule, resetToSample, refreshFromDrive } = useAppActions()
  const { showToast } = useToast()
  const fileRef = useRef(null)
  const backupFileRef = useRef(null)
  const [newExpenseCategory, setNewExpenseCategory] = useState('')
  const [newTimeCategory, setNewTimeCategory] = useState('')
  const [newStudySubject, setNewStudySubject] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey())
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [apiStatus, setApiStatus] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState('Bank')

  const settings = state.settings || {}
  const profile = settings.profile || {
    name: 'Ravish',
    avatar: '🧠',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  }

  const studySubjects = state.study?.subjects?.length
    ? state.study.subjects
    : DEFAULT_STUDY_SUBJECTS

  const preferences = settings.preferences || {
    dailyStudyGoal: 6,
    monthlyBudget: 15000,
    dailyWasteLimit: 2,
    sleepGoal: 8,
    dailyStepGoal: 10000,
    proteinGoal: 160,
    calorieGoal: 2200,
    weightGoal: 72,
    theme: 'dark',
    notificationsEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
    dailyCheckinReminder: '21:00',
    budgetAlertAt: 80,
    streakRiskWarning: true,
    weeklyReportDay: 'Sunday',
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    timeCategories: DEFAULT_TIME_CATEGORIES,
    accounts: [],
  }

  useEffect(() => {
    const root = document.documentElement
    const theme = preferences.theme || 'dark'

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', isDark ? 'dark' : 'light')
      return
    }

    root.setAttribute('data-theme', theme)
  }, [preferences.theme])  


  function saveSettings(nextProfile, nextPreferences) {
    setModule('settings', {
      ...settings,
      profile: nextProfile ?? profile,
      preferences: nextPreferences ?? preferences,
    })
  }

  function updateProfile(key, value) {
    saveSettings({ ...profile, [key]: value }, preferences)
  }

  function updatePref(key, value) {
    saveSettings(profile, { ...preferences, [key]: value })
  }

  function addStudySubject() {
    const value = newStudySubject.trim()
    if (!value || studySubjects.includes(value)) return
    patchModule('study', { subjects: [...studySubjects, value] })
    setNewStudySubject('')
    showToast('Study subject added ✓', 'success')
  }

  function removeStudySubject(name) {
    patchModule('study', { subjects: studySubjects.filter(s => s !== name) })
  }

  function addExpenseCategory() {
    const value = newExpenseCategory.trim()
    if (!value || preferences.expenseCategories.includes(value)) return
    updatePref('expenseCategories', [...preferences.expenseCategories, value])
    setNewExpenseCategory('')
  }

  function addTimeCategory() {
    const value = newTimeCategory.trim()
    if (!value || preferences.timeCategories.includes(value)) return
    updatePref('timeCategories', [...preferences.timeCategories, value])
    setNewTimeCategory('')
  }

  function removeExpenseCategory(name) {
    updatePref('expenseCategories', preferences.expenseCategories.filter(c => c !== name))
  }

  function removeTimeCategory(name) {
    updatePref('timeCategories', preferences.timeCategories.filter(c => c !== name))
  }

  const accounts = preferences.accounts || []

  function addAccount() {
    const name = newAccountName.trim()
    if (!name) return
    if (accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      showToast('Account already exists', 'error')
      return
    }
    updatePref('accounts', [...accounts, { name, type: newAccountType }])
    setNewAccountName('')
    setNewAccountType('Bank')
    showToast('Account added ✓', 'success')
  }

  function removeAccount(accountName) {
    updatePref('accounts', accounts.filter(a => a.name !== accountName))
  }

  async function testGeminiKey() {
    const key = geminiKeyInput.trim()

    if (!key) {
      setApiStatus('Please enter a Gemini API key first.')
      return
    }

    try {
      setApiStatus('Testing Gemini key...')
      saveGeminiApiKey(key)
      await testGeminiApiKey(key)
      setApiStatus('Gemini API key is valid and working.')
      showToast('API key saved ✓', 'success')
    } catch (error) {
      setApiStatus(error.message || 'Gemini key test failed.')
    }
  }

  function handleGeminiKeyChange(value) {
    setGeminiKeyInput(value)
    saveGeminiApiKey(value)
  }

  function exportAllData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      data: state,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lifeos-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Backup exported ✓', 'success')
  }

  const VALID_MODULE_KEYS = new Set([
    'finance', 'timeflow', 'study', 'habits', 'health', 'journal', 'wisdom', 'goals', 'decisions', 'crm', 'secondBrain', 'readings', 'meditations', 'settings', 'aiChat',
  ])

  const EXPECTED_KEYS = ['finance', 'study', 'timeflow', 'habits', 'health', 'journal', 'wisdom', 'goals', 'decisions', 'crm', 'secondBrain', 'readings', 'meditations', 'settings']

  function importBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const imported = parsed.data || parsed

        const foundKeys = EXPECTED_KEYS.filter(k => imported[k] !== undefined)
        if (foundKeys.length === 0) {
          showToast('Invalid backup: no recognized data modules found.', 'error')
          return
        }

        const counts = []
        Object.entries(imported).forEach(([key, value]) => {
          if (VALID_MODULE_KEYS.has(key)) {
            setModule(key, value)
          }
        })

        if (imported.finance?.expenses?.length) counts.push(`${imported.finance.expenses.length} expenses`)
        if (imported.study?.sessions?.length) counts.push(`${imported.study.sessions.length} study sessions`)
        if (imported.timeflow?.entries?.length) counts.push(`${imported.timeflow.entries.length} time entries`)
        if (imported.habits?.checkpoints?.length) counts.push(`${imported.habits.checkpoints.length} habit checkpoints`)
        if (imported.health?.bodyLogs?.length) counts.push(`${imported.health.bodyLogs.length} health logs`)
        if (imported.journal?.entries?.length) counts.push(`${imported.journal.entries.length} journal entries`)
        if (imported.decisions?.entries?.length) counts.push(`${imported.decisions.entries.length} decisions`)
        if (imported.crm?.contacts?.length) counts.push(`${imported.crm.contacts.length} CRM contacts`)
        if (imported.secondBrain?.notes?.length) counts.push(`${imported.secondBrain.notes.length} brain notes`)
        if (imported.readings?.books?.length) counts.push(`${imported.readings.books.length} readings`)
        if (imported.meditations?.sessions?.length) counts.push(`${imported.meditations.sessions.length} meditations`)

        const summary = counts.length > 0 ? `Imported ${counts.join(', ')}` : 'Backup imported successfully'
        showToast(summary + ' ✓', 'success')
      } catch {
        showToast('Invalid backup file. Please select a valid JSON export.', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function clearModule(moduleKey) {
    if (!window.confirm(`Clear all data for ${moduleKey}?`)) return
    const emptyMap = {
      finance: { expenses: [], budgets: {}, categories: [], bills: [], savingsGoals: [] },
      timeflow: { entries: [] },
      study: { sessions: [], goals: {}, subjects: [], flashcards: [] },
      habits: { checkpoints: [], dailyLogs: [] },
      health: { bodyLogs: [], nutrition: [], hevyWorkouts: [], manualWorkouts: [], waterLogs: [] },
      journal: { entries: [] },
      wisdom: { entries: [] },
      goals: { entries: [] },
      decisions: { entries: [] },
      crm: { contacts: [] },
      secondBrain: { notes: [] },
      readings: { books: [] },
      meditations: { sessions: [] },
      aiChat: { messages: [] },
    }
    if (emptyMap[moduleKey]) setModule(moduleKey, emptyMap[moduleKey])
  }

  async function deleteAllData() {
    if (deleteConfirm !== 'DELETE ALL') {
      alert('Type DELETE ALL exactly to confirm.')
      return
    }

    try {
      await resetToSample()
      setDeleteConfirm('')
      alert('All app data cleared locally and on Drive.')
    } catch (error) {
      console.error('Delete all failed:', error)
      alert('Delete all failed. Please try again.')
    }
  }

  const sectionTitle = (icon, title, subtitle) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
      </div>
    </div>
  )

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

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '5px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const stat = useMemo(() => ({
    expenseCount: state.finance?.expenses?.length || 0,
    timeEntries: state.timeflow?.entries?.length || 0,
    studySessions: state.study?.sessions?.length || 0,
    habitsCount: state.habits?.checkpoints?.length || 0,
    healthLogs: (state.health?.bodyLogs?.length || 0) + (state.health?.manualWorkouts?.length || 0) + (state.health?.waterLogs?.length || 0),
    journalEntries: state.journal?.entries?.length || 0,
    wisdomCount: state.wisdom?.entries?.length || 0,
    goalsCount: state.goals?.entries?.length || 0,
    decisionsCount: state.decisions?.entries?.length || 0,
    crmCount: state.crm?.contacts?.length || 0,
    secondBrainCount: state.secondBrain?.notes?.length || 0,
    readingsCount: state.readings?.books?.length || 0,
    meditationsCount: state.meditations?.sessions?.length || 0,
  }), [state])

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>⚙️ Settings</h1>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Manage profile, goals, API keys, theme, categories, notifications, and data.
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <Card>
          {sectionTitle(<User size={18} />, 'Profile', 'Identity, avatar, currency, and timezone.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={profile.name} onChange={e => updateProfile('name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={profile.currency} onChange={e => updateProfile('currency', e.target.value)}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Timezone</label>
              <select style={inputStyle} value={profile.timezone} onChange={e => updateProfile('timezone', e.target.value)}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={labelStyle}>Avatar</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {AVATARS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => updateProfile('avatar', emoji)}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    border: `1px solid ${profile.avatar === emoji ? 'var(--accent-indigo)' : 'var(--border)'}`,
                    background: profile.avatar === emoji ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    fontSize: '20px',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          {sectionTitle(<Target size={18} />, 'Goals', 'Core targets used across analytics and dashboards.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              ['Daily Study Goal', 'dailyStudyGoal', 'hrs', 1, 12],
              ['Monthly Budget', 'monthlyBudget', getCurrencySymbol(normalizeCurrency(profile.currency)), 1000, 100000],
              ['Daily Waste Limit', 'dailyWasteLimit', 'hrs', 0, 6],
              ['Sleep Goal', 'sleepGoal', 'hrs', 5, 10],
              ['Daily Step Goal', 'dailyStepGoal', 'steps', 1000, 30000],
              ['Protein Goal', 'proteinGoal', 'g', 50, 300],
              ['Calorie Goal', 'calorieGoal', 'kcal', 1200, 4000],
              ['Weight Goal', 'weightGoal', 'kg', 40, 150],
            ].map(([label, key, unit, min, max]) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={preferences[key]}
                    onChange={e => updatePref(key, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <div style={{ minWidth: '72px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: '700' }}>
                    {unit === getCurrencySymbol(normalizeCurrency(profile.currency)) ? `${unit}${preferences[key]}` : `${preferences[key]} ${unit}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          {sectionTitle(<KeyRound size={18} />, 'API Keys', 'Gemini key is stored locally on this device only — never synced to Drive.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Gemini API Key</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="Paste your Gemini API key"
                value={geminiKeyInput}
                onChange={e => handleGeminiKeyChange(e.target.value)}
              />
            </div>
            <Button onClick={testGeminiKey}>Test Key</Button>
          </div>
          {apiStatus && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {apiStatus}
            </div>
          )}
        </Card>

        <Card>
          {sectionTitle(<Plus size={18} />, 'Categories', 'Manage expense and time categories used in forms.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Expense Categories</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  style={inputStyle}
                  value={newExpenseCategory}
                  onChange={e => setNewExpenseCategory(e.target.value)}
                  placeholder="Add expense category"
                />
                <Button onClick={addExpenseCategory}>Add</Button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {preferences.expenseCategories.map(cat => (
                  <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '12px' }}>
                    {cat}
                    <button onClick={() => removeExpenseCategory(cat)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Time Categories</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  style={inputStyle}
                  value={newTimeCategory}
                  onChange={e => setNewTimeCategory(e.target.value)}
                  placeholder="Add time category"
                />
                <Button onClick={addTimeCategory}>Add</Button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {preferences.timeCategories.map(cat => (
                  <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '12px' }}>
                    {cat}
                    <button onClick={() => removeTimeCategory(cat)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Study Subjects</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  style={inputStyle}
                  value={newStudySubject}
                  onChange={e => setNewStudySubject(e.target.value)}
                  placeholder="Add study subject"
                />
                <Button onClick={addStudySubject}>Add</Button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {studySubjects.map(sub => (
                  <span key={sub} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '12px' }}>
                    {sub}
                    <button type="button" onClick={() => removeStudySubject(sub)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          {sectionTitle(<Wallet size={18} />, 'Accounts & Payment Methods', 'Manage payment sources for expense tracking.')}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: '1 1 180px' }}
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
              placeholder="Account name"
              onKeyDown={e => e.key === 'Enter' && addAccount()}
            />
            <select
              style={{ ...inputStyle, flex: '0 1 160px' }}
              value={newAccountType}
              onChange={e => setNewAccountType(e.target.value)}
            >
              <option value="Bank">Bank</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Cash">Cash</option>
              <option value="UPI/Wallet">UPI/Wallet</option>
            </select>
            <Button onClick={addAccount}>Add</Button>
          </div>
          {accounts.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '12px 0' }}>
              No accounts added yet. Add a payment source above.
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {accounts.map(acc => (
              <span
                key={acc.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 12px',
                  borderRadius: '999px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                }}
              >
                {acc.name}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: acc.type === 'Bank' ? 'rgba(99,102,241,0.14)'
                      : acc.type === 'Credit Card' ? 'rgba(245,158,11,0.14)'
                      : acc.type === 'Cash' ? 'rgba(16,185,129,0.14)'
                      : 'rgba(168,85,247,0.14)',
                    color: acc.type === 'Bank' ? 'var(--accent-indigo)'
                      : acc.type === 'Credit Card' ? 'var(--accent-amber)'
                      : acc.type === 'Cash' ? '#10B981'
                      : '#A855F7',
                  }}
                >
                  {acc.type}
                </span>
                <button
                  onClick={() => removeAccount(acc.name)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </Card>

        <Card>
          {sectionTitle(<HardDriveDownload size={18} />, 'Data Backup & Restore', 'Export all data as JSON or import from a backup.')}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <Button onClick={exportAllData}>
              <Download size={14} /> Export All Data
            </Button>
            <Button variant="secondary" onClick={() => backupFileRef.current?.click()}>
              <Upload size={14} /> Import Backup
            </Button>
            <input
              ref={backupFileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={importBackup}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.22)',
            }}
          >
            <AlertTriangle size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <strong style={{ color: 'var(--accent-amber)' }}>Warning:</strong> Importing will replace your current data. Export first as a backup before importing.
            </div>
          </div>
        </Card>

        <Card>
          {sectionTitle(<Bell size={18} />, 'Notifications', 'Reminder timing, budget alerts, streak-risk warnings, and weekly report day.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Daily Check-in Reminder</label>
              <input type="time" style={inputStyle} value={preferences.dailyCheckinReminder} onChange={e => updatePref('dailyCheckinReminder', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Weekly Report Day</label>
              <select style={inputStyle} value={preferences.weeklyReportDay} onChange={e => updatePref('weeklyReportDay', e.target.value)}>
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Budget Alert At</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="50" max="100" value={preferences.budgetAlertAt} onChange={e => updatePref('budgetAlertAt', Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ minWidth: '52px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{preferences.budgetAlertAt}%</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Streak Risk Warning</label>
              <button
                onClick={() => updatePref('streakRiskWarning', !preferences.streakRiskWarning)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: preferences.streakRiskWarning ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)',
                  color: preferences.streakRiskWarning ? '#10B981' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                {preferences.streakRiskWarning ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          {sectionTitle(<Palette size={18} />, 'Theme', 'Switch between dark, light, and system appearance.')}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['dark', 'light', 'system'].map(theme => (
              <button
                key={theme}
                onClick={() => updatePref('theme', theme)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${preferences.theme === theme ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: preferences.theme === theme ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                  color: preferences.theme === theme ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  textTransform: 'capitalize',
                }}
              >
                {preferences.theme === theme && <Check size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />}
                {theme}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          {sectionTitle(<Volume2 size={18} />, 'Sound & Haptic Feedback', 'Toggle synthesized wave audio and physical tap vibrations.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Sound FX</label>
              <button
                onClick={() => updatePref('soundEnabled', preferences.soundEnabled !== false ? false : true)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: preferences.soundEnabled !== false ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)',
                  color: preferences.soundEnabled !== false ? '#10B981' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                {preferences.soundEnabled !== false ? 'Enabled 🔊' : 'Disabled 🔇'}
              </button>
            </div>
            <div>
              <label style={labelStyle}>Haptic Feedback</label>
              <button
                onClick={() => updatePref('hapticsEnabled', preferences.hapticsEnabled !== false ? false : true)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: preferences.hapticsEnabled !== false ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)',
                  color: preferences.hapticsEnabled !== false ? '#10B981' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                {preferences.hapticsEnabled !== false ? 'Enabled 📳' : 'Disabled 🔇'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => { playSuccessSound(); hapticSuccess(); }}>Test Success</Button>
            <Button variant="secondary" onClick={() => { playWarningBeep(); hapticWarning(); }}>Test Warning</Button>
            <Button variant="secondary" onClick={() => { playNoticeChime(); hapticMedium(); }}>Test Notice</Button>
            <Button variant="secondary" onClick={() => { playSubtleClick(); hapticLight(); }}>Test Tick</Button>
          </div>
        </Card>

        <Card>
          {sectionTitle(<Database size={18} />, 'Data Management', 'Export, import, clear module data, or wipe the app with explicit confirmation.')}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <Button onClick={exportAllData}>
              <Download size={14} /> Export Backup
            </Button>
            <Button variant="secondary" onClick={refreshFromDrive}>
              Refresh from Drive
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import Backup
            </Button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importBackup} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              ['finance', `Finance (${stat.expenseCount})`],
              ['timeflow', `Time Flow (${stat.timeEntries})`],
              ['study', `Study (${stat.studySessions})`],
              ['habits', `Habits (${stat.habitsCount})`],
              ['health', `Health (${stat.healthLogs})`],
              ['journal', `Journal (${stat.journalEntries})`],
              ['wisdom', `Wisdom (${stat.wisdomCount})`],
              ['goals', `Goals (${stat.goalsCount})`],
              ['decisions', `Decisions (${stat.decisionsCount})`],
              ['crm', `CRM (${stat.crmCount})`],
              ['secondBrain', `Brain (${stat.secondBrainCount})`],
              ['readings', `Readings (${stat.readingsCount})`],
              ['meditations', `Meditations (${stat.meditationsCount})`],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => clearModule(key)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Clear {label}
              </button>
            ))}
          </div>

          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.22)' }}>
            <div style={{ fontWeight: '800', color: '#F43F5E', marginBottom: '8px' }}>Danger Zone</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Type <strong>DELETE ALL</strong> exactly to wipe app data.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: '220px' }}
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE ALL"
              />
              <button
                onClick={deleteAllData}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(244,63,94,0.3)',
                  background: 'rgba(244,63,94,0.14)',
                  color: '#F43F5E',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                <Trash2 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                Delete All Data
              </button>
            </div>
          </div>
        </Card>

        <Card>
          {sectionTitle(<Info size={18} />, 'About', 'Version, stack, and app purpose.')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>App</div>
              <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>Life OS</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Version</div>
              <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>v0.1</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Frontend</div>
              <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>React + Vite</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Charts</div>
              <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>Recharts</div>
            </div>
          </div>
        </Card>

        {/* ── Data Backup & Restore ──────────────────────── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <HardDriveDownload size={20} color="var(--accent-indigo)" />
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px' }}>Data Backup & Restore</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Export all data as JSON or import from a backup.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <Button onClick={() => {
              try {
                const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
                showToast('Backup downloaded ✓', 'success')
              } catch (err) {
                showToast('Export failed: ' + err.message, 'error')
              }
            }}>
              <Download size={14} /> Export Backup
            </Button>

            <Button onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.json'
              input.onchange = async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const data = JSON.parse(text)
                  const MODULES = ['finance', 'study', 'timeflow', 'habits', 'health', 'journal', 'wisdom', 'goals', 'decisions', 'crm', 'secondBrain', 'readings', 'meditations', 'settings']
                  const validModules = MODULES.filter(m => data[m])
                  if (validModules.length === 0) {
                    showToast('Invalid backup file — no recognized modules found.', 'error')
                    return
                  }
                  if (!window.confirm(`Import ${validModules.length} modules (${validModules.join(', ')})? This will replace current data.`)) return
                  validModules.forEach(m => setModule(m, data[m]))
                  showToast(`Imported ${validModules.length} modules: ${validModules.join(', ')} ✓`, 'success')
                } catch (err) {
                  showToast('Import failed: ' + err.message, 'error')
                }
              }
              input.click()
            }}>
              <Upload size={14} /> Import Backup
            </Button>
          </div>

          <div style={{
            padding: '10px 12px', borderRadius: '10px',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            fontSize: '12px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertTriangle size={14} />
            Importing will replace your current data. Export a backup first.
          </div>
        </Card>

      </div>
    </div>
  )
}
