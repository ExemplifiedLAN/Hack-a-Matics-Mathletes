import { useState } from 'react'
import axios from 'axios'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const API = '/api'
const ORDER = ['normal', 'heavy', 'extreme', 'drainage_failure', 'blocked_channel']

function HudTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#050505', border: '1px solid var(--border)',
      padding: '8px 12px', fontSize: 10,
    }}>
      <div style={{ fontFamily: 'Share Tech Mono', color: 'var(--text-muted)', marginBottom: 6 }}>
        T+{Number(label).toFixed(2)}H
      </div>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, background: e.color }} />
          <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--text-dim)' }}>{e.name}:</span>
          <span style={{ fontFamily: 'Share Tech Mono', color: 'white' }}>
            {e.value >= 1000 ? `${(e.value/1000).toFixed(1)}K` : e.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ScenarioComparison({ scenarios }) {
  const [selected, setSelected] = useState(['normal', 'heavy', 'extreme'])
  const [data,    setData]     = useState(null)
  const [loading, setLoading]  = useState(false)
  const [error,   setError]    = useState(null)

  const toggle = key =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const run = async () => {
    if (selected.length < 2) return
    setLoading(true); setError(null)
    try {
      const res = await axios.post(`${API}/compare`, selected)
      setData(res.data)
    } catch { setError('Comparison failed.') }
    finally { setLoading(false) }
  }

  const popData = data
    ? Object.values(data)[0].time_steps.map((t, i) => {
        const pt = { time: t }
        Object.entries(data).forEach(([, d]) => { pt[d.label] = d.affected_population[i]?.total ?? 0 })
        return pt
      })
    : []

  return (
    <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Selector */}
      <div className="hud-panel">
        <div className="hud-panel-header justify-between">
          <span className="label-sys">SCENARIO · COMPARISON MATRIX</span>
          <span className="label-sys">SELECT MIN 2</span>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {ORDER.map(key => {
              const sc = scenarios[key]; if (!sc) return null
              const on = selected.includes(key)
              return (
                <button key={key} onClick={() => toggle(key)}
                  style={{
                    padding: '6px 14px',
                    fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 11,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    background: on ? `${sc.color}22` : 'transparent',
                    border: `1px solid ${on ? sc.color : 'rgba(255,255,255,0.1)'}`,
                    color: on ? sc.color : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {sc.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={run} disabled={selected.length < 2 || loading} className="btn-hud">
              {loading ? 'COMPUTING...' : 'EXECUTE COMPARE'}
            </button>
            {error && <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--red)' }}>{error}</span>}
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Population chart */}
          <div className="hud-panel">
            <div className="hud-panel-header">
              <span className="label-sys">AFFECTED POPULATION · OVER TIME</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={popData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tickFormatter={v => `${Number(v).toFixed(0)}H`}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'Share Tech Mono' }} />
                  <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'Share Tech Mono' }} />
                  <Tooltip content={<HudTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'Share Tech Mono', color: 'rgba(255,255,255,0.4)' }}
                    iconType="square" iconSize={5} />
                  {Object.entries(data).map(([key, d]) => (
                    <Area key={key} type="monotone" dataKey={d.label}
                      stroke={d.color} fill={`${d.color}18`} strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(data).length}, 1fr)`, gap: 8 }}>
            {Object.entries(data).map(([key, d]) => {
              const finalAff = d.affected_population[d.affected_population.length - 1]
              const maxWl = Math.max(...(d.max_water_levels?.flat?.() ?? [0]))
              return (
                <div key={key} className="hud-panel" style={{ borderLeft: `2px solid ${d.color}`, padding: 14 }}>
                  <div className="readout-label" style={{ marginBottom: 8, color: d.color }}>{d.label}</div>
                  <div style={{ marginBottom: 8 }}>
                    <div className="readout-label" style={{ fontSize: 8 }}>PEAK WATER</div>
                    <div className="font-display text-2xl leading-tight" style={{ color: d.color }}>
                      {maxWl.toFixed(0)}<span className="readout-unit">MM</span>
                    </div>
                  </div>
                  <div>
                    <div className="readout-label" style={{ fontSize: 8 }}>FINAL AFFECTED</div>
                    <div className="font-display text-xl leading-tight" style={{ color: 'var(--text-dim)' }}>
                      {finalAff?.total >= 1000 ? `${(finalAff.total/1000).toFixed(0)}K` : finalAff?.total ?? 0}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
