

import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Send, Sparkles, Bot, User, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getGeminiApiKey } from '../services/geminiService'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

function getLast30DaysSummary(state) {
  const expenses = state.finance?.expenses || []
  const studySessions = state.study?.sessions || []
  const timeEntries = state.timeflow?.entries || []
  const checkpoints = state.habits?.checkpoints || []
  const habitLogs = state.habits?.dailyLogs || []
  const healthLogs = state.health?.manualLogs || []
  const journalEntries = state.journal?.entries || []

  const cutoff = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  const last30Expenses = expenses.filter(e => e.date >= cutoff)
  const last30Study = studySessions.filter(s => s.date >= cutoff)
  const last30Time = timeEntries.filter(t => t.date >= cutoff)
  const last30Health = healthLogs.filter(h => h.date >= cutoff)
  const last30Journal = journalEntries.filter(j => j.date >= cutoff)
  const last30HabitLogs = habitLogs.filter(h => h.date >= cutoff)

  const totalSpend = last30Expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0)

  const spendByCategory = {}
  last30Expenses.forEach(e => {
    const cat = e.category || 'Other'
    spendByCategory[cat] = (spendByCategory[cat] || 0) + (Number(e.amount) || 0)
  })

  const totalStudyMinutes = last30Study.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)

  const subjectHours = {}
  last30Study.forEach(s => {
    const sub = s.subject || 'Other'
    subjectHours[sub] = (subjectHours[sub] || 0) + (Number(s.durationMinutes) || 0) / 60
  })

  const wasteMinutes = last30Time
    .filter(t => t.isWaste)
    .reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0)

  const productiveMinutes = last30Time
    .filter(t => !t.isWaste)
    .reduce((a, t) => a + (Number(t.durationMinutes) || 0), 0)

  const completedHabitLogs = last30HabitLogs.filter(log => log.status === 'done').length
  const possibleHabitLogs = last30HabitLogs.length || checkpoints.length * 30

  const stepLogs = last30Health.filter(h => h.steps)
  const sleepLogs = last30Health.filter(h => h.sleepHours)
  const moodLogs = last30Journal.filter(j => j.dayRating)

  const avgSteps = stepLogs.length
    ? Math.round(stepLogs.reduce((a, h) => a + (Number(h.steps) || 0), 0) / stepLogs.length)
    : null

  const avgSleep = sleepLogs.length
    ? +(sleepLogs.reduce((a, h) => a + (Number(h.sleepHours) || 0), 0) / sleepLogs.length).toFixed(1)
    : null

  const avgMood = moodLogs.length
    ? +(moodLogs.reduce((a, j) => a + (Number(j.dayRating) || 0), 0) / moodLogs.length).toFixed(1)
    : null

  return {
    finance: {
      totalSpend: Math.round(totalSpend),
      transactionCount: last30Expenses.length,
      topCategories: Object.entries(spendByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    },
    study: {
      totalHours: +(totalStudyMinutes / 60).toFixed(1),
      sessionCount: last30Study.length,
      subjects: Object.entries(subjectHours)
        .map(([subject, hours]) => ({ subject, hours: +hours.toFixed(1) }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 6),
    },
    timeflow: {
      productiveHours: +(productiveMinutes / 60).toFixed(1),
      wasteHours: +(wasteMinutes / 60).toFixed(1),
      entryCount: last30Time.length,
    },
    habits: {
      completionRate: possibleHabitLogs
        ? Math.round((completedHabitLogs / possibleHabitLogs) * 100)
        : 0,
      activeHabits: checkpoints.length,
    },
    health: {
      avgSteps,
      avgSleep,
      logCount: last30Health.length,
    },
    journal: {
      avgMood,
      entryCount: last30Journal.length,
    },
  }
}

const GREETINGS = ['hi', 'hello', 'hey', 'hii', 'namaste', 'hola']

function isGreeting(text) {
  return GREETINGS.includes(text.trim().toLowerCase())
}

function isDataQuestion(text) {
  const q = text.trim().toLowerCase()
  return (
    q.includes('?') ||
    /how much|average|when|which|what|who|best|worst|trend|compare|spend|study|sleep|habit|waste|steps|mood|journal|time/i.test(q)
  )
}

function buildGeminiPrompt(question, summary) {
  return `
You are a personal life analytics assistant inside Life OS.

Rules:
- Answer ONLY the user's question.
- Use ONLY the provided data summary.
- Be specific, concise, and practical.
- If the data is insufficient, say so clearly.
- Do NOT mention policies or that you are an AI.
- Do NOT invent numbers.
- If the user just greets or says something non-question, reply briefly and friendly.

USER QUESTION:
${question}

DATA SUMMARY JSON:
${JSON.stringify(summary, null, 2)}
`
}


async function askGemini(question, summary) {
  const apiKey = getGeminiApiKey()

  if (!apiKey) return null

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildGeminiPrompt(question, summary) }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        },
      }),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Gemini request failed')
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || ''

  return text || null
}

