import { useEffect, useMemo, useRef, useState } from 'react'
import {
  User, Target, KeyRound, Bell, Palette, Database,
  Info, Upload, Download, Trash2, Plus, X, Check
} from 'lucide-react'
import { useAppActions, useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import { saveGeminiApiKey, testGeminiApiKey, getGeminiApiKey } from '../services/geminiService'
import Button from '../components/ui/Button'
import { useToast } from '../context/toastContextCore'

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
  const [newExpenseCategory, setNewExpenseCategory] = useState('')
  const [newTimeCategory, setNewTimeCategory] = useState('')
  const [newStudySubject, setNewStudySubject] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey())
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [apiStatus, setApiStatus] = useState('')

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
    theme: 'dark',
    notificationsEnabled: true,
    dailyCheckinReminder: '21:00',
    budgetAlertAt: 80,
    streakRiskWarning: true,
    weeklyReportDay: 'Sunday',
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    timeCategories: DEFAULT_TIME_CATEGORIES,
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
  }

  const VALID_MODULE_KEYS = new Set([
    'finance', 'timeflow', 'study', 'habits', 'health', 'journal', 'settings', 'aiChat',
  ])

  function importBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const imported = parsed.data || parsed
        Object.entries(imported).forEach(([key, value]) => {
          if (VALID_MODULE_KEYS.has(key)) {
            setModule(key, value)
          }
        })
        alert('Backup imported successfully.')
      } catch {
        alert('Invalid backup file.')
      }
    }
    reader.readAsText(file)
  }

  function clearModule(moduleKey) {
    if (!window.confirm(`Clear all data for ${moduleKey}?`)) return
    const emptyMap = {
      finance: { expenses: [], budgets: {}, categories: [], bills: [] },
      timeflow: { entries: [] },
      study: { sessions: [], goals: {}, subjects: [] },
      habits: { checkpoints: [], dailyLogs: [] },
      health: { imported: {}, manualLogs: [] },
      journal: { entries: [] },
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
    healthLogs: state.health?.manualLogs?.length || 0,
    journalEntries: state.journal?.entries?.length || 0,
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
              ['Monthly Budget', 'monthlyBudget', '₹', 1000, 100000],
              ['Daily Waste Limit', 'dailyWasteLimit', 'hrs', 0, 6],
              ['Sleep Goal', 'sleepGoal', 'hrs', 5, 10],
              ['Daily Step Goal', 'dailyStepGoal', 'steps', 1000, 30000],
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
                    {unit === '₹' ? `₹${preferences[key]}` : `${preferences[key]} ${unit}`}
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

      </div>
    </div>
  )
}
