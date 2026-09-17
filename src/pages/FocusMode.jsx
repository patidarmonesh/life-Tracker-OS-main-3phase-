import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play, Square, Volume2, VolumeX, Headphones, RotateCcw,
  Radio, Flower2, Waves, Wind, CloudRain,
  Brain, Heart, Zap, Flame, Bell,
  Save, Trash2, X, Plus, Check,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════
   AUDIO BUFFER GENERATORS — All sounds are synthesized in-browser
   ═══════════════════════════════════════════════════════════════════ */

function createWhiteNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function createPinkNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  return buf
}

function createBrownNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    d[i] = (last + 0.02 * w) / 1.02
    last = d[i]
    d[i] *= 3.5
  }
  return buf
}

function createWindBuffer(ctx) {
  const len = ctx.sampleRate * 6
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    const lfo =
      0.5 +
      0.3 * Math.sin((2 * Math.PI * 0.2 * i) / ctx.sampleRate) +
      0.2 * Math.sin((2 * Math.PI * 0.07 * i) / ctx.sampleRate)
    d[i] = last * lfo * 3.5
  }
  return buf
}

function createIsochronicBuffer(ctx, pulseHz = 10) {
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  const carrier = 200
  const perPulse = Math.floor(ctx.sampleRate / pulseHz)
  const onSamples = Math.floor(perPulse * 0.5)
  const fade = Math.min(Math.floor(onSamples * 0.15), 80)
  for (let i = 0; i < len; i++) {
    const pos = i % perPulse
    if (pos < onSamples) {
      let env = 1
      if (pos < fade) env = pos / fade
      else if (pos > onSamples - fade) env = (onSamples - pos) / fade
      d[i] = Math.sin((2 * Math.PI * carrier * i) / ctx.sampleRate) * env
    } else {
      d[i] = 0
    }
  }
  return buf
}

/* ═══════════════════════════════════════════════════════════════════
   CHANNEL & PRESET DEFINITIONS
   ═══════════════════════════════════════════════════════════════════ */

const NOISE_CHANNELS = [
  { id: 'white', label: 'White', icon: Radio, color: '#94A3B8', desc: 'TV static · blocks speech' },
  { id: 'pink', label: 'Pink', icon: Flower2, color: '#F472B6', desc: 'Steady rain · smooth' },
  { id: 'brown', label: 'Brown', icon: Waves, color: '#A78BFA', desc: 'Deep waterfall · thunder' },
  { id: 'wind', label: 'Wind', icon: Wind, color: '#34D399', desc: 'Natural broadband' },
  { id: 'rain', label: 'Rain', icon: CloudRain, color: '#60A5FA', desc: 'Pleasant rainfall' },
]

const BEAT_CHANNELS = [
  { id: 'theta', label: 'Theta', icon: Brain, color: '#8B5CF6', desc: 'Relaxation · 4–8 Hz', defaultHz: 6 },
  { id: 'alpha', label: 'Alpha', icon: Heart, color: '#06B6D4', desc: 'Calm alertness · 8–12 Hz', defaultHz: 10 },
  { id: 'beta', label: 'Beta', icon: Zap, color: '#F59E0B', desc: 'Concentration · 15–20 Hz', defaultHz: 16 },
  { id: 'gamma', label: 'Gamma', icon: Flame, color: '#EF4444', desc: 'High attention · 40 Hz', defaultHz: 40 },
  { id: 'isochronic', label: 'Isochronic', icon: Bell, color: '#EC4899', desc: 'Rhythmic pulses', defaultHz: 10 },
]

const ALL_IDS = [...NOISE_CHANNELS, ...BEAT_CHANNELS].map((c) => c.id)
const ZERO_VOLS = Object.fromEntries(ALL_IDS.map((id) => [id, 0]))
const ZERO_MUTE = Object.fromEntries(ALL_IDS.map((id) => [id, false]))
const DEFAULT_HZ = { theta: 6, alpha: 10, beta: 16, gamma: 40, isochronic: 10 }

const CUSTOM_PRESETS_KEY = 'lifeos-focus-custom-presets'
const CUSTOM_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#F97316', '#84CC16']

function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCustomPresets(presets) {
  try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets)) } catch { /* full */ }
}

const PRESETS = [
  {
    id: 'lecture',
    name: 'Lecture Mode',
    icon: '🎓',
    color: '#3B82F6',
    tag: 'Recommended',
    goal: 'Hear lecturer clearly · Block people talking · Stay awake',
    mix: { brown: 15, pink: 10, beta: 5 },
    why: 'Brown/pink noise masks nearby conversations while beta beats maintain alertness. Lecture remains much louder than masking.',
    tip: "If people are very loud → Brown 20 %, Pink 10 %, Beta 5 %. Don't exceed ~35 % total masking.",
  },
  {
    id: 'deep-study',
    name: 'Deep Study',
    icon: '💻',
    color: '#8B5CF6',
    goal: 'Coding · Reading · Problem solving · No lecture',
    mix: { brown: 60, pink: 30, beta: 10 },
    why: 'Brown noise handles masking. Pink adds texture. Beta beats add alertness without overstimulation.',
  },
  {
    id: 'max-focus',
    name: 'Maximum Focus',
    icon: '🎯',
    color: '#EF4444',
    goal: 'Need to lock in · Tired · Must stay awake',
    mix: { brown: 50, white: 20, gamma: 10, beta: 20 },
    beatHz: { beta: 18 },
    why: 'Most aggressive focus setup. Gamma stimulation shows attention benefits (emerging evidence).',
  },
  {
    id: 'marathon',
    name: '6-Hour Marathon',
    icon: '⏱️',
    color: '#10B981',
    goal: 'No fatigue · No headache · Full day studying',
    mix: { brown: 70, pink: 30 },
    why: 'No beats at all. The simpler the soundscape, the easier for the brain to ignore it.',
  },
  {
    id: 'adhd',
    name: 'ADHD Focus',
    icon: '⚡',
    color: '#F59E0B',
    goal: 'Help with attention difficulties',
    mix: { white: 40, brown: 40, beta: 20 },
    why: 'White/brown noise increases signal-to-noise ratio in the brain. Some evidence supports attention improvements.',
  },
]

/* ═══════════════════════════════════════════════════════════════════
   CHANNEL FADER — Custom vertical slider with pointer-capture drag
   ═══════════════════════════════════════════════════════════════════ */

function ChannelFader({ value, onChange, muted, onMuteToggle, color, label, icon: Icon, desc, hz }) {
  const trackRef = useRef(null)

  const valFromY = (clientY) => {
    if (!trackRef.current) return value
    const r = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(100, Math.round(100 - ((clientY - r.top) / r.height) * 100)))
  }

  const onDown = (e) => {
    e.preventDefault()
    trackRef.current?.setPointerCapture(e.pointerId)
    onChange(valFromY(e.clientY))
  }
  const onMove = (e) => {
    if (!trackRef.current?.hasPointerCapture(e.pointerId)) return
    onChange(valFromY(e.clientY))
  }
  const onUp = (e) => {
    trackRef.current?.releasePointerCapture(e.pointerId)
  }

  const dv = muted ? 0 : value

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '14px 10px 10px',
        borderRadius: 16,
        background: dv > 0 ? `${color}08` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${dv > 0 ? color + '30' : 'var(--border)'}`,
        minWidth: 76,
        width: 86,
        transition: 'all 0.2s ease',
      }}
    >
      <Icon size={18} style={{ color: dv > 0 ? color : 'var(--text-muted)', transition: 'color 0.2s' }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: dv > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          transition: 'color 0.2s',
        }}
      >
        {label}
      </span>
      {hz != null && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.04em',
          }}
        >
          {hz} Hz
        </span>
      )}

      {/* ── Vertical Track ── */}
      <div
        ref={trackRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{
          width: 8,
          height: 130,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.08)',
          position: 'relative',
          cursor: 'pointer',
          touchAction: 'none',
          margin: '4px 0',
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${dv}%`,
            borderRadius: 4,
            background: `linear-gradient(to top, ${color}bb, ${color})`,
            transition: 'height 0.06s linear',
            boxShadow: dv > 0 ? `0 0 10px ${color}25` : 'none',
          }}
        />
        {/* Thumb */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: `${dv}%`,
            transform: 'translate(-50%, 50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            border: `3px solid ${dv > 0 ? color : 'rgba(148,163,184,0.3)'}`,
            boxShadow:
              dv > 0
                ? `0 0 8px ${color}35, 0 2px 6px rgba(0,0,0,0.3)`
                : '0 1px 4px rgba(0,0,0,0.25)',
            transition: 'bottom 0.06s linear, border-color 0.2s',
            zIndex: 2,
          }}
        />
      </div>

      {/* Value */}
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
          color: dv > 0 ? color : 'var(--text-muted)',
          minWidth: 34,
          textAlign: 'center',
        }}
      >
        {dv}%
      </span>

      {/* Mute */}
      <button
        onClick={onMuteToggle}
        title={muted ? 'Unmute' : 'Mute'}
        aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
        style={{
          background: muted ? `${color}18` : 'rgba(255,255,255,0.04)',
          border: 'none',
          borderRadius: 8,
          padding: 5,
          cursor: 'pointer',
          color: muted ? color : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>

      {/* Desc */}
      <span
        style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: 1.3,
          opacity: 0.6,
          maxWidth: 76,
        }}
      >
        {desc}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   WAVEFORM VISUALIZER — AnalyserNode → Canvas
   ═══════════════════════════════════════════════════════════════════ */

function WaveformVisualizer({ analyserRef, isPlaying }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const c = cvs.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = cvs.getBoundingClientRect()
    cvs.width = rect.width * dpr
    cvs.height = rect.height * dpr
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height

    if (!isPlaying || !analyserRef.current) {
      c.clearRect(0, 0, W, H)
      c.strokeStyle = 'rgba(99,102,241,0.15)'
      c.lineWidth = 1.5
      c.beginPath()
      c.moveTo(0, H / 2)
      c.lineTo(W, H / 2)
      c.stroke()
      return
    }

    const an = analyserRef.current
    an.fftSize = 2048
    const bl = an.frequencyBinCount
    const data = new Uint8Array(bl)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      an.getByteTimeDomainData(data)
      c.clearRect(0, 0, W, H)

      const g = c.createLinearGradient(0, 0, W, 0)
      g.addColorStop(0, '#6366F1')
      g.addColorStop(0.4, '#8B5CF6')
      g.addColorStop(0.7, '#06B6D4')
      g.addColorStop(1, '#10B981')

      c.lineWidth = 2
      c.strokeStyle = g
      c.beginPath()
      const sw = W / bl
      let x = 0
      for (let i = 0; i < bl; i++) {
        const y = (data[i] / 128.0) * (H / 2)
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
        x += sw
      }
      c.lineTo(W, H / 2)
      c.stroke()

      // Subtle glow
      c.lineWidth = 5
      c.strokeStyle = 'rgba(99,102,241,0.06)'
      c.stroke()
    }
    draw()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, analyserRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: 70,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        display: 'block',
      }}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════════
   FOCUS MODE PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function FocusMode() {
  /* ── State ── */
  const [volumes, setVolumes] = useState({ ...ZERO_VOLS })
  const [muted, setMuted] = useState({ ...ZERO_MUTE })
  const [masterVolume, setMasterVolume] = useState(80)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activePreset, setActivePreset] = useState(null)
  const [beatFreqs, setBeatFreqs] = useState({ ...DEFAULT_HZ })

  /* ── Custom Presets ── */
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets())
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveColor, setSaveColor] = useState(CUSTOM_COLORS[0])
  const [saveIcon, setSaveIcon] = useState('🎵')

  /* ── Audio Refs ── */
  const audioCtxRef = useRef(null)
  const masterGainRef = useRef(null)
  const analyserRef = useRef(null)
  const nodesRef = useRef({})

  // Keep refs in sync so audio callbacks always read latest values
  const volsR = useRef(volumes)
  const mutR = useRef(muted)
  const mvR = useRef(masterVolume)
  const hzR = useRef(beatFreqs)
  useEffect(() => { volsR.current = volumes }, [volumes])
  useEffect(() => { mutR.current = muted }, [muted])
  useEffect(() => { mvR.current = masterVolume }, [masterVolume])
  useEffect(() => { hzR.current = beatFreqs }, [beatFreqs])

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) audioCtxRef.current = new AC()
    }
    return audioCtxRef.current
  }, [])

  /* ── Stop all audio ── */
  const stopAll = useCallback(() => {
    const n = nodesRef.current
    Object.values(n).forEach((node) => {
      if (node.source) try { node.source.stop() } catch { /* already stopped */ }
      if (node.oscL) try { node.oscL.stop() } catch { /* already stopped */ }
      if (node.oscR) try { node.oscR.stop() } catch { /* already stopped */ }
    })
    nodesRef.current = {}
    masterGainRef.current = null
    analyserRef.current = null
    setIsPlaying(false)
  }, [])

  /* ── Start all audio ── */
  const startAll = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const v = volsR.current
    const m = mutR.current
    const mv = mvR.current
    const hz = hzR.current

    // Master chain: channels → masterGain → analyser → destination
    const mg = ctx.createGain()
    mg.gain.value = mv / 100
    masterGainRef.current = mg

    const an = ctx.createAnalyser()
    an.fftSize = 2048
    analyserRef.current = an

    mg.connect(an)
    an.connect(ctx.destination)

    const nodes = {}

    // Helper — buffer-based channel
    const bufCh = (id, buffer) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const g = ctx.createGain()
      g.gain.value = m[id] ? 0 : v[id] / 100
      src.connect(g)
      g.connect(mg)
      src.start()
      return { source: src, gain: g }
    }

    // Noise channels
    nodes.white = bufCh('white', createWhiteNoiseBuffer(ctx))
    nodes.pink = bufCh('pink', createPinkNoiseBuffer(ctx))
    nodes.brown = bufCh('brown', createBrownNoiseBuffer(ctx))
    nodes.wind = bufCh('wind', createWindBuffer(ctx))

    // Rain — white noise + bandpass filter
    const rSrc = ctx.createBufferSource()
    rSrc.buffer = createWhiteNoiseBuffer(ctx)
    rSrc.loop = true
    const rFilt = ctx.createBiquadFilter()
    rFilt.type = 'bandpass'
    rFilt.frequency.value = 1000
    rFilt.Q.value = 0.8
    const rGain = ctx.createGain()
    rGain.gain.value = m.rain ? 0 : v.rain / 100
    rSrc.connect(rFilt)
    rFilt.connect(rGain)
    rGain.connect(mg)
    rSrc.start()
    nodes.rain = { source: rSrc, gain: rGain, filter: rFilt }

    // Helper — binaural beat channel
    const BASE_FREQ = 200
    const binCh = (id, beatHz) => {
      const oL = ctx.createOscillator()
      oL.type = 'sine'
      oL.frequency.value = BASE_FREQ
      const oR = ctx.createOscillator()
      oR.type = 'sine'
      oR.frequency.value = BASE_FREQ + beatHz
      const pL = ctx.createStereoPanner()
      pL.pan.value = -1
      const pR = ctx.createStereoPanner()
      pR.pan.value = 1
      const g = ctx.createGain()
      g.gain.value = m[id] ? 0 : v[id] / 100
      oL.connect(pL)
      pL.connect(g)
      oR.connect(pR)
      pR.connect(g)
      g.connect(mg)
      oL.start()
      oR.start()
      return { oscL: oL, oscR: oR, gain: g }
    }

    nodes.theta = binCh('theta', hz.theta)
    nodes.alpha = binCh('alpha', hz.alpha)
    nodes.beta = binCh('beta', hz.beta)
    nodes.gamma = binCh('gamma', hz.gamma)

    // Isochronic tones
    nodes.isochronic = bufCh('isochronic', createIsochronicBuffer(ctx, hz.isochronic))

    nodesRef.current = nodes
    setIsPlaying(true)
  }, [getCtx])

  const togglePlay = useCallback(() => {
    if (isPlaying) stopAll()
    else startAll()
  }, [isPlaying, startAll, stopAll])

  /* ── Sync channel volumes → audio graph ── */
  useEffect(() => {
    if (!isPlaying) return
    const ctx = audioCtxRef.current
    const n = nodesRef.current
    if (!ctx || !n) return
    ALL_IDS.forEach((ch) => {
      const gn = n[ch]?.gain
      if (gn) {
        const target = muted[ch] ? 0 : volumes[ch] / 100
        gn.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.04)
      }
    })
  }, [volumes, muted, isPlaying])

  /* ── Sync master volume ── */
  useEffect(() => {
    const ctx = audioCtxRef.current
    if (!masterGainRef.current || !ctx) return
    masterGainRef.current.gain.linearRampToValueAtTime(masterVolume / 100, ctx.currentTime + 0.04)
  }, [masterVolume])

  /* ── Sync binaural beat frequencies ── */
  useEffect(() => {
    if (!isPlaying) return
    const ctx = audioCtxRef.current
    const n = nodesRef.current
    if (!ctx || !n) return
    const BASE = 200
    ;['theta', 'alpha', 'beta', 'gamma'].forEach((ch) => {
      if (n[ch]?.oscL && n[ch]?.oscR) {
        n[ch].oscL.frequency.setValueAtTime(BASE, ctx.currentTime)
        n[ch].oscR.frequency.setValueAtTime(BASE + beatFreqs[ch], ctx.currentTime)
      }
    })
  }, [beatFreqs, isPlaying])

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const n = nodesRef.current
      Object.values(n).forEach((node) => {
        if (node.source) try { node.source.stop() } catch { /* noop */ }
        if (node.oscL) try { node.oscL.stop() } catch { /* noop */ }
        if (node.oscR) try { node.oscR.stop() } catch { /* noop */ }
      })
      nodesRef.current = {}
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [])

  /* ── Handlers ── */
  const chgVol = useCallback((ch, v) => {
    setVolumes((p) => ({ ...p, [ch]: v }))
    setActivePreset(null)
  }, [])

  const chgMute = useCallback((ch) => {
    setMuted((p) => ({ ...p, [ch]: !p[ch] }))
    setActivePreset(null)
  }, [])

  const loadPreset = useCallback((pr) => {
    const nv = { ...ZERO_VOLS }
    Object.entries(pr.mix).forEach(([k, val]) => { nv[k] = val })
    setVolumes(nv)
    setMuted({ ...ZERO_MUTE })
    setBeatFreqs(pr.beatHz ? { ...DEFAULT_HZ, ...pr.beatHz } : { ...DEFAULT_HZ })
    setActivePreset(pr.id)
  }, [])

  const resetAll = useCallback(() => {
    setVolumes({ ...ZERO_VOLS })
    setMuted({ ...ZERO_MUTE })
    setBeatFreqs({ ...DEFAULT_HZ })
    setMasterVolume(80)
    setActivePreset(null)
  }, [])

  /* ── Custom Preset Handlers ── */
  const saveCurrentAsPreset = useCallback(() => {
    if (!saveName.trim()) return
    const activeMix = {}
    ALL_IDS.forEach((ch) => {
      if (volumes[ch] > 0 && !muted[ch]) activeMix[ch] = volumes[ch]
    })
    if (Object.keys(activeMix).length === 0) return

    const hasCustomHz = Object.entries(beatFreqs).some(([k, v]) => v !== DEFAULT_HZ[k])
    const newPreset = {
      id: 'custom-' + Date.now(),
      name: saveName.trim(),
      icon: saveIcon,
      color: saveColor,
      goal: Object.entries(activeMix).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} ${v}%`).join(' · '),
      mix: activeMix,
      why: 'Your custom mix.',
      custom: true,
      ...(hasCustomHz ? { beatHz: { ...beatFreqs } } : {}),
    }
    const updated = [...customPresets, newPreset]
    setCustomPresets(updated)
    saveCustomPresets(updated)
    setActivePreset(newPreset.id)
    setShowSaveModal(false)
    setSaveName('')
  }, [saveName, saveIcon, saveColor, volumes, muted, beatFreqs, customPresets])

  const deleteCustomPreset = useCallback((presetId) => {
    const updated = customPresets.filter((p) => p.id !== presetId)
    setCustomPresets(updated)
    saveCustomPresets(updated)
    if (activePreset === presetId) setActivePreset(null)
  }, [customPresets, activePreset])

  const allPresets = [...PRESETS, ...customPresets]

  /* ── Computed ── */
  const activeCount = ALL_IDS.filter((ch) => !muted[ch] && volumes[ch] > 0).length
  const totalMix = ALL_IDS.reduce((s, ch) => s + (muted[ch] ? 0 : volumes[ch]), 0)

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #06B6D4, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(99,102,241,0.25)',
            }}
          >
            <Headphones size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, margin: 0 }}>
              Focus Mode
            </h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Scientific sound mixer for deep focus
            </span>
          </div>
        </div>
        <button
          onClick={resetAll}
          title="Reset all channels"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '8px 14px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* ── Presets ── */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 10,
            opacity: 0.7,
          }}
        >
          Presets
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {allPresets.map((pr) => {
            const active = activePreset === pr.id
            return (
              <button
                key={pr.id}
                onClick={() => loadPreset(pr)}
                style={{
                  minWidth: active ? 260 : 195,
                  maxWidth: 320,
                  padding: '14px 18px',
                  borderRadius: 16,
                  border: active ? `2px solid ${pr.color}` : '1px solid var(--border)',
                  background: active ? `${pr.color}12` : 'rgba(255,255,255,0.03)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  flexShrink: 0,
                  transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                  boxShadow: active ? `0 0 28px ${pr.color}18` : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {pr.tag && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: pr.color,
                      background: `${pr.color}18`,
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    {pr.tag}
                  </span>
                )}
                {pr.custom && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: pr.color,
                      background: `${pr.color}18`,
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    Custom
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{pr.icon}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: active ? pr.color : 'var(--text-primary)',
                      transition: 'color 0.2s',
                    }}
                  >
                    {pr.name}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {pr.goal}
                </span>
                {active && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                      borderLeft: `3px solid ${pr.color}40`,
                    }}
                  >
                    💡 {pr.why}
                    {pr.tip && (
                      <div style={{ marginTop: 6, color: 'var(--accent-amber)', fontWeight: 600 }}>
                        ⚠️ {pr.tip}
                      </div>
                    )}
                  </div>
                )}
                {/* Delete button for custom presets */}
                {pr.custom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCustomPreset(pr.id)
                    }}
                    title="Delete preset"
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 10,
                      background: 'rgba(239,68,68,0.12)',
                      border: 'none',
                      borderRadius: 8,
                      padding: 5,
                      cursor: 'pointer',
                      color: '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </button>
            )
          })}

          {/* ── Save Current Mix Button ── */}
          <button
            onClick={() => {
              const hasActive = ALL_IDS.some((ch) => !muted[ch] && volumes[ch] > 0)
              if (hasActive) setShowSaveModal(true)
            }}
            title="Save current mix as a custom preset"
            style={{
              minWidth: 80,
              padding: '14px 18px',
              borderRadius: 16,
              border: '2px dashed rgba(148,163,184,0.25)',
              background: 'rgba(255,255,255,0.02)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={22} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Save Mix</span>
          </button>
        </div>
      </section>

      {/* ── Save Preset Modal ── */}
      {showSaveModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowSaveModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 200,
              animation: 'modalBackdropFadeIn 0.2s ease',
            }}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 210,
              width: 'min(400px, 90vw)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '24px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              animation: 'modalFadeIn 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Save size={18} style={{ color: 'var(--accent-indigo)' }} />
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>
                  Save Custom Preset
                </span>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: 10,
                  padding: 8,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Preset Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Preset Name
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Late Night Coding"
                autoFocus
                maxLength={40}
                onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentAsPreset() }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            {/* Icon Picker */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Icon
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['🎵', '🎶', '🎧', '🧠', '💻', '📚', '☕', '🌙', '🔥', '🌊', '⚡', '🎯', '💎', '🚀', '🌿'].map((em) => (
                  <button
                    key={em}
                    onClick={() => setSaveIcon(em)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: saveIcon === em ? `2px solid ${saveColor}` : '1px solid var(--border)',
                      background: saveIcon === em ? `${saveColor}18` : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CUSTOM_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSaveColor(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: saveColor === c ? '3px solid #fff' : '2px solid transparent',
                      background: c,
                      cursor: 'pointer',
                      boxShadow: saveColor === c ? `0 0 12px ${c}60` : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Mix Preview */}
            <div style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              marginBottom: 20,
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Current Mix: </span>
              {ALL_IDS.filter((ch) => !muted[ch] && volumes[ch] > 0)
                .map((ch) => `${ch[0].toUpperCase() + ch.slice(1)} ${volumes[ch]}%`)
                .join(' · ') || 'No active channels'}
            </div>

            {/* Save Button */}
            <button
              onClick={saveCurrentAsPreset}
              disabled={!saveName.trim() || !ALL_IDS.some((ch) => !muted[ch] && volumes[ch] > 0)}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: 14,
                border: 'none',
                background: saveName.trim() ? `linear-gradient(135deg, ${saveColor}, ${saveColor}cc)` : 'rgba(255,255,255,0.06)',
                color: saveName.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 700,
                cursor: saveName.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: saveName.trim() ? `0 4px 16px ${saveColor}30` : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Check size={16} />
              Save Preset
            </button>
          </div>
        </>
      )}

      {/* ── Waveform Visualizer ── */}
      <div style={{ marginBottom: 20 }}>
        <WaveformVisualizer analyserRef={analyserRef} isPlaying={isPlaying} />
      </div>

      {/* ── Master Controls ── */}
      <div
        className="glass-card"
        style={{
          padding: '18px 22px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Play / Stop */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: isPlaying
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isPlaying
              ? '0 0 24px rgba(239,68,68,0.3), 0 4px 12px rgba(0,0,0,0.2)'
              : '0 0 24px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease',
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            <Square size={20} fill="#fff" />
          ) : (
            <Play size={20} fill="#fff" style={{ marginLeft: 2 }} />
          )}
        </button>

        {/* Master Volume Slider */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Master Volume
              </span>
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--accent-indigo)',
              }}
            >
              {masterVolume}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              accentColor: 'var(--accent-indigo)',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 18, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: 'var(--accent-emerald)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {activeCount}
            </div>
            <div>Active</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                fontFamily: 'JetBrains Mono, monospace',
                color: totalMix > 200 ? 'var(--accent-amber)' : 'var(--text-secondary)',
                transition: 'color 0.2s',
              }}
            >
              {totalMix}%
            </div>
            <div>Mix Total</div>
          </div>
        </div>
      </div>

      {/* ── Noise Channels ── */}
      <section style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 12,
            opacity: 0.7,
          }}
        >
          Noise Channels
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 6,
            WebkitOverflowScrolling: 'touch',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {NOISE_CHANNELS.map((ch) => (
            <ChannelFader
              key={ch.id}
              value={volumes[ch.id]}
              onChange={(v) => chgVol(ch.id, v)}
              muted={muted[ch.id]}
              onMuteToggle={() => chgMute(ch.id)}
              color={ch.color}
              label={ch.label}
              icon={ch.icon}
              desc={ch.desc}
            />
          ))}
        </div>
      </section>

      {/* ── Binaural Beats & Tones ── */}
      <section style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 12,
            opacity: 0.7,
          }}
        >
          Binaural Beats & Tones
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 6,
            WebkitOverflowScrolling: 'touch',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {BEAT_CHANNELS.map((ch) => (
            <ChannelFader
              key={ch.id}
              value={volumes[ch.id]}
              onChange={(v) => chgVol(ch.id, v)}
              muted={muted[ch.id]}
              onMuteToggle={() => chgMute(ch.id)}
              color={ch.color}
              label={ch.label}
              icon={ch.icon}
              desc={ch.desc}
              hz={beatFreqs[ch.id] ?? ch.defaultHz}
            />
          ))}
        </div>
      </section>

      {/* ── Tips ── */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>🎧</span>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Tips: </strong>
          Use <strong>headphones</strong> for binaural beats (they need stereo separation). Start with a preset, then fine-tune.
          For lectures, keep total masking below <strong>35%</strong> so you can still hear clearly.
          All sliders go in <strong>1%</strong> increments for precise control.
        </div>
      </div>

      {/* Bottom spacer for mobile nav */}
      <div style={{ height: 80 }} />
    </div>
  )
}
