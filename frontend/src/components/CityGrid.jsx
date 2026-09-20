import { useState } from 'react'

const STATUS_CFG = {
  Safe:     { border: 'rgba(0,230,118,0.35)',  water: 'rgba(0,230,118,0.45)',  text: '#00e676' },
  Warning:  { border: 'rgba(255,171,0,0.5)',   water: 'rgba(255,171,0,0.55)',  text: '#ffab00' },
  Critical: { border: 'rgba(255,23,68,0.7)',   water: 'rgba(255,23,68,0.80)',  text: '#ff1744' },
}

// Zone metadata: risk level, short type description
const ZONE_META = [
  { risk: 'MINIMAL',  riskColor: '#00e676', tag: 'High ground · Best drainage'       },
  { risk: 'LOW',      riskColor: '#69f0ae', tag: 'Sloping terrain · Good runoff'      },
  { risk: 'LOW',      riskColor: '#69f0ae', tag: 'Residential · Moderate drainage'    },
  { risk: 'MODERATE', riskColor: '#ffab00', tag: 'Mixed use · Transitional zone'      },
  { risk: 'MODERATE', riskColor: '#ffab00', tag: 'Urban core · Best infrastructure'   },
  { risk: 'HIGH',     riskColor: '#ff6d00', tag: 'River edge · Flood-prone'           },
  { risk: 'VERY HIGH',riskColor: '#ff1744', tag: 'Flood plain · Poor drainage'        },
  { risk: 'EXTREME',  riskColor: '#d500f9', tag: 'Lowest point · Almost no drainage'  },
]

function elevBg(e) {
  if (e >= 36) return '#0a0e0a'
  if (e >= 20) return '#070d07'
  if (e >= 8)  return '#050a05'
  return '#030703'
}

