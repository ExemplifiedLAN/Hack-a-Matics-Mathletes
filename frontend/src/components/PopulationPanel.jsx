export default function PopulationPanel({ simData, currentStep }) {
  const totalCity = simData?.grid_metadata?.total_population ?? 718000
  const zonePops  = simData?.grid_metadata?.zone_populations ?? []
  const stepData  = simData?.affected_population?.[currentStep]

  const safe     = stepData?.safe     ?? totalCity
  const warning  = stepData?.warning  ?? 0
  const critical = stepData?.critical ?? 0
  const pctSafe  = stepData?.pct_safe     ?? 100
  const pctWarn  = stepData?.pct_warning  ?? 0
  const pctCrit  = stepData?.pct_critical ?? 0
  const zoneBreak = stepData?.zone_breakdown ?? []
  const danger    = warning + critical

  return (
    <div className="hud-panel bracket bracket-bottom">
      <div className="hud-panel-header justify-between">
        <span className="label-sys">POPULATION // RISK</span>
        <span className="label-sys">SYS D</span>
      </div>

      <div style={{ padding: 12 }}>
        {/* City total — big number readout */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 10, paddingBottom: 10,
          borderBottom: '1px solid var(--border-dim)',
        }}>
          <div>
            <div className="readout-label" style={{ fontSize: 8 }}>TOTAL CITY POPULATION</div>
            <div className="font-display leading-none" style={{ fontSize: 28, color: 'var(--cyan)' }}>
              {totalCity.toLocaleString()}
            </div>
          </div>
          {danger > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="readout-label" style={{ fontSize: 8, color: 'var(--red)' }}>AT RISK</div>
              <div className="font-display leading-none" style={{
                fontSize: 26,
                color: critical > 0 ? 'var(--red)' : 'var(--amber)',
              }}>
                {danger.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Three-column readout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'SAFE',     count: safe,     pct: pctSafe,  color: 'var(--green)' },
            { label: 'WARNING',  count: warning,  pct: pctWarn,  color: 'var(--amber)' },
            { label: 'CRITICAL', count: critical, pct: pctCrit,  color: 'var(--red)'   },
          ].map(({ label, count, pct, color }) => (
            <div key={label} style={{
              background: 'var(--bg3)', border: `1px solid ${color}22`,
              padding: '6px 8px', textAlign: 'center',
            }}>
              <div className="readout-label" style={{ fontSize: 7 }}>{label}</div>
              <div className="font-display" style={{ fontSize: count > 99999 ? 14 : 18, color, lineHeight: 1.1 }}>
                {count >= 1000 ? `${(count/1000).toFixed(0)}K` : count}
              </div>
              <div className="readout-label" style={{ fontSize: 7, color }}>{pct}%</div>
            </div>
          ))}
        </div>

        {/* Population distribution bar */}
        <div style={{ display: 'flex', height: 3, gap: 1, marginBottom: 10 }}>
          {safe     > 0 && <div style={{ flex: safe,     background: 'var(--green)' }} />}
          {warning  > 0 && <div style={{ flex: warning,  background: 'var(--amber)' }} />}
          {critical > 0 && <div style={{ flex: critical, background: 'var(--red)'   }} />}
        </div>

        {/* Zone breakdown — accordion style rows */}
        {(zoneBreak.length > 0 ? zoneBreak : zonePops.map(z => ({
          zone: z.zone, total: z.population, safe: z.population, warning: 0, critical: 0
        }))).map((z, i) => {
          const hasCrit = z.critical > 0
          const hasWarn = z.warning  > 0
          const color   = hasCrit ? 'var(--red)' : hasWarn ? 'var(--amber)' : 'var(--green)'
          const danger  = (z.critical ?? 0) + (z.warning ?? 0)
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 8px',
              borderBottom: '1px solid var(--border-dim)',
              background: hasCrit ? 'var(--red-dim)' : hasWarn ? 'var(--amber-dim)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 4, height: 4, background: color, flexShrink: 0 }} />
                <span style={{
                  fontFamily: 'Share Tech Mono', fontSize: 8.5,
                  color: 'var(--text-dim)', letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {z.zone}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                {danger > 0 && (
                  <span className="font-display text-sm" style={{ color }}>
                    {danger.toLocaleString()}
                  </span>
                )}
                <span style={{
                  fontFamily: 'Share Tech Mono', fontSize: 8, color: 'var(--text-muted)',
                }}>
                  /{z.total.toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
