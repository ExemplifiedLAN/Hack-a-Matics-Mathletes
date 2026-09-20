import { useEffect, useState } from 'react'

function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  const hh = String(t.getHours()).padStart(2,'0')
  const mm = String(t.getMinutes()).padStart(2,'0')
  const ss = String(t.getSeconds()).padStart(2,'0')
  return (
    <span className="font-mono-hud text-sm tracking-widest">
      {hh}:{mm}:{ss}
    </span>
  )
}

export default function Header({ simData, currentStep, currentTime, loading }) {
  const stepStatus = simData?.status_history?.[currentStep]
  const critCount  = stepStatus ? stepStatus.flat().filter(s => s === 'Critical').length : 0
  const warnCount  = stepStatus ? stepStatus.flat().filter(s => s === 'Warning').length  : 0

  const simH = simData ? Math.floor(currentTime) : 0
  const simM = simData ? Math.round((currentTime - simH) * 60) : 0

  return (
    <header style={{ background: '#000', borderBottom: '1px solid var(--border)' }}
            className="flex items-center justify-between px-6 py-3 shrink-0">
      {/* Left — brand */}
      <div className="flex items-center gap-6">
        <div>
          <div className="label-cyan" style={{ fontSize: 9, marginBottom: 2 }}>
            EARLY WARNING SYSTEM // SERIES 01
          </div>
          <div className="font-display text-white tracking-wider leading-none" style={{ fontSize: 38 }}>
            FLOWSHIELD //
          </div>
        </div>

        <div style={{ width: 1, height: 36, background: 'var(--border)' }} />

        <div className="flex gap-6">
          {[
            { label: 'SYS TIME', value: <Clock /> },
            { label: 'SIM TIME',
              value: simData
                ? <span className="font-mono-hud text-sm" style={{ color: 'var(--cyan)' }}>
                    T+{String(simH).padStart(2,'0')}:{String(simM).padStart(2,'0')}
                  </span>
                : <span className="font-mono-hud text-sm" style={{ color: 'var(--text-muted)' }}>--:--</span>
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="readout-label" style={{ fontSize: 8 }}>{label}</div>
              <div className="mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — status indicators */}
      <div className="flex items-center gap-4">
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--cyan)' }} />
            <span className="label-cyan" style={{ fontSize: 10 }}>SIMULATING</span>
          </div>
        )}

        <div className="flex gap-3">
          {[
            { label: 'CRITICAL', count: critCount, color: 'var(--red)' },
            { label: 'WARNING',  count: warnCount, color: 'var(--amber)' },
            { label: 'SAFE',     count: 64 - critCount - warnCount, color: 'var(--green)' },
          ].map(({ label, count, color }) => (
            <div key={label} className="text-center" style={{ minWidth: 48 }}>
              <div className="readout-label" style={{ fontSize: 8 }}>{label}</div>
              <div className="font-display text-xl leading-tight" style={{ color }}>
                {String(count).padStart(2,'0')}
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: 1, height: 36, background: 'var(--border)' }} />

        <div className="text-right">
          <div className="readout-label" style={{ fontSize: 8 }}>STATUS</div>
          <div className="font-display text-base leading-tight"
               style={{ color: critCount > 0 ? 'var(--red)' : warnCount > 0 ? 'var(--amber)' : 'var(--green)' }}>
            {!simData ? 'STANDBY' : critCount > 0 ? 'ALERT' : warnCount > 0 ? 'WARNING' : 'NOMINAL'}
          </div>
        </div>
      </div>
    </header>
  )
}