function Tooltip({ name, wl, elev, pop, status, ttc, isBlocked, zoneIdx }) {
  const zm = ZONE_META[zoneIdx] ?? ZONE_META[0]
  return (
    <div style={{
      position: 'absolute', bottom: '110%', left: '50%',
      transform: 'translateX(-50%)', zIndex: 100,
      background: '#0a0a0a', border: '1px solid var(--border)',
      padding: '10px 12px', minWidth: 200, pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      <div style={{ position:'absolute', top:0,    left:0,  width:6, height:6, borderTop:'1px solid var(--cyan)',    borderLeft:'1px solid var(--cyan)'   }} />
      <div style={{ position:'absolute', top:0,    right:0, width:6, height:6, borderTop:'1px solid var(--cyan)',    borderRight:'1px solid var(--cyan)'  }} />
      <div style={{ position:'absolute', bottom:0, left:0,  width:6, height:6, borderBottom:'1px solid var(--cyan)', borderLeft:'1px solid var(--cyan)'   }} />
      <div style={{ position:'absolute', bottom:0, right:0, width:6, height:6, borderBottom:'1px solid var(--cyan)', borderRight:'1px solid var(--cyan)'  }} />

      <div style={{ fontFamily: 'Bebas Neue', fontSize: 15, color: 'white', letterSpacing: '0.08em', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-dim)' }}>
        {name.replace('-', ' // ')}
      </div>

      {/* Risk badge */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: '0.15em',
          padding: '2px 7px', background: `${zm.riskColor}22`,
          border: `1px solid ${zm.riskColor}55`, color: zm.riskColor,
        }}>
          FLOOD RISK: {zm.risk}
        </span>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
          {zm.tag}
        </div>
      </div>

      {[
        ['WATER LEVEL', `${wl.toFixed(1)} MM`],
        ['ELEVATION',   `${elev} M`],
        ['POPULATION',  `${(pop * 1000).toLocaleString()}`],
      ].map(([k, v]) => (
        <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:24, marginBottom:3 }}>
          <span style={{ fontFamily:'Share Tech Mono', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.12em' }}>{k}</span>
          <span style={{ fontFamily:'Share Tech Mono', fontSize:9, color:'white' }}>{v}</span>
        </div>
      ))}
      {ttc !== null && ttc !== undefined && (
        <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid var(--border-dim)', fontFamily:'Share Tech Mono', fontSize:9, color:'var(--red)', letterSpacing:'0.1em' }}>
          ⚠ CRITICAL IN {ttc.toFixed(2)}H
        </div>
      )}
      {isBlocked && (
        <div style={{ fontFamily:'Share Tech Mono', fontSize:9, color:'#d500f9', marginTop:4 }}>🚫 DRAINAGE BLOCKED</div>
      )}
    </div>
  )
}

function Cell({ row, col, wl, status, name, elev, pop, ttc, isSelected, isBlocked, onSelect, critThresh }) {
  const [hover, setHover] = useState(false)
  const cfg    = STATUS_CFG[status] ?? STATUS_CFG.Safe
  const pct    = Math.min((wl / critThresh) * 100, 100)
  const isCrit = status === 'Critical'
  // Short label: just the column letter from name like "N.Hill-A" → "A"
  const colLetter = name.split('-').pop()
  // Row zone abbreviation
  const zoneAbbr  = name.split('-')[0]

  return (
    <div
      className={`grid-cell ${isCrit ? 'cell-critical' : ''} ${isSelected ? 'selected' : ''}`}
      style={{ background: elevBg(elev), borderColor: isBlocked ? 'rgba(213,0,249,0.5)' : cfg.border, aspectRatio: '1/1' }}
      onClick={() => onSelect({ row, col, name, waterLevel: wl, status, elevation: elev, population: pop, timeToC: ttc })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Water fill */}
      <div className="water-fill" style={{ height: `${pct}%`, background: cfg.water }} />

      {/* Cell content */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 2, padding: '3px 2px', gap: 2,
      }}>
        {/* Zone abbreviation */}
        <span style={{
          fontFamily: 'Share Tech Mono', fontSize: 10,
          color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em',
          lineHeight: 1, textAlign: 'center',
        }}>
          {zoneAbbr}
        </span>
        {/* Column letter */}
        <span style={{
          fontFamily: 'Bebas Neue', fontSize: 20,
          color: 'white',
          lineHeight: 1, letterSpacing: '0.05em',
        }}>
          {colLetter}
        </span>
        {/* Water level */}
        {wl > 0 && (
          <span style={{
            fontFamily: 'Share Tech Mono', fontSize: 11,
            color: 'white', lineHeight: 1, fontWeight: 'bold',
          }}>
            {wl.toFixed(0)}mm
          </span>
        )}
        {/* Status badge */}
        {status !== 'Safe' && (
          <div style={{
            fontSize: 8, fontFamily: 'Share Tech Mono', letterSpacing: '0.1em',
            color: 'white', padding: '1px 4px',
            background: `${cfg.text}44`, border: `1px solid ${cfg.text}88`,
            lineHeight: 1,
          }}>
            {status === 'Critical' ? 'CRIT' : 'WARN'}
          </div>
        )}
      </div>

      {hover && (
        <Tooltip name={name} wl={wl} elev={elev} pop={pop}
                 status={status} ttc={ttc} isBlocked={isBlocked} zoneIdx={row} />
      )}
    </div>
  )
}

export default function CityGrid({ water, status, metadata, thresholds, timeToC, selectedCell, onSelectCell, blockedChannels = [] }) {
  const GRID       = 8
  const critThresh = thresholds?.critical ?? 300
  const blockedSet = new Set(blockedChannels.map(([r, c]) => `${r},${c}`))

  const counts = status
    ? status.flat().reduce((a, s) => ({ ...a, [s]: (a[s] || 0) + 1 }), {})
    : null

  return (
    <div className="hud-panel bracket" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="hud-panel-header justify-between">
        <span className="label-sys">FLOOD // TACTICAL MAP</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {counts && ['Safe','Warning','Critical'].map(s => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{
                width:7, height:7,
                background: s==='Safe' ? 'var(--green)' : s==='Warning' ? 'var(--amber)' : 'var(--red)',
              }} />
              <span className="readout-label" style={{ fontSize:9 }}>
                {s.toUpperCase()} {counts[s] || 0}
              </span>
            </div>
          ))}
          <span className="label-sys">8×8 GRID</span>
        </div>
      </div>

      {!metadata ? (
        <div style={{ padding: 48, display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{
            width:60, height:60, border:'1px solid var(--border)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }} className="bracket bracket-bottom">
            <span className="font-display text-3xl" style={{ color:'var(--cyan)', opacity:0.3 }}>FS</span>
          </div>
          <div className="font-display text-lg tracking-widest" style={{ color:'var(--text-muted)' }}>
            AWAITING SIMULATION INPUT
          </div>
          <div className="readout-label">SELECT A SCENARIO OR CONFIGURE CUSTOM PARAMETERS</div>
        </div>
      ) : (
        <div style={{ padding: '10px 14px 14px' }}>

          {/* Zone risk legend strip — above the grid */}
          <div style={{ marginBottom: 10 }}>
            <div className="readout-label" style={{ marginBottom: 5 }}>ZONE FLOOD RISK GUIDE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
              {metadata.zone_labels?.map((z, i) => {
                const zm = ZONE_META[i]
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px',
                    background: '#080808',
                    border: `1px solid ${zm.riskColor}33`,
                    borderLeft: `3px solid ${zm.riskColor}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 11,
                        color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em',
                        textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 2,
                      }}>
                        {z}
                      </div>
                      <div style={{
                        fontFamily: 'Share Tech Mono', fontSize: 8,
                        color: 'var(--text-muted)', lineHeight: 1.2,
                      }}>
                        {zm.tag}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'Share Tech Mono', fontSize: 8,
                      color: zm.riskColor, letterSpacing: '0.08em',
                      textAlign: 'right', flexShrink: 0,
                      padding: '1px 4px',
                      border: `1px solid ${zm.riskColor}44`,
                      background: `${zm.riskColor}11`,
                    }}>
                      {zm.risk}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Column A–H labels */}
          <div style={{ display: 'flex', marginLeft: 94, marginBottom: 3, gap: 4 }}>
            {['A','B','C','D','E','F','G','H'].map(c => (
              <div key={c} style={{
                width: 86, textAlign: 'center',
                fontFamily: 'Bebas Neue', fontSize: 15,
                color: 'rgba(0,229,255,0.5)', letterSpacing: '0.08em',
              }}>
                {c}
              </div>
            ))}
          </div>

          {/* Zone row labels + grid */}
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Left zone labels with risk */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {metadata.zone_labels?.map((z, i) => {
                const zm = ZONE_META[i]
                return (
                  <div key={i} style={{
                    height: 86,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', justifyContent: 'center',
                    width: 88, paddingRight: 8, gap: 3,
                  }}>
                    <div style={{
                      fontFamily: 'Share Tech Mono', fontSize: 9,
                      color: 'rgba(255,255,255,0.7)', textAlign: 'right',
                      letterSpacing: '0.04em', lineHeight: 1.2,
                    }}>
                      {z.toUpperCase()}
                    </div>
                    <div style={{
                      fontFamily: 'Share Tech Mono', fontSize: 8,
                      color: zm.riskColor, letterSpacing: '0.08em',
                      padding: '1px 5px',
                      border: `1px solid ${zm.riskColor}44`,
                      background: `${zm.riskColor}11`,
                      textAlign: 'right',
                    }}>
                      {zm.risk}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 8×8 grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID}, 86px)`,
              gridTemplateRows:    `repeat(${GRID}, 86px)`,
              gap: 4,
            }}>
              {Array.from({ length: GRID }, (_, row) =>
                Array.from({ length: GRID }, (_, col) => (
                  <Cell
                    key={`${row}-${col}`}
                    row={row} col={col}
                    wl={water ? water[row][col] : 0}
                    status={status ? status[row][col] : 'Safe'}
                    name={metadata.names[row][col]}
                    elev={metadata.elevation[row][col]}
                    pop={metadata.population[row][col]}
                    ttc={timeToC ? timeToC[row][col] : null}
                    isSelected={selectedCell?.row === row && selectedCell?.col === col}
                    isBlocked={blockedSet.has(`${row},${col}`)}
                    onSelect={onSelectCell}
                    critThresh={critThresh}
                  />
                ))
              )}
            </div>

            {/* Right legend panel — pushed to far right */}
            <div style={{
              marginLeft: 'auto', width: 180, flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {/* Water depth legend */}
              <div style={{
                background: '#080808', border: '1px solid var(--border)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: 14, color: 'var(--cyan)',
                  letterSpacing: '0.15em', marginBottom: 10, paddingBottom: 7,
                  borderBottom: '1px solid var(--border-dim)',
                }}>
                  WATER DEPTH
                </div>
                {[
                  { label: 'SAFE',     range: '0 – 99 mm',    color: '#00e676', bar: 'rgba(0,230,118,0.25)'  },
                  { label: 'WARNING',  range: '100 – 299 mm', color: '#ffab00', bar: 'rgba(255,171,0,0.25)'  },
                  { label: 'CRITICAL', range: '≥ 300 mm',     color: '#ff1744', bar: 'rgba(255,23,68,0.25)'  },
                ].map(({ label, range, color, bar }) => (
                  <div key={label} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color, letterSpacing: '0.08em', fontWeight: 'bold' }}>{label}</span>
                      <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{range}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, background: bar, borderLeft: `3px solid ${color}` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Rainfall intensity legend */}
              <div style={{
                background: '#080808', border: '1px solid var(--border)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: 14, color: 'var(--cyan)',
                  letterSpacing: '0.15em', marginBottom: 10, paddingBottom: 7,
                  borderBottom: '1px solid var(--border-dim)',
                }}>
                  RAINFALL RISK
                </div>
                {[
                  { label: 'LOW',      range: '0 – 30 mm/hr',   color: '#00e676', note: 'Normal ops'   },
                  { label: 'MODERATE', range: '31 – 50 mm/hr',  color: '#69f0ae', note: 'Monitor'      },
                  { label: 'ELEVATED', range: '51 – 80 mm/hr',  color: '#ffab00', note: 'Stress mode'  },
                  { label: 'SEVERE',   range: '81 – 120 mm/hr', color: '#ff6d00', note: 'High risk'    },
                  { label: 'EXTREME',  range: '> 120 mm/hr',    color: '#ff1744', note: 'Catastrophic' },
                ].map(({ label, range, color, note }) => (
                  <div key={label} style={{
                    marginBottom: 8, paddingBottom: 8,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: `3px solid ${color}`,
                    paddingLeft: 8,
                  }}>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color, letterSpacing: '0.08em', fontWeight: 'bold' }}>{label}</span>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{range}</div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{note}</div>
                  </div>
                ))}
              </div>

              {/* Drainage capacity */}
              <div style={{
                background: '#080808', border: '1px solid var(--border)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: 14, color: 'var(--cyan)',
                  letterSpacing: '0.15em', marginBottom: 10, paddingBottom: 7,
                  borderBottom: '1px solid var(--border-dim)',
                }}>
                  DRAINAGE CAPACITY
                </div>
                {[
                  { zone: 'Northern Hills',    range: '22–30',  color: '#00e676' },
                  { zone: 'Upper Suburbs',     range: '18–25',  color: '#69f0ae' },
                  { zone: 'Suburbs',           range: '14–20',  color: '#b2ff59' },
                  { zone: 'Inner City',        range: '14–26',  color: '#ffab00' },
                  { zone: 'Downtown',          range: '12–32',  color: '#ffd740' },
                  { zone: 'River Bank',        range: '6–8',    color: '#ff6d00' },
                  { zone: 'Flood Plain',       range: '2–5',    color: '#ff1744' },
                  { zone: 'S. Lowlands',       range: '0–3',    color: '#d500f9' },
                ].map(({ zone, range, color }) => (
                  <div key={zone} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 6,
                    borderLeft: `2px solid ${color}`, paddingLeft: 6,
                  }}>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>{zone}</span>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color, fontWeight: 'bold' }}>{range}<span style={{ fontSize: 8, color: 'var(--text-muted)' }}> mm/hr</span></span>
                  </div>
                ))}
                <div style={{
                  marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-dim)',
                  fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}>
                  Rainfall above capacity causes accumulation
                </div>
              </div>
            </div>
          </div>

          {/* Colour scale */}
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10 }}>
            <span className="readout-label" style={{ fontSize:8 }}>WATER DEPTH SCALE</span>
            <div style={{ flex:1, height:2, background:'linear-gradient(to right, #00e676, #ffab00, #ff1744)' }} />
            <div style={{ display:'flex', gap:14, fontFamily:'Share Tech Mono', fontSize:8, color:'var(--text-muted)' }}>
              <span>0mm</span>
              <span style={{ color:'var(--amber)' }}>100mm WARN</span>
              <span style={{ color:'var(--red)' }}>300mm CRIT</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
