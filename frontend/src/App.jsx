import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import Header from './components/Header'
import ControlPanel from './components/ControlPanel'
import CityGrid from './components/CityGrid'
import TimeSlider from './components/TimeSlider'
import AlertPanel from './components/AlertPanel'
import StatsPanel from './components/StatsPanel'
import WaterLevelChart from './components/WaterLevelChart'
import ScenarioComparison from './components/ScenarioComparison'
import PopulationPanel from './components/PopulationPanel'
import SituationBrief from './components/SituationBrief'
import RealTerrainMap from './components/RealTerrainMap'
import EarlyWarningDashboard from './components/EarlyWarningDashboard'

const API = '/api'

// Wave layer definitions — all share viewBox height 500, container 50vh
// Each path: wave crest → fill down to y=500 (container bottom)
const WAVE_LAYERS = [
  { fill: 'rgba(0,12,35,1)',      path: 'M0,400 C200,368 420,432 640,396 C860,360 1060,428 1260,396 C1350,380 1400,404 1440,400 L1440,500 L0,500 Z', dur: '22s', delay: '0s'   },
  { fill: 'rgba(0,38,68,0.96)',   path: 'M0,338 C180,298 400,370 600,332 C800,294 1000,366 1200,328 C1310,308 1390,336 1440,338 L1440,500 L0,500 Z', dur: '17s', delay: '-5s'  },
  { fill: 'rgba(0,68,102,0.90)',  path: 'M0,275 C160,232 370,308 570,268 C770,228 975,302 1175,262 C1295,240 1380,272 1440,275 L1440,500 L0,500 Z', dur: '13s', delay: '-9s'  },
  { fill: 'rgba(0,105,140,0.82)', path: 'M0,210 C170,165 390,245 590,205 C790,165 990,242 1190,202 C1305,180 1385,208 1440,210 L1440,500 L0,500 Z', dur: '10s', delay: '-3s'  },
  { fill: 'rgba(0,148,180,0.68)', path: 'M0,150 C155,106 368,182 568,142 C768,102 968,178 1168,138 C1290,114 1378,148 1440,150 L1440,500 L0,500 Z', dur: '8s',  delay: '-7s'  },
  { fill: 'rgba(0,188,218,0.38)', path: 'M0,92  C148,50  358,118 558,78  C758,38  958,114 1158,74  C1280,50  1374,90  1440,92  L1440,500 L0,500 Z', dur: '6s',  delay: '-2s'  },
]

