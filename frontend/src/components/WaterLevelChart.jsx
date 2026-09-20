import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts'

const COLORS = ['#00e5ff','#ffab00','#d500f9','#00e676','#ff1744','#ff6d00','#e0e0e0','#40c4ff']

function HudTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#050505', border: '1px solid var(--border)',
      padding: '8px 12px', fontSize: 10,
    }}>
      <div style={{ fontFamily: 'Share Tech Mono', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.1em' }}>
        T+{Number(label).toFixed(2)}H
      </div>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: 6, height: 6, background: e.color }} />
          <span style={{ fontFamily: 'Share Tech Mono', color: 'var(--text-dim)' }}>{e.name}:</span>
          <span style={{ fontFamily: 'Share Tech Mono', color: 'white', fontWeight: 'bold' }}>
            {typeof e.value === 'number' && e.value > 999
              ? `${(e.value/1000).toFixed(1)}K`
              : typeof e.value === 'number' ? e.value.toFixed(1) : e.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const axisStyle = { fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'Share Tech Mono' }
const gridStyle = { stroke: 'rgba(255,255,255,0.04)' }

export default function WaterLevelChart({ simData, currentStep, selectedCell }) {
  if (!simData) return null
  const { time_steps, water_history, affected_population, thresholds } = simData
  const warn = thresholds?.warning  ?? 100
  const crit = thresholds?.critical ?? 300

  const trackRegions = selectedCell
    ? [
        { row: selectedCell.row, col: selectedCell.col, label: selectedCell.name },
        { row: 7, col: 3, label: 'LLand-D' },
        { row: 6, col: 4, label: 'FPlain-E' },
        { row: 4, col: 3, label: 'CBD-D' },
      ]
    : [
        { row: 7, col: 3, label: 'LLand-D' },
        { row: 6, col: 4, label: 'FPlain-E' },
        { row: 5, col: 3, label: 'RBank-D' },
        { row: 4, col: 3, label: 'CBD-D' },
        { row: 2, col: 3, label: 'Suburb-D' },
        { row: 0, col: 4, label: 'N.Hill-E' },
      ]

  const seen = new Set()
  const regions = trackRegions.filter(r => !seen.has(r.label) && seen.add(r.label))

  const wlData = time_steps.map((t, i) => {
    const p = { time: t }
    regions.forEach(r => { p[r.label] = water_history[i][r.row][r.col] })
    return p
  })

  const popData = time_steps.map((t, i) => ({
    time: t,
    'Warning': affected_population[i].warning,
    'Critical': affected_population[i].critical,
  }))

  const tfmt = v => `${Number(v).toFixed(0)}H`

  return (
    <div className="hud-panel shrink-0">
      <div className="hud-panel-header justify-between">
        <span className="label-sys">DATA // LINK</span>
        {selectedCell && (
          <span style={{
            fontFamily: 'Share Tech Mono', fontSize: 9,
            color: 'var(--cyan)', letterSpacing: '0.1em',
          }}>
            TRACKING // {selectedCell.name.toUpperCase()}
          </span>
        )}
        <span className="label-sys">SYS E</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border-dim)' }}>
        {/* Water level chart */}
        <div style={{ padding: '10px 12px', borderRight: '1px solid var(--border-dim)' }}>
          <div className="readout-label" style={{ marginBottom: 8 }}>WATER LEVEL // MM</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={wlData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" {...gridStyle} />
              <XAxis dataKey="time" tickFormatter={tfmt} tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip content={<HudTooltip />} />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'Share Tech Mono', color: 'rgba(255,255,255,0.4)' }}
                      iconType="square" iconSize={5} />
              <ReferenceLine y={warn} stroke="rgba(255,171,0,0.5)" strokeDasharray="3 3" strokeWidth={1}
                label={{ value: 'WARN', fill: 'rgba(255,171,0,0.6)', fontSize: 8, position: 'right', fontFamily: 'Share Tech Mono' }} />
              <ReferenceLine y={crit} stroke="rgba(255,23,68,0.5)" strokeDasharray="3 3" strokeWidth={1}
                label={{ value: 'CRIT', fill: 'rgba(255,23,68,0.7)', fontSize: 8, position: 'right', fontFamily: 'Share Tech Mono' }} />
              <ReferenceLine x={time_steps[currentStep]} stroke="rgba(0,229,255,0.4)" strokeWidth={1} />
              {regions.map((r, i) => (
                <Line key={r.label} type="monotone" dataKey={r.label}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={r.label === selectedCell?.name ? 2 : 1}
                  dot={false} activeDot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Population chart */}
        <div style={{ padding: '10px 12px' }}>
          <div className="readout-label" style={{ marginBottom: 8 }}>AFFECTED POPULATION</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={popData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" {...gridStyle} />
              <XAxis dataKey="time" tickFormatter={tfmt} tick={axisStyle} />
              <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} tick={axisStyle} />
              <Tooltip content={<HudTooltip />} />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'Share Tech Mono', color: 'rgba(255,255,255,0.4)' }}
                      iconType="square" iconSize={5} />
              <ReferenceLine x={time_steps[currentStep]} stroke="rgba(0,229,255,0.4)" strokeWidth={1} />
              <Area type="monotone" dataKey="Warning" stackId="1"
                stroke="rgba(255,171,0,0.8)" fill="rgba(255,171,0,0.15)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="Critical" stackId="1"
                stroke="rgba(255,23,68,0.8)" fill="rgba(255,23,68,0.2)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
