import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send } from 'lucide-react'
import { Page, Card, Button, Field, EmptyState } from '../ui/index'
import { useAppState, useAppActions } from '../context/appHooks'

const EMPTY_MESSAGES = []

export default function AskLifeOS() {
  const state = useAppState()
  const { patchModule } = useAppActions()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)

  const messages = state.ai?.chatHistory || state.aiChat?.messages || EMPTY_MESSAGES

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    }

    const newMessages = [...messages, userMsg]
    
    // Save user message immediately
    if (state.ai) {
      patchModule('ai', { chatHistory: newMessages })
    } else {
      patchModule('aiChat', { messages: newMessages })
    }

    setInput('')
    setLoading(true)

    // Mock response
    setTimeout(() => {
      const aiMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I am your LifeOS assistant. The AI backend is not yet fully connected.',
        createdAt: new Date().toISOString()
      }
      
      const finalMessages = [...newMessages, aiMsg]
      if (state.ai) {
        patchModule('ai', { chatHistory: finalMessages })
      } else {
        patchModule('aiChat', { messages: finalMessages })
      }
      setLoading(false)
    }, 800)
  }

  return (
    <Page title="Ask LifeOS" icon={Sparkles}>
      <Card
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'min(800px, calc(100vh - 180px))'
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                icon={Sparkles}
                title="How can I help you today?"
                description="Ask me about your data, habits, or routines."
              />
            </div>
          ) : (
            messages.map(msg => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    background: isUser ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
                    color: isUser ? '#fff' : 'var(--text-1)',
                    borderBottomRightRadius: isUser ? '4px' : '16px',
                    borderBottomLeftRadius: isUser ? '16px' : '4px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.content}
                </div>
              )
            })
          )}
          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '12px 16px',
                borderRadius: '16px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-2)',
                borderBottomLeftRadius: '4px'
              }}
            >
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'blink 1.4s infinite both' }} />
                <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'blink 1.4s infinite both', animationDelay: '0.2s' }} />
                <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'blink 1.4s infinite both', animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <Field
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message LifeOS..."
              onKeyDown={e => {
                if (e.key === 'Enter') handleSend()
              }}
            />
          </div>
          <Button variant="primary" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send size={18} />
          </Button>
        </div>
      </Card>
      
      <style>{`
        @keyframes blink {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
      `}</style>
    </Page>
  )
}