function LandingHero({ onSelectTab }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000', overflow: 'hidden' }}>

      {/* Text + pills in the upper portion */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 10, textAlign: 'center', padding: '0 24px',
      }}>
        <div className="label-cyan" style={{ fontSize: 13, marginBottom: 20, letterSpacing: '0.28em' }}>
          EARLY WARNING SYSTEM · SERIES 01
        </div>

        <div className="font-display" style={{ fontSize: 100, lineHeight: 0.88, color: 'white', marginBottom: 10 }}>
          FLOWSHIELD
        </div>

        <div style={{
          fontFamily: 'Rajdhani', fontSize: 19, color: 'rgba(255,255,255,0.55)',
          maxWidth: 560, lineHeight: 1.82, marginBottom: 50, fontWeight: 500,
        }}>
          Real-time urban flood simulation and early warning platform.
          Model drainage networks, track rising water across real terrain,
          and generate AI tactical briefs for emergency response teams.
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            ['simulation', 'SIMULATION'],
            ['terrain',    'REAL TERRAIN'],
            ['compare',    'SCENARIO COMPARISON'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              onMouseEnter={() => setHovered(tab)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '13px 32px',
                borderRadius: 999,
                background: hovered === tab ? 'rgba(0,229,255,0.18)' : 'rgba(0,229,255,0.07)',
                border: `1px solid ${hovered === tab ? 'rgba(0,229,255,0.78)' : 'rgba(0,229,255,0.32)'}`,
                color: 'var(--cyan)',
                fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, letterSpacing: '0.2em',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: hovered === tab ? '0 0 22px rgba(0,229,255,0.2)' : 'none',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Animated wave layers — all 50vh tall, stacked from bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}>
        {/* Soft gradient edge blending waves into the black above */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '35%', zIndex: 10,
          background: 'linear-gradient(to bottom, #000 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        {WAVE_LAYERS.map((l, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: 0, left: 0,
            width: '200%', height: '100%',
            animation: `wave-flow ${l.dur} ${l.delay} linear infinite`,
          }}>
            {[0, 1].map(j => (
              <svg key={j} viewBox="0 0 1440 500" preserveAspectRatio="none"
                   style={{ width: '50%', height: '100%', display: 'inline-block' }}>
                <path d={l.path} fill={l.fill} />
              </svg>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [simData,      setSimData]      = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [currentStep,  setCurrentStep]  = useState(0)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [playSpeed,    setPlaySpeed]    = useState(300)
  const [selectedCell, setSelectedCell] = useState(null)
  const [scenarios,    setScenarios]    = useState({})
  const [activeTab,    setActiveTab]    = useState('landing')
  const [config, setConfig] = useState({
    rainfall_intensity: 50,
    duration_hours: 12,
    time_step: 0.25,
    drainage_failure: false,
    drainage_scale: 1.0,
    blocked_channels: [],
    scenario: 'custom',
  })
  const playRef = useRef(null)

  useEffect(() => {
    axios.get(`${API}/scenarios`).then(r => setScenarios(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isPlaying || !simData) return
    const max = simData.time_steps.length - 1
    playRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= max) { setIsPlaying(false); return prev }
        return prev + 1
      })
    }, playSpeed)
    return () => clearInterval(playRef.current)
  }, [isPlaying, simData, playSpeed])

  const runSimulation = useCallback(async (cfg = config) => {
    setLoading(true); setError(null); setIsPlaying(false); setCurrentStep(0)
    try {
      const res = await axios.post(`${API}/simulate`, cfg)
      setSimData(res.data)
    } catch { setError('Cannot reach simulation server. Is the backend running?') }
    finally { setLoading(false) }
  }, [config])

  const runScenario = useCallback(async (name) => {
    setLoading(true); setError(null); setIsPlaying(false); setCurrentStep(0)
    try {
      const res = await axios.post(`${API}/simulate/scenario/${name}`)
      setSimData(res.data)
      setConfig(prev => ({ ...prev, ...scenarios[name], scenario: name }))
    } catch { setError('Scenario simulation failed.') }
    finally { setLoading(false) }
  }, [scenarios])

  const resetSim = () => {
    setSimData(null); setCurrentStep(0); setIsPlaying(false); setSelectedCell(null)
  }

  const currentWater  = simData?.water_history?.[currentStep]  ?? null
  const currentStatus = simData?.status_history?.[currentStep] ?? null
  const currentTime   = simData?.time_steps?.[currentStep]     ?? 0

  if (activeTab === 'landing') {
    return <LandingHero onSelectTab={setActiveTab} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Sticky header + tab bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#000' }}>
        <Header simData={simData} currentTime={currentTime} loading={loading} onHome={() => setActiveTab('landing')} />
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
          {[['simulation','SIMULATION'],['terrain','REAL TERRAIN'],['compare','SCENARIO COMPARISON']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '7px 18px',
              fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: activeTab === tab ? 'var(--cyan)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: -1,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'simulation' ? (
        <div style={{ padding: '12px 12px 60px' }}>

          {error && (
            <div style={{
              marginBottom: 10, padding: '8px 14px', fontSize: 13,
              background: 'var(--red-dim)', border: '1px solid rgba(255,23,68,0.35)',
              fontFamily: 'Share Tech Mono', color: 'var(--red)', letterSpacing: '0.1em',
            }}>
              ⚠ {error.toUpperCase()}
            </div>
          )}

          {/* ── Three-column layout: Controls | Grid | Warning Dashboard ── */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

            {/* LEFT — control panel */}
            <div style={{ width: 252, flexShrink: 0 }}>
              <ControlPanel
                config={config} setConfig={setConfig}
                onRun={() => runSimulation()}
                onRunScenario={runScenario}
                onReset={resetSim}
                loading={loading}
                hasData={!!simData}
              />
            </div>

            {/* MIDDLE — city grid + timeline + detail panels */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading ? (
                <div style={{
                  height: 500, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 16,
                  border: '1px solid var(--border)', background: 'var(--bg2)',
                }}>
                  <div style={{
                    width: 36, height: 36,
                    border: '1px solid var(--cyan)', borderTop: '1px solid transparent',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <div className="label-cyan" style={{ letterSpacing: '0.3em' }}>COMPUTING SIMULATION</div>
                </div>
              ) : (
                <CityGrid
                  water={currentWater}
                  status={currentStatus}
                  metadata={simData?.grid_metadata}
                  thresholds={simData?.thresholds}
                  timeToC={simData?.time_to_critical}
                  selectedCell={selectedCell}
                  onSelectCell={setSelectedCell}
                  blockedChannels={config.blocked_channels}
                />
              )}

              {simData && (
                <TimeSlider
                  totalSteps={simData.time_steps.length - 1}
                  currentStep={currentStep}
                  setCurrentStep={setCurrentStep}
                  timeSteps={simData.time_steps}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  playSpeed={playSpeed}
                  setPlaySpeed={setPlaySpeed}
                />
              )}

              {simData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <PopulationPanel simData={simData} currentStep={currentStep} />
                  <StatsPanel simData={simData} currentStep={currentStep} currentTime={currentTime} />
                </div>
              )}

              {simData && (
                <WaterLevelChart simData={simData} currentStep={currentStep} selectedCell={selectedCell} />
              )}

              {simData && <SituationBrief simData={simData} config={config} />}

              <AlertPanel
                status={currentStatus}
                metadata={simData?.grid_metadata}
                timeToC={simData?.time_to_critical}
                onSelectCell={setSelectedCell}
              />
            </div>

            {/* RIGHT — Early Warning Dashboard */}
            <div style={{ width: 265, flexShrink: 0 }}>
              <EarlyWarningDashboard
                statusGrid={currentStatus}
                waterGrid={currentWater}
                names={simData?.grid_metadata?.names}
                population={simData?.grid_metadata?.population}
                timeToC={simData?.time_to_critical}
                currentTime={currentTime}
                simReady={!!simData}
              />
            </div>

          </div>
        </div>
      ) : activeTab === 'terrain' ? (
        <RealTerrainMap />
      ) : (
        <ScenarioComparison scenarios={scenarios} />
      )}
    </div>
  )
}
