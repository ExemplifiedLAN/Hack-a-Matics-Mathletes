export default function EarlyWarningDashboard({ statusGrid, waterGrid, names, population, timeToC, currentTime, simReady, showPopulation = true }) {
  const NR = names?.length ?? 0
  const NC = names?.[0]?.length ?? 0

  // Collect per-cell data
  const critAlerts = []
  const warnAlerts = []
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      const s    = statusGrid?.[r]?.[c]
      const w    = waterGrid?.[r]?.[c] ?? 0
      const pop  = Math.round((population?.[r]?.[c] ?? 0) * 1000)
      const ttc  = timeToC?.[r]?.[c] ?? null
      const name = names[r][c]
      if      (s === 'Critical') critAlerts.push({ name, water: w, pop, ttc })
      else if (s === 'Warning')  warnAlerts.push({ name, water: w, pop, ttc })
    }
  }
  critAlerts.sort((a, b) => b.water - a.water)
  warnAlerts.sort((a, b) => b.water - a.water)

  const totalPop = Math.round(((population?.flat() ?? []).reduce((s, v) => s + v, 0)) * 1000)
  const critPop  = critAlerts.reduce((s, a) => s + a.pop, 0)
  const warnPop  = warnAlerts.reduce((s, a) => s + a.pop, 0)

  const allTTC       = (timeToC?.flat() ?? []).filter(v => v !== null)
  const firstCritH   = allTTC.length > 0 ? Math.min(...allTTC) : null

  const overallStatus = !simReady ? 'STANDBY'
    : critAlerts.length > 0 ? 'CRITICAL ALERT'
    : warnAlerts.length > 0 ? 'FLOOD WARNING'
    : 'ALL CLEAR'
  const statusColor = !simReady ? 'var(--text-muted)'
    : critAlerts.length > 0 ? 'var(--red)'
    : warnAlerts.length > 0 ? 'var(--amber)'
    : 'var(--green)'
  const statusBg = !simReady ? 'transparent'
    : critAlerts.length > 0 ? 'rgba(255,23,68,0.07)'
    : warnAlerts.length > 0 ? 'rgba(255,171,0,0.07)'
    : 'rgba(0,230,118,0.07)'

  const fmtTime = h => {
    const hh = Math.floor(h)
    const mm = String(Math.round((h - hh) * 60)).padStart(2, '0')
    return `T+${hh}H ${mm}M`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Status banner ── */}
      <div className="hud-panel" style={{ padding: '14px 16px', border: `1px solid ${statusColor}55`, background: statusBg }}>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
          ⚡ EARLY WARNING SYSTEM
        </div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: statusColor, letterSpacing: '0.08em', lineHeight: 1 }}>
          {overallStatus}
        </div>
        {simReady && (
          <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
            {[
              { l: 'CRITICAL', v: critAlerts.length, col: 'var(--red)' },
              { l: 'WARNING',  v: warnAlerts.length, col: 'var(--amber)' },
              { l: 'SAFE',     v: NR * NC - critAlerts.length - warnAlerts.length, col: 'var(--green)' },
            ].map(({ l, v, col }) => (
              <div key={l}>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: col, lineHeight: 1 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {firstCritH !== null && (
          <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--red)' }}>
            FIRST CRITICAL: {fmtTime(firstCritH)}
          </div>
        )}
        {simReady && currentTime != null && (
          <div style={{ marginTop: 4, fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-muted)' }}>
            SIM TIME: {fmtTime(currentTime)}
          </div>
        )}
      </div>

      {/* ── Active alerts ── */}
      <div className="hud-panel" style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: 10 }}>
          ACTIVE FLOOD ALERTS
        </div>

        {!simReady ? (
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            RUN SIMULATION TO<br/>ACTIVATE WARNINGS
          </div>
        ) : critAlerts.length === 0 && warnAlerts.length === 0 ? (
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--green)', textAlign: 'center', padding: '16px 0' }}>
            ✓ ALL ZONES CLEAR
          </div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {critAlerts.slice(0, 12).map(a => (
              <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.22)' }}>
                <div>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--red)' }}>■ CRIT</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'white', marginLeft: 8 }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: 16, color: 'var(--red)' }}>{a.water.toFixed(0)}mm</span>
              </div>
            ))}
            {warnAlerts.slice(0, 12).map(a => (
              <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,171,0,0.08)', border: '1px solid rgba(255,171,0,0.22)' }}>
                <div>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--amber)' }}>▲ WARN</span>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'white', marginLeft: 8 }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: 16, color: 'var(--amber)' }}>{a.water.toFixed(0)}mm</span>
              </div>
            ))}
            {(critAlerts.length > 12 || warnAlerts.length > 12) && (
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
                +{Math.max(0, critAlerts.length - 12) + Math.max(0, warnAlerts.length - 12)} more zones
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Evacuation priorities ── */}
      {simReady && (critAlerts.length > 0 || warnAlerts.length > 0) && (
        <div className="hud-panel" style={{ padding: '14px 16px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: 10 }}>
            EVACUATION PRIORITIES
          </div>
          {critAlerts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--red)', letterSpacing: '0.08em', marginBottom: 5 }}>
                P1 — IMMEDIATE EVACUATION
              </div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                {critAlerts.slice(0, 8).map(a => a.name).join(' · ')}
                {critAlerts.length > 8 && ` +${critAlerts.length - 8} more`}
              </div>
            </div>
          )}
          {warnAlerts.length > 0 && (
            <div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--amber)', letterSpacing: '0.08em', marginBottom: 5 }}>
                P2 — PREPARE TO EVACUATE
              </div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8 }}>
                {warnAlerts.slice(0, 8).map(a => a.name).join(' · ')}
                {warnAlerts.length > 8 && ` +${warnAlerts.length - 8} more`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Population at risk ── */}
      {simReady && showPopulation && (
        <div className="hud-panel" style={{ padding: '14px 16px' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: 10 }}>
            POPULATION AT RISK
          </div>
          {[
            ['CRITICAL ZONE', critPop, 'var(--red)'],
            ['WARNING ZONE',  warnPop, 'var(--amber)'],
            ['SAFE',          Math.max(0, totalPop - critPop - warnPop), 'var(--green)'],
          ].map(([label, pop, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, color }}>{pop.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border-dim)', margin: '6px 0 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'var(--text-muted)' }}>TOTAL POPULATION</span>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'white' }}>{totalPop.toLocaleString()}</span>
          </div>
        </div>
      )}

    </div>
  )
}
