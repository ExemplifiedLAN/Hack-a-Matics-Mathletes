function Readout({ label, value, unit, color = 'var(--cyan)', size = 32 }) {
  return (
    <div className="readout-block">
      <div className="readout-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="font-display leading-none" style={{ fontSize: size, color }}>{value}</span>
        {unit && <span className="readout-unit">{unit}</span>}
      </div>
    </div>
  )
}

function fmt(h) {
  if (h == null || h === undefined) return '--H --M'
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}H ${String(mm).padStart(2,'0')}M`
}

export default function StatsPanel({ simData, currentStep, currentTime }) {
  return (
    <div className="hud-panel bracket bracket-bottom">
      <div className="hud-panel-header justify-between">
        <span className="label-sys">SYSTEM // READOUT</span>
        <span className="label-sys">SYS B</span>
      </div>

      {!simData ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div className="readout-label" style={{ paddingTop: 12, paddingBottom: 12 }}>
            NO ACTIVE SIMULATION
          </div>
        </div>
      ) : (
        <div style={{ padding: 12 }}>
          {/* Primary readouts — big numbers like the image */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Readout
              label="SIM TIME"
              value={fmt(currentTime)}
              color="var(--cyan)"
              size={18}
            />
            <Readout
              label="RAINFALL"
              value={simData.config.rainfall_intensity}
              unit="MM/HR"
              color={simData.config.rainfall_intensity > 100 ? 'var(--red)' : simData.config.rainfall_intensity > 50 ? 'var(--amber)' : 'var(--green)'}
              size={22}
            />
            <Readout
              label="PEAK WATER"
              value={Math.max(...(simData.water_history[currentStep]?.flat() ?? [0])).toFixed(0)}
              unit="MM"
              color={
                Math.max(...(simData.water_history[currentStep]?.flat() ?? [0])) >= 300 ? 'var(--red)'
                : Math.max(...(simData.water_history[currentStep]?.flat() ?? [0])) >= 100 ? 'var(--amber)'
                : 'var(--green)'
              }
              size={22}
            />
          </div>

          <div style={{ height: 1, background: 'linear-gradient(to right, var(--cyan-mid), transparent)', margin: '8px 0' }} />

          {/* Region status counts — tactical readout */}
          {(() => {
            const flat = simData.status_history[currentStep]?.flat() ?? []
            const crit = flat.filter(s => s === 'Critical').length
            const warn = flat.filter(s => s === 'Warning').length
            const meta = simData.grid_metadata
            const total = meta ? (meta.grid_nr ?? meta.grid_n ?? 8) * (meta.grid_nc ?? meta.grid_n ?? 8) : flat.length || 64
            const safe = total - crit - warn
            const allTTC = simData.time_to_critical.flat().filter(v => v !== null)
            const nextCrit = allTTC.length > 0 ? Math.min(...allTTC) : null

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'CRITICAL', val: crit, color: 'var(--red)' },
                    { label: 'WARNING',  val: warn, color: 'var(--amber)' },
                    { label: 'SAFE',     val: safe, color: 'var(--green)' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{
                      background: 'var(--bg3)',
                      border: `1px solid ${color}22`,
                      padding: '6px 8px',
                      textAlign: 'center',
                    }}>
                      <div className="readout-label" style={{ fontSize: 8 }}>{label}</div>
                      <div className="font-display text-2xl leading-none" style={{ color }}>
                        {String(val).padStart(2,'0')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status bar */}
                <div style={{ display: 'flex', height: 3, gap: 1, marginBottom: 8 }}>
                  {safe > 0     && <div style={{ flex: safe,  background: 'var(--green)' }} />}
                  {warn > 0     && <div style={{ flex: warn,  background: 'var(--amber)' }} />}
                  {crit > 0     && <div style={{ flex: crit,  background: 'var(--red)'   }} />}
                </div>

                {nextCrit !== null && (
                  <div style={{
                    background: 'var(--red-dim)', border: '1px solid rgba(255,23,68,0.3)',
                    padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span className="readout-label" style={{ fontSize: 8, color: 'var(--red)' }}>
                      NEXT CRITICAL ETA
                    </span>
                    <span className="font-display text-base" style={{ color: 'var(--red)' }}>
                      {fmt(nextCrit)}
                    </span>
                  </div>
                )}

                {simData.config.drainage_failure && (
                  <div style={{
                    marginTop: 6,
                    background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.3)',
                    padding: '5px 10px',
                  }}>
                    <span className="readout-label" style={{ fontSize: 8, color: '#ff6d00', letterSpacing: '0.15em' }}>
                      ⚠ DRAINAGE FAILURE ACTIVE
                    </span>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
