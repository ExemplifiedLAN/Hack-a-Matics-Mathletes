import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

function fmt(h) {
  if (h == null) return null
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
  return `${hh}H ${String(mm).padStart(2,'0')}M`
}

function AlertRow({ name, status, ttc, onClick }) {
  const [open, setOpen] = useState(false)
  const isCrit = status === 'Critical'
  const color  = isCrit ? 'var(--red)' : 'var(--amber)'
  const bg     = isCrit ? 'var(--red-dim)' : 'var(--amber-dim)'
  const eta    = fmt(ttc)

  return (
    <div className="accordion-row" style={{ borderColor: 'var(--border-dim)' }}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => { setOpen(o => !o); onClick?.() }}
      >
        {/* Status dot */}
        <div style={{
          width: 6, height: 6, flexShrink: 0,
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: isCrit ? 'crit-blink 1.4s infinite' : 'none',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-display text-sm tracking-wider text-white truncate">
            {name.replace('-', ' // ')}
          </div>
        </div>

        <div style={{
          padding: '2px 6px', fontSize: 8,
          fontFamily: 'Share Tech Mono', letterSpacing: '0.12em',
          background: bg, border: `1px solid ${color}44`, color, flexShrink: 0,
        }}>
          {status.toUpperCase()}
        </div>

        {open ? <ChevronDown className="w-3 h-3 shrink-0" style={{ color }} />
              : <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />}
      </button>

      {open && (
        <div className="accordion-body">
          {eta && (
            <div style={{ marginBottom: 6 }}>
              <div className="readout-label" style={{ fontSize: 8 }}>TIME TO CRITICAL</div>
              <div className="font-display text-base" style={{ color: 'var(--red)', lineHeight: 1.2 }}>{eta}</div>
            </div>
          )}
          {!eta && ttc === null && (
            <div className="readout-label" style={{ fontSize: 8 }}>CRITICAL NOT REACHED IN SIM WINDOW</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AlertPanel({ status, metadata, timeToC, onSelectCell }) {
  if (!status) {
    return (
      <div className="hud-panel flex flex-col" style={{ flex: 1 }}>
        <div className="hud-panel-header justify-between">
          <span className="label-sys">ALERT // MATRIX</span>
          <span className="label-sys">SYS C</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="text-center">
            <div className="font-display text-2xl tracking-widest" style={{ color: 'var(--text-muted)' }}>
              ALL CLEAR
            </div>
            <div className="readout-label mt-2">NO ACTIVE ALERTS</div>
          </div>
        </div>
      </div>
    )
  }

  const alerts = []
  for (let r = 0; r < status.length; r++) {
    for (let c = 0; c < status[r].length; c++) {
      const s = status[r][c]
      if (s !== 'Safe') {
        alerts.push({
          row: r, col: c,
          name: metadata?.names?.[r]?.[c] ?? `R${r}C${c}`,
          status: s,
          ttc: timeToC?.[r]?.[c] ?? null,
        })
      }
    }
  }
  alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Critical' ? -1 : 1
    if (a.ttc !== null && b.ttc !== null) return a.ttc - b.ttc
    return 0
  })

  const crits = alerts.filter(a => a.status === 'Critical').length
  const warns  = alerts.filter(a => a.status === 'Warning').length

  return (
    <div className="hud-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="hud-panel-header justify-between">
        <div className="flex items-center gap-3">
          <span className="label-sys">ALERT // MATRIX</span>
          {crits > 0 && (
            <div style={{
              width: 6, height: 6,
              background: 'var(--red)',
              boxShadow: '0 0 6px var(--red)',
              animation: 'crit-blink 1.4s infinite',
            }} />
          )}
        </div>
        <div className="flex gap-2">
          {crits > 0 && (
            <span style={{
              padding: '1px 6px', fontSize: 8, fontFamily: 'Share Tech Mono',
              background: 'var(--red-dim)', border: '1px solid rgba(255,23,68,0.35)',
              color: 'var(--red)', letterSpacing: '0.1em',
            }}>
              {crits} CRIT
            </span>
          )}
          {warns > 0 && (
            <span style={{
              padding: '1px 6px', fontSize: 8, fontFamily: 'Share Tech Mono',
              background: 'var(--amber-dim)', border: '1px solid rgba(255,171,0,0.3)',
              color: 'var(--amber)', letterSpacing: '0.1em',
            }}>
              {warns} WARN
            </span>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div className="font-display text-xl tracking-widest" style={{ color: 'var(--green)' }}>
            ALL REGIONS NOMINAL
          </div>
        </div>
      ) : (
        <div>
          {alerts.map((a, i) => (
            <AlertRow
              key={i}
              name={a.name}
              status={a.status}
              ttc={a.ttc}
              onClick={() => onSelectCell?.({ row: a.row, col: a.col, name: a.name, status: a.status })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
