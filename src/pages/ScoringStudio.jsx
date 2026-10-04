import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useToast } from '../context/toastContextCore'
import { calcLifeScore } from '../utils/scoreCalculator'
import ScoreRing from '../components/ui/ScoreRing'

const COMPONENTS = [
  { key: 'habits', label: 'Habits', emoji: '✅', color: '#10B981', scoreKey: 'checkpointScore' },
  { key: 'study', label: 'Study', emoji: '📚', color: '#6366F1', scoreKey: 'studyScore' },
  { key: 'finance', label: 'Finance', emoji: '💰', color: '#F59E0B', scoreKey: 'financeScore' },
  { key: 'timeflow', label: 'Time Flow', emoji: '⏳', color: '#3B82F6', scoreKey: 'wasteScore' },
  { key: 'journal', label: 'Journal / Health', emoji: '📝', color: '#EC4899', scoreKey: null },
]

const DEFAULT_WEIGHTS = {
  habits: { weight: 30, enabled: true },
  study: { weight: 25, enabled: true },
  finance: { weight: 20, enabled: true },
  timeflow: { weight: 15, enabled: true },
  journal: { weight: 10, enabled: true },
}

const PRESETS = {
  balanced: {
    label: '⚖️ Balanced',
    weights: {
      habits: { weight: 30, enabled: true },
      study: { weight: 25, enabled: true },
      finance: { weight: 20, enabled: true },
      timeflow: { weight: 15, enabled: true },
      journal: { weight: 10, enabled: true },
    },
  },
  health: {
    label: '💪 Health-focused',
    weights: {
      habits: { weight: 25, enabled: true },
      study: { weight: 13, enabled: true },
      finance: { weight: 14, enabled: true },
      timeflow: { weight: 13, enabled: true },
      journal: { weight: 35, enabled: true },
    },
  },
  hustle: {
    label: '🚀 Hustle Mode',
    weights: {
      habits: { weight: 13, enabled: true },
      study: { weight: 35, enabled: true },
      finance: { weight: 14, enabled: true },
      timeflow: { weight: 25, enabled: true },
      journal: { weight: 13, enabled: true },
    },
  },
  recovery: {
    label: '🌿 Recovery Mode',
    weights: {
      habits: { weight: 40, enabled: true },
      study: { weight: 10, enabled: true },
      finance: { weight: 10, enabled: true },
      timeflow: { weight: 10, enabled: true },
      journal: { weight: 30, enabled: true },
    },
  },
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function normalizeWeights(weights, changedKey) {
  const enabledKeys = Object.keys(weights).filter(k => weights[k].enabled && k !== changedKey)
  const changedWeight = weights[changedKey]?.enabled ? weights[changedKey].weight : 0
  const remaining = 100 - changedWeight

  if (enabledKeys.length === 0) {
    return weights
  }

  const currentEnabledTotal = enabledKeys.reduce((sum, k) => sum + weights[k].weight, 0)

  const result = deepClone(weights)

  if (currentEnabledTotal === 0) {
    const each = Math.floor(remaining / enabledKeys.length)
    let leftover = remaining - each * enabledKeys.length
    enabledKeys.forEach((k, i) => {
      result[k].weight = each + (i < leftover ? 1 : 0)
    })
  } else {
    let distributed = 0
    enabledKeys.forEach((k, i) => {
      if (i === enabledKeys.length - 1) {
        result[k].weight = remaining - distributed
      } else {
        const ratio = weights[k].weight / currentEnabledTotal
        const newW = Math.round(remaining * ratio)
        result[k].weight = newW
        distributed += newW
      }
    })
  }

  return result
}

function recalcAfterToggle(weights) {
  const enabledKeys = Object.keys(weights).filter(k => weights[k].enabled)
  if (enabledKeys.length === 0) return weights

  const result = deepClone(weights)
  const each = Math.floor(100 / enabledKeys.length)
  let leftover = 100 - each * enabledKeys.length
  enabledKeys.forEach((k, i) => {
    result[k].weight = each + (i < leftover ? 1 : 0)
  })
  Object.keys(result).forEach(k => {
    if (!result[k].enabled) result[k].weight = 0
  })
  return result
}

function computeLiveScore(baseScores, weights) {
  const enabledKeys = Object.keys(weights).filter(k => weights[k].enabled)
  const totalWeight = enabledKeys.reduce((s, k) => s + weights[k].weight, 0)
  if (totalWeight === 0) return 0

  let score = 0
  enabledKeys.forEach(k => {
    const comp = COMPONENTS.find(c => c.key === k)
    const componentScore = comp?.scoreKey ? (baseScores[comp.scoreKey] ?? 50) : 50
    score += componentScore * (weights[k].weight / totalWeight)
  })

  return Math.min(100, Math.max(0, Math.round(score)))
}

function getComponentScore(baseScores, comp) {
  if (!comp.scoreKey) return 50
  return baseScores[comp.scoreKey] ?? 50
}

export default function ScoringStudio() {
  const state = useAppState()
  const { setSettings } = useAppActions()
  const { showToast } = useToast()

  const settings = state.settings || {}
  const preferences = settings.preferences || {}
  const savedWeights = preferences.scoreWeights || null

  const [weights, setWeights] = useState(() =>
    savedWeights ? deepClone(savedWeights) : deepClone(DEFAULT_WEIGHTS)
  )
  const [activePreset, setActivePreset] = useState(null)

  const baseScores = useMemo(() => calcLifeScore(state), [state])

  const liveTotal = useMemo(() => computeLiveScore(baseScores, weights), [baseScores, weights])

  const enabledCount = Object.values(weights).filter(w => w.enabled).length
  const totalWeight = Object.values(weights).reduce((s, w) => s + (w.enabled ? w.weight : 0), 0)

  function handleSliderChange(key, value) {
    const next = deepClone(weights)
    next[key].weight = value
    const normalized = normalizeWeights(next, key)
    setWeights(normalized)
    setActivePreset(null)
  }

  function handleToggle(key) {
    const next = deepClone(weights)
    next[key].enabled = !next[key].enabled
    if (!next[key].enabled) {
      next[key].weight = 0
    }
    const normalized = recalcAfterToggle(next)
    setWeights(normalized)
    setActivePreset(null)
  }

  function applyPreset(presetKey) {
    setWeights(deepClone(PRESETS[presetKey].weights))
    setActivePreset(presetKey)
  }

  function handleSave() {
    setSettings({
      preferences: {
        scoreWeights: deepClone(weights),
      },
    })
    showToast('Score weights saved ✓', 'success')
  }

  function handleReset() {
    setWeights(deepClone(DEFAULT_WEIGHTS))
    setActivePreset('balanced')
    showToast('Weights reset to defaults', 'info')
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

  const componentBreakdown = useMemo(() => {
    return COMPONENTS.map(comp => {
      const w = weights[comp.key]
      const score = getComponentScore(baseScores, comp)
      const contribution = w.enabled ? Math.round(score * (w.weight / 100)) : 0
      return { ...comp, weight: w.weight, enabled: w.enabled, score, contribution }
    })
  }, [weights, baseScores])

  const maxBarWidth = 100

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: '800',
          fontSize: '1.4rem',
          margin: 0,
        }}>
          🎯 Scoring Studio
        </h1>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginTop: '4px',
        }}>
          Customize how your Life Score is calculated. Your rules, your system.
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginBottom: '14px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'var(--bg-secondary)',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--border)',
              fontSize: '18px',
            }}>
              🎨
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                Presets
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Quick-start with a predefined weight profile.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${activePreset === key ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: activePreset === key ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                  color: activePreset === key ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '13px',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Card>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '16px',
          alignItems: 'start',
        }}>
          <Card>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '14px',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--border)',
                fontSize: '18px',
              }}>
                ⚙️
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                  Weight Configuration
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Drag sliders to adjust. Weights auto-normalize to 100%.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {COMPONENTS.map(comp => {
                const w = weights[comp.key]
                const score = getComponentScore(baseScores, comp)
                return (
                  <div
                    key={comp.key}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: w.enabled ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      border: `1px solid ${w.enabled ? 'var(--border)' : 'var(--border)'}`,
                      opacity: w.enabled ? 1 : 0.5,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '10px',
                    }}>
                      <button
                        onClick={() => handleToggle(comp.key)}
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          border: 'none',
                          background: w.enabled ? comp.color : 'var(--border)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.25s ease',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: '3px',
                          left: w.enabled ? '21px' : '3px',
                          transition: 'left 0.25s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>

                      <span style={{ fontSize: '18px' }}>{comp.emoji}</span>
                      <span style={{
                        fontWeight: '700',
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        flex: 1,
                      }}>
                        {comp.label}
                      </span>

                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: `${comp.color}18`,
                        border: `1px solid ${comp.color}30`,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: comp.color,
                      }}>
                        Score: {score}
                      </div>

                      <div style={{
                        minWidth: '48px',
                        textAlign: 'right',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '16px',
                        fontWeight: '800',
                        color: w.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}>
                        {w.weight}%
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={w.weight}
                        disabled={!w.enabled || enabledCount < 2}
                        onChange={e => handleSliderChange(comp.key, Number(e.target.value))}
                        style={{
                          flex: 1,
                          accentColor: comp.color,
                          cursor: w.enabled ? 'pointer' : 'not-allowed',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {totalWeight !== 100 && enabledCount > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.22)',
                fontSize: '12px',
                color: '#F43F5E',
                fontWeight: '600',
              }}>
                ⚠️ Total weight is {totalWeight}%. It should be exactly 100%.
              </div>
            )}
          </Card>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            position: 'sticky',
            top: '90px',
          }}>
            <Card>
              <div style={{ textAlign: 'center', padding: '10px 20px' }}>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '12px',
                }}>
                  Live Preview
                </div>
                <ScoreRing score={liveTotal} size={140} label="Today" />
                <div style={{
                  marginTop: '14px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                }}>
                  Score updates as you<br />adjust weights
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginBottom: '14px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'var(--bg-secondary)',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--border)',
              fontSize: '18px',
            }}>
              🔍
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                Why this number?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                See exactly how each component contributes to your final score.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {componentBreakdown.map(item => (
              <div key={item.key} style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 60px',
                gap: '12px',
                alignItems: 'center',
                opacity: item.enabled ? 1 : 0.35,
                transition: 'opacity 0.25s ease',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontSize: '16px' }}>{item.emoji}</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                  }}>
                    {item.label}
                  </span>
                </div>

                <div style={{
                  height: '24px',
                  borderRadius: '6px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${item.enabled ? (item.contribution / maxBarWidth) * 100 : 0}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${item.color}40, ${item.color})`,
                    borderRadius: '5px',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                  }}>
                    {item.contribution > 3 && (
                      <span style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: '#fff',
                        fontFamily: 'JetBrains Mono, monospace',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}>
                        {item.score} × {item.weight}%
                      </span>
                    )}
                  </div>
                </div>

                <div style={{
                  textAlign: 'right',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: item.enabled ? item.color : 'var(--text-muted)',
                }}>
                  +{item.contribution}
                </div>
              </div>
            ))}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr 60px',
              gap: '12px',
              alignItems: 'center',
              marginTop: '6px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '800',
                color: 'var(--text-primary)',
              }}>
                Total
              </div>
              <div />
              <div style={{
                textAlign: 'right',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '16px',
                fontWeight: '800',
                color: liveTotal >= 80 ? '#10B981' : liveTotal >= 50 ? '#F59E0B' : '#F43F5E',
              }}>
                {liveTotal}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginBottom: '14px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'var(--bg-secondary)',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--border)',
              fontSize: '18px',
            }}>
              📊
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                Weight Distribution
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Visual breakdown of your scoring formula.
              </div>
            </div>
          </div>

          <div style={{
            height: '32px',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
          }}>
            {COMPONENTS.map(comp => {
              const w = weights[comp.key]
              if (!w.enabled || w.weight === 0) return null
              return (
                <div
                  key={comp.key}
                  title={`${comp.label}: ${w.weight}%`}
                  style={{
                    width: `${w.weight}%`,
                    height: '100%',
                    background: `linear-gradient(135deg, ${comp.color}, ${comp.color}cc)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                  }}
                >
                  {w.weight >= 10 && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#fff',
                      fontFamily: 'JetBrains Mono, monospace',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      whiteSpace: 'nowrap',
                    }}>
                      {comp.emoji} {w.weight}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            marginTop: '12px',
            justifyContent: 'center',
          }}>
            {COMPONENTS.map(comp => {
              const w = weights[comp.key]
              return (
                <div key={comp.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: w.enabled ? 1 : 0.35,
                  transition: 'opacity 0.25s ease',
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '3px',
                    background: comp.color,
                  }} />
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: '600',
                  }}>
                    {comp.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingBottom: '24px' }}>
          <Button variant="secondary" onClick={handleReset}>
            ↺ Reset to Default
          </Button>
          <Button onClick={handleSave}>
            💾 Save Weights
          </Button>
        </div>

      </div>
    </div>
  )
}
