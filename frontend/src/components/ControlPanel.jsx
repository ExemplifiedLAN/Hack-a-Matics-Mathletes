import { useState } from 'react'
import { Play, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'

const SCENARIOS = [
  { key: 'normal',           label: 'NORMAL RAINFALL',   sub: '20 MM/HR // OPERATIONAL',         color: '#00e676' },
  { key: 'heavy',            label: 'HEAVY RAINFALL',    sub: '80 MM/HR // STRESS MODE',          color: '#ffab00' },
  { key: 'extreme',          label: 'EXTREME RAINFALL',  sub: '150 MM/HR // CATASTROPHIC',        color: '#ff1744' },
  { key: 'drainage_failure', label: 'DRAINAGE FAILURE',  sub: '50 MM/HR // 92% INFRA LOSS',       color: '#ff6d00' },
  { key: 'blocked_channel',  label: 'BLOCKED CHANNELS',  sub: '70 MM/HR // RIVER BANK SEALED',    color: '#d500f9' },
]

function SysSection({ sysNum, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border-dim)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        style={{ borderBottom: open ? '1px solid var(--border-dim)' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono-hud text-xs" style={{ color: 'var(--cyan)', opacity: 0.6 }}>
            {sysNum}
          </span>
          <span className="font-display text-base tracking-widest text-white">{title}</span>
        </div>
        {open
          ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
          : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        }
      </button>
      {open && <div className="px-4 py-3 space-y-2">{children}</div>}
    </div>
  )
}

function HudSlider({ label, value, min, max, step, onChange, unit, color }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="readout-label">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-xl leading-none" style={{ color }}>
            {value}
          </span>
          <span className="readout-unit">{unit}</span>
        </div>
      </div>
      <div className="relative">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ '--pct': `${pct}%` }}
        />
      </div>
      <div className="flex justify-between" style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  )
}

export default function ControlPanel({ config, setConfig, scenarios, onRun, onRunScenario, onReset, loading, hasData }) {
  return (
    <div className="hud-panel bracket flex flex-col h-full">
      {/* Panel label */}
      <div className="hud-panel-header">
        <span className="label-sys">CONTROL // MATRIX</span>
        <div className="flex-1" />
        <span className="label-sys">SYS A</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Quick scenarios */}
        <SysSection sysNum="A-01" title="SCENARIOS">
          <div className="space-y-1.5">
            {SCENARIOS.map(sc => (
              <button
                key={sc.key}
                onClick={() => onRunScenario(sc.key)}
                disabled={loading}
                className="scenario-card w-full text-left"
                style={{ '--accent': sc.color }}
              >
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: 2, background: sc.color
                }} />
                <div className="flex items-start justify-between pl-2">
                  <div>
                    <div className="font-display text-sm tracking-wider text-white leading-tight">
                      {sc.label}
                    </div>
                    <div className="readout-label mt-0.5" style={{ fontSize: 8 }}>{sc.sub}</div>
                  </div>
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: sc.color }} />
                </div>
              </button>
            ))}
          </div>
        </SysSection>

        {/* Custom config */}
        <SysSection sysNum="A-02" title="CUSTOM INPUT" defaultOpen={false}>
          <div className="space-y-4">
            <HudSlider
              label="RAINFALL INTENSITY"
              value={config.rainfall_intensity}
              min={5} max={200} step={5}
              onChange={v => setConfig(c => ({ ...c, rainfall_intensity: v, scenario: 'custom' }))}
              unit="MM/HR"
              color={config.rainfall_intensity > 100 ? 'var(--red)' : config.rainfall_intensity > 50 ? 'var(--amber)' : 'var(--green)'}
            />
            <HudSlider
              label="DURATION"
              value={config.duration_hours}
              min={1} max={24} step={1}
              onChange={v => setConfig(c => ({ ...c, duration_hours: v }))}
              unit="HRS"
              color="var(--cyan)"
            />
            {/* Drainage failure toggle */}
            <div className="flex items-center justify-between py-2"
                 style={{ borderTop: '1px solid var(--border-dim)' }}>
              <div>
                <div className="font-display text-sm tracking-wider text-white">DRAINAGE FAILURE</div>
                <div className="readout-label mt-0.5" style={{ fontSize: 8 }}>92% CAPACITY LOSS</div>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, drainage_failure: !c.drainage_failure }))}
                className="relative"
                style={{
                  width: 40, height: 20,
                  background: config.drainage_failure ? 'rgba(255,107,0,0.3)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${config.drainage_failure ? '#ff6d00' : 'rgba(255,255,255,0.15)'}`,
                  transition: 'all 0.2s',
                  overflow: 'hidden', position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 3, left: 0, width: 12, height: 12,
                  background: config.drainage_failure ? '#ff6d00' : 'rgba(255,255,255,0.3)',
                  transform: config.drainage_failure ? 'translateX(23px)' : 'translateX(3px)',
                  transition: 'all 0.2s',
                }} />
              </button>
            </div>

            {/* Blocked channels mini-grid */}
            <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 10 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <div>
                  <div className="font-display text-sm tracking-wider text-white">BLOCKED CHANNELS</div>
                  <div className="readout-label mt-0.5" style={{ fontSize: 8 }}>
                    CLICK CELLS TO TOGGLE · {config.blocked_channels.length} BLOCKED
                  </div>
                </div>
                {config.blocked_channels.length > 0 && (
                  <button
                    onClick={() => setConfig(c => ({ ...c, blocked_channels: [] }))}
                    style={{
                      fontFamily: 'Share Tech Mono', fontSize: 8, color: '#d500f9',
                      border: '1px solid rgba(213,0,249,0.3)', padding: '2px 6px',
                      background: 'rgba(213,0,249,0.08)', cursor: 'pointer',
                    }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
              {/* 8×8 mini grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
                padding: 4, background: '#050505', border: '1px solid var(--border-dim)',
              }}>
                {Array.from({ length: 8 }, (_, r) =>
                  Array.from({ length: 8 }, (_, c) => {
                    const key = `${r},${c}`
                    const isBlocked = config.blocked_channels.some(([br, bc]) => br === r && bc === c)
                    return (
                      <button
                        key={key}
                        title={`Row ${r + 1}, Col ${String.fromCharCode(65 + c)}`}
                        onClick={() => setConfig(cfg => {
                          const already = cfg.blocked_channels.some(([br, bc]) => br === r && bc === c)
                          return {
                            ...cfg,
                            blocked_channels: already
                              ? cfg.blocked_channels.filter(([br, bc]) => !(br === r && bc === c))
                              : [...cfg.blocked_channels, [r, c]],
                            scenario: 'custom',
                          }
                        })}
                        style={{
                          aspectRatio: '1/1', width: '100%',
                          background: isBlocked ? 'rgba(213,0,249,0.35)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isBlocked ? 'rgba(213,0,249,0.7)' : 'rgba(255,255,255,0.08)'}`,
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}
                      />
                    )
                  })
                )}
              </div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 7, color: 'var(--text-muted)', marginTop: 4 }}>
                Purple = blocked · Rows top→bottom, cols A→H
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onRun} disabled={loading} className="btn-hud flex-1">
                <Play className="w-3.5 h-3.5" />
                {loading ? 'RUNNING...' : 'EXECUTE'}
              </button>
              {hasData && (
                <button onClick={onReset} className="btn-hud-ghost">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </SysSection>
      </div>
    </div>
  )
}
