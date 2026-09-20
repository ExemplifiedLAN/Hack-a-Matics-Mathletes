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

const API = '/api'

export default function App() {
  const [simData,      setSimData]      = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [currentStep,  setCurrentStep]  = useState(0)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [playSpeed,    setPlaySpeed]    = useState(300)
  const [selectedCell, setSelectedCell] = useState(null)
  const [scenarios,    setScenarios]    = useState({})
  const [activeTab,    setActiveTab]    = useState('simulation')
  const [config, setConfig] = useState({
    rainfall_intensity: 50,
    duration_hours: 12,
    time_step: 0.25,
    drainage_failure: false,
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

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <div className="scan-line" />

      {/* Sticky header + tab bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#000' }}>
        <Header simData={simData} currentStep={currentStep} currentTime={currentTime} loading={loading} />
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
          {[['simulation','SIMULATION // ACTIVE'],['compare','SCENARIO // COMPARE']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '7px 18px',
              fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 11,
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
              marginBottom: 10, padding: '8px 14px', fontSize: 11,
              background: 'var(--red-dim)', border: '1px solid rgba(255,23,68,0.35)',
              fontFamily: 'Share Tech Mono', color: 'var(--red)', letterSpacing: '0.1em',
            }}>
              ⚠ {error.toUpperCase()}
            </div>
          )}

          {/* ── Section 1: Controls + Grid (side by side) ── */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>

            {/* Left — control panel */}
            <div style={{ width: 248, flexShrink: 0 }}>
              <ControlPanel
                config={config} setConfig={setConfig}
                scenarios={scenarios}
                onRun={() => runSimulation()}
                onRunScenario={runScenario}
                onReset={resetSim}
                loading={loading}
                hasData={!!simData}
              />
            </div>

            {/* Right — city grid */}
            <div style={{ flex: 1 }}>
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
            </div>
          </div>

          {/* ── Section 2: Timeline (full width) ── */}
          {simData && (
            <div style={{ marginBottom: 10 }}>
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
            </div>
          )}

          {/* ── Section 3: Population + Stats (side by side, full width) ── */}
          {simData && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <PopulationPanel simData={simData} currentStep={currentStep} />
              <StatsPanel simData={simData} currentStep={currentStep} currentTime={currentTime} />
            </div>
          )}

          {/* ── Section 4: Charts (full width) ── */}
          {simData && (
            <div style={{ marginBottom: 10 }}>
              <WaterLevelChart
                simData={simData}
                currentStep={currentStep}
                selectedCell={selectedCell}
              />
            </div>
          )}

          {/* ── Section 5: Situation Brief (full width) ── */}
          {simData && (
            <div style={{ marginBottom: 10 }}>
              <SituationBrief simData={simData} config={config} />
            </div>
          )}

          {/* ── Section 6: Alert panel (full width) ── */}
          <div>
            <AlertPanel
              status={currentStatus}
              metadata={simData?.grid_metadata}
              timeToC={simData?.time_to_critical}
              onSelectCell={setSelectedCell}
            />
          </div>
        </div>
      ) : (
        <ScenarioComparison scenarios={scenarios} />
      )}
    </div>
  )
}