const STARTERS = [
  'How much did I spend last month?',
  'How much waste time did I log?',
  'What are my top study subjects?',
  'What is my habit completion rate?',
  'How is my sleep doing lately?',
]

export default function AIChat() {
  const { state, patchModule } = useApp()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const messages = state.aiChat?.messages || []
  const summary = useMemo(() => getLast30DaysSummary(state), [state])

  async function sendMessage(text) {
    const question = (text || input).trim()
    if (!question || loading) return

    const currentMessages = state.aiChat?.messages || []

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    }

    if (isGreeting(question)) {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Hey! Ask me something about your data, like spending, study, sleep, habits, or journal trends.',
        createdAt: new Date().toISOString(),
      }

      patchModule('aiChat', { messages: [...currentMessages, userMsg, aiMsg] })
      setInput('')
      return
    }

    if (!isDataQuestion(question)) {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'I can help with questions about your own data. Try asking things like “What did I spend most on?” or “How much did I study this week?”',
        createdAt: new Date().toISOString(),
      }

      patchModule('aiChat', { messages: [...currentMessages, userMsg, aiMsg] })
      setInput('')
      return
    }

    setLoading(true)
    patchModule('aiChat', { messages: [...currentMessages, userMsg] })

    try {
      const reply = await askGemini(question, summary)

      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          reply ||
          `Here is your 30-day snapshot: ₹${summary.finance.totalSpend} spent, ${summary.study.totalHours} study hours, ${summary.timeflow.productiveHours} productive hours, ${summary.timeflow.wasteHours} waste hours, ${summary.habits.completionRate}% habit completion, average sleep ${summary.health.avgSleep ?? 'N/A'} hours, and average journal rating ${summary.journal.avgMood ?? 'N/A'}/5.`,
        createdAt: new Date().toISOString(),
      }

      const latestMessages = state.aiChat?.messages || []
      const hasUserMsg = latestMessages.some(m => m.id === userMsg.id)

      patchModule('aiChat', {
        messages: hasUserMsg
          ? [...latestMessages, aiMsg]
          : [...latestMessages, userMsg, aiMsg],
      })
    } catch (error) {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Gemini request failed: ${error.message}`,
        createdAt: new Date().toISOString(),
      }

      const latestMessages = state.aiChat?.messages || []
      const hasUserMsg = latestMessages.some(m => m.id === userMsg.id)

      patchModule('aiChat', {
        messages: hasUserMsg
          ? [...latestMessages, aiMsg]
          : [...latestMessages, userMsg, aiMsg],
      })
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  function clearChat() {
    if (!window.confirm('Clear all chat messages?')) return
    patchModule('aiChat', { messages: [] })
  }

  return (
    <div
      style={{
        maxWidth: '980px',
        margin: '0 auto',
        height: 'calc(100vh - 88px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '20px 24px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: '800',
              fontSize: '1.4rem',
              margin: 0,
            }}
          >
            🤖 AI Chat
          </h1>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Ask questions about your finance, study, health, habits, time flow, and journal data.
          </div>
        </div>

        <Button variant="secondary" onClick={clearChat}>
          <Trash2 size={14} /> Clear
        </Button>
      </div>

      <div style={{ padding: '16px 24px 0' }}>
        <Card>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Spend</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#10B981',
                }}
              >
                ₹{summary.finance.totalSpend}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Study</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#3B82F6',
                }}
              >
                {summary.study.totalHours}h
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Habits</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#6366F1',
                }}
              >
                {summary.habits.completionRate}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div
        style={{
          padding: '16px 24px 0',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {STARTERS.map(starter => (
          <button
            key={starter}
            onClick={() => sendMessage(starter)}
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <Sparkles
              size={12}
              style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }}
            />
            {starter}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '44px 20px' }}>
              <div style={{ fontSize: '42px', marginBottom: '10px' }}>💬</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                No messages yet
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ask something like “What did I spend most on?” or “How much did I study this month?”
              </div>
            </div>
          </Card>
        ) : (
          messages.map(msg => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  background: isUser ? 'var(--accent-indigo)' : 'var(--bg-card)',
                  color: isUser ? '#fff' : 'var(--text-primary)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                    fontSize: '12px',
                    opacity: 0.9,
                  }}
                >
                  {isUser ? <User size={13} /> : <Bot size={13} />}
                  <span>{isUser ? 'You' : 'Life OS AI'}</span>
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            )
          })
        )}

        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '78%',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '6px' }}>
              Life OS AI
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Thinking...</div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '10px',
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask about your data..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />

          <button
            disabled={loading}
            onClick={() => sendMessage()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              background: loading ? 'var(--text-muted)' : 'var(--accent-indigo)',
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}