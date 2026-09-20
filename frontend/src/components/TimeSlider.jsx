import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

function fmt(h) {
  if (h == null) return '--H --M'
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2,'0')}H ${String(mm).padStart(2,'0')}M`
}

export default function TimeSlider({
  totalSteps, currentStep, setCurrentStep,
  timeSteps, isPlaying, setIsPlaying,
  playSpeed, setPlaySpeed
}) {
  const pct       = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0
  const totalHrs  = timeSteps?.[totalSteps] ?? 0
  const currentHr = timeSteps?.[currentStep] ?? 0

  // Tick marks every whole hour
  const ticks = []
  for (let h = 0; h <= Math.floor(totalHrs); h++) {
    ticks.push({ hr: h, pct: totalHrs > 0 ? (h / totalHrs) * 100 : 0 })
  }

  return (
    <div className="hud-panel" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="label-sys">TIMELINE // PLAYBACK</span>
        <div style={{ flex: 1 }} />
        <span className="font-mono-hud" style={{ fontSize: 13, color: 'var(--cyan)', letterSpacing: '0.08em' }}>
          T + {fmt(currentHr)}
        </span>
        <span className="readout-label" style={{ fontSize: 8 }}>
          / {fmt(totalHrs)}
        </span>
      </div>

      {/* Progress track — clickable */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        {/* Track background */}
        <div style={{
          height: 4, background: 'rgba(255,255,255,0.07)',
          position: 'relative', cursor: 'pointer',
        }}>
          {/* Filled portion */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: 'linear-gradient(to right, rgba(0,229,255,0.5), var(--cyan))',
            transition: 'width 0.2s ease',
          }} />
          {/* Diamond playhead */}
          <div style={{
            position: 'absolute', top: '50%',
            left: `${pct}%`,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            width: 10, height: 10,
            background: 'var(--cyan)',
            boxShadow: '0 0 8px var(--cyan)',
            transition: 'left 0.2s ease',
            zIndex: 2,
          }} />
        </div>

        {/* Invisible range input on top for interaction */}
        <input
          type="range"
          min={0} max={totalSteps} step={1}
          value={currentStep}
          onChange={e => { setIsPlaying(false); setCurrentStep(Number(e.target.value)) }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
      </div>

      {/* Hour tick marks */}
      <div style={{ position: 'relative', height: 14, marginBottom: 10 }}>
        {ticks.map(({ hr, pct: tp }) => (
          <div key={hr} style={{
            position: 'absolute', left: `${tp}%`,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <div style={{ width: 1, height: 4, background: 'rgba(255,255,255,0.15)' }} />
            <span style={{
              fontFamily: 'Share Tech Mono', fontSize: 7,
              color: hr === Math.floor(currentHr) ? 'var(--cyan)' : 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}>
              {hr}H
            </span>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Transport */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => { setIsPlaying(false); setCurrentStep(0) }}
            className="btn-hud-ghost" style={{ padding: '5px 10px' }}
            title="Rewind to start"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsPlaying(p => !p)}
            className="btn-hud"
            style={{ padding: '6px 20px', minWidth: 100, fontSize: 12, letterSpacing: '0.2em' }}
          >
            {isPlaying
              ? <><Pause className="w-3.5 h-3.5" /><span>PAUSE</span></>
              : <><Play  className="w-3.5 h-3.5" /><span>PLAY</span></>
            }
          </button>

          <button
            onClick={() => { setIsPlaying(false); setCurrentStep(totalSteps) }}
            className="btn-hud-ghost" style={{ padding: '5px 10px' }}
            title="Jump to end"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Speed selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="readout-label" style={{ fontSize: 8 }}>PLAYBACK SPEED</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {[
              { label: '0.5×', val: 600 },
              { label: '1×',   val: 300 },
              { label: '2×',   val: 150 },
              { label: '4×',   val: 75  },
            ].map(({ label, val }) => (
              <button
                key={val}
                onClick={() => setPlaySpeed(val)}
                style={{
                  padding: '3px 8px',
                  fontFamily: 'Share Tech Mono', fontSize: 10,
                  background: playSpeed === val ? 'rgba(0,229,255,0.2)' : 'transparent',
                  border: `1px solid ${playSpeed === val ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
                  color: playSpeed === val ? 'var(--cyan)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Frame counter */}
        <div style={{ textAlign: 'right', minWidth: 60 }}>
          <div className="readout-label" style={{ fontSize: 8 }}>FRAME</div>
          <div className="font-mono-hud" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {String(currentStep + 1).padStart(2,'0')} / {String(totalSteps + 1).padStart(2,'0')}
          </div>
        </div>
      </div>
    </div>
  )
}
