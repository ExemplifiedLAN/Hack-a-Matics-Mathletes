import { useState } from 'react'
import axios from 'axios'

const API = '/api'

export default function SituationBrief({ simData, config }) {
  const [brief,   setBrief]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  if (!simData) return null

  const finalStep  = simData.affected_population?.[simData.affected_population.length - 1]
  const statusFlat = simData.status_history?.[simData.status_history.length - 1]?.flat() ?? []
  const critCount  = statusFlat.filter(s => s === 'Critical').length
  const warnCount  = statusFlat.filter(s => s === 'Warning').length
  const safeCount  = statusFlat.filter(s => s === 'Safe').length
  const peakWater  = Math.max(...(simData.max_water_levels?.flat?.() ?? [0]))

  // Find worst zone (most critical cells)
  const worstZone = (() => {
    if (!simData.status_history || !simData.grid_metadata) return null
    const last = simData.status_history[simData.status_history.length - 1]
    const counts = {}
    last.forEach((row, r) => {
      const zone = simData.grid_metadata.zone_labels?.[r]
      if (!zone) return
      counts[zone] = (counts[zone] || 0) + row.filter(s => s === 'Critical').length
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top?.[1] > 0 ? top[0] : null
  })()

  const generate = async () => {
    setLoading(true); setError(null); setBrief(null)
    try {
      const res = await axios.post(`${API}/brief`, {
        scenario: config.scenario ?? 'custom',
        rainfall_intensity: config.rainfall_intensity,
        duration_hours: config.duration_hours,
        drainage_failure: config.drainage_failure,
        blocked_channels: config.blocked_channels,
        critical_count: critCount,
        warning_count: warnCount,
        safe_count: safeCount,
        affected_population: finalStep?.total ?? 0,
        total_population: simData.grid_metadata?.total_population ?? 718000,
        peak_water: peakWater,
        worst_zone: worstZone,
      })
      if (res.data.error) setError(res.data.error)
      else setBrief(res.data.brief)
    } catch (e) {
      setError('Could not reach brief service.')
    } finally {
      setLoading(false)
    }
  }

  const severityColor = critCount > 20 ? 'var(--red)' : critCount > 0 ? 'var(--amber)' : 'var(--green)'
  const severityLabel = critCount > 20 ? 'MASS CASUALTY RISK' : critCount > 0 ? 'ACTIVE FLOOD EVENT' : warnCount > 0 ? 'ELEVATED RISK' : 'NOMINAL'

  return (
    <div className="hud-panel bracket" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="hud-panel-header justify-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="label-sys">SITUATION // BRIEF</span>
          {critCount > 0 && (
            <div style={{
              width: 6, height: 6, background: 'var(--red)',
              boxShadow: '0 0 6px var(--red)', animation: 'crit-blink 1.4s infinite',
            }} />
          )}
        </div>
        <span style={{
          fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: '0.12em',
          color: severityColor, padding: '1px 8px',
          border: `1px solid ${severityColor}44`, background: `${severityColor}11`,
        }}>
          {severityLabel}
        </span>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Key metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { label: 'CRITICAL ZONES', value: critCount, color: 'var(--red)'   },
            { label: 'WARNING ZONES',  value: warnCount, color: 'var(--amber)' },
            { label: 'PEAK DEPTH',     value: `${peakWater.toFixed(0)}mm`, color: 'var(--cyan)' },
            { label: 'AT RISK',        value: `${((finalStep?.total ?? 0) / 1000).toFixed(0)}K`, color: severityColor },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: '#080808', border: '1px solid var(--border-dim)',
              padding: '8px 10px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 7, color: 'var(--text-muted)', marginBottom: 3, letterSpacing: '0.1em' }}>{label}</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Brief text area */}
        <div style={{
          background: '#040404', border: '1px solid var(--border-dim)',
          padding: '12px 14px', minHeight: 80, position: 'relative',
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 12, height: 12, border: '1px solid var(--cyan)',
                borderTop: '1px solid transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--cyan)', letterSpacing: '0.15em' }}>
                GENERATING SITUATION BRIEF...
              </span>
            </div>
          ) : error ? (
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--red)' }}>
              ⚠ {error}
            </div>
          ) : brief ? (
            <div style={{
              fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 500,
              color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, letterSpacing: '0.02em',
            }}>
              {brief}
            </div>
          ) : (
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              PRESS "GENERATE BRIEF" TO RECEIVE AN AI-POWERED SITUATION REPORT BASED ON SIMULATION RESULTS
            </div>
          )}
        </div>

        {/* Generate button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-hud"
            style={{ fontSize: 11, letterSpacing: '0.2em', padding: '7px 20px' }}
          >
            {loading ? 'ANALYZING...' : brief ? 'REGENERATE BRIEF' : 'GENERATE BRIEF'}
          </button>
        </div>
      </div>
    </div>
  )
}
