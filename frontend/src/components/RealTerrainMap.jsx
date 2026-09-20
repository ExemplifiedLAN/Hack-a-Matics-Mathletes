import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import EarlyWarningDashboard from './EarlyWarningDashboard'

const API = '/api'

function elevFill(norm) {
  const r = Math.round(220 - norm * 190)
  const g = Math.round(80  + norm * 100)
  const b = Math.round(20  - norm * 15)
  return `rgb(${r},${g},${b})`
}

// Compute square-ish grid rows/cols from km dimensions and cell size
function computeGrid(heightKm, widthKm, cellKm) {
  const nr = Math.max(4, Math.min(40, Math.round(heightKm / cellKm)))
  const nc = Math.max(4, Math.min(40, Math.round(widthKm  / cellKm)))
  return { nr, nc }
}

export default function RealTerrainMap() {
  const mapRef    = useRef(null)
  const mapDivRef = useRef(null)
  const cellsRef  = useRef([])

  const [cellSize,        setCellSize]        = useState(1.0)   // km per cell
  const [searchQuery,     setSearchQuery]      = useState('')
  const [suggestions,     setSuggestions]      = useState([])
  const [center,          setCenter]           = useState(null)
  const [selectionBounds, setSelectionBounds]  = useState(null)
  const [drawMode,        setDrawMode]         = useState(false)
  const [terrain,         setTerrain]          = useState(null)
  const [simResult,       setSimResult]        = useState(null)
  const [currentStep,     setCurrentStep]      = useState(0)
  const [isPlaying,       setIsPlaying]        = useState(false)
  const [rainfall,        setRainfall]         = useState(80)
  const [duration,        setDuration]         = useState(12)
  const [drainageScale,   setDrainageScale]    = useState(1.0)   // 0.1–1.0 multiplier on drainage capacity
  const [originCells,     setOriginCells]      = useState([])
  const [blockedCells,    setBlockedCells]     = useState([])
  const [pickType,        setPickType]         = useState(null)
  const [loadingT,        setLoadingT]         = useState(false)
  const [loadingS,        setLoadingS]         = useState(false)
  const [errMsg,          setErrMsg]           = useState(null)
  const [brief,           setBrief]            = useState(null)
  const [loadingBrief,    setLoadingBrief]     = useState(false)

  const playRef      = useRef(null)
  const pickTypeRef  = useRef(null)
  const originRef    = useRef([])
  const blockedRef   = useRef([])
  const cellSizeRef  = useRef(cellSize)

  // Compute current grid dims
  const getGridDims = useCallback((bounds) => {
    if (bounds) {
      const midLat   = (bounds.north + bounds.south) / 2
      const heightKm = (bounds.north - bounds.south) * 111.32
      const widthKm  = (bounds.east  - bounds.west)  * 111.32 * Math.cos(midLat * Math.PI / 180)
      return computeGrid(heightKm, widthKm, cellSizeRef.current)
    }
    const n = Math.max(4, Math.min(40, Math.round(16 / cellSizeRef.current)))
    return { nr: n, nc: n }
  }, [])

  // ── Init Leaflet ───────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return
    const L = window.L
    if (!L) { setErrMsg('Leaflet not loaded.'); return }

    const map = L.map(mapDivRef.current, { zoomControl: true }).setView([20, 0], 3)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map)

    map.on('click', e => {
      if (map._clickMode) {
        setCenter({ lat: e.latlng.lat, lon: e.latlng.lng })
        setSelectionBounds(null)
        setTerrain(null); setSimResult(null); setCurrentStep(0)
        map._clickMode = false
        mapDivRef.current.style.cursor = ''
      }
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Draw-area (Snipping-Tool style) ───────────────────────────────
  const startAreaDraw = useCallback(() => {
    const map = mapRef.current
    const L   = window.L
    if (!map || !L) return

    map.dragging.disable()
    mapDivRef.current.style.cursor = 'crosshair'
    setDrawMode(true)

    let startLL  = null
    let drawRect = null

    const onDown = e => {
      startLL  = e.latlng
      drawRect = L.rectangle([startLL, startLL], {
        color: '#00e5ff', weight: 2, dashArray: '6 4',
        fillColor: '#00e5ff', fillOpacity: 0.07, interactive: false,
      }).addTo(map)
    }

    const onMove = e => {
      if (startLL && drawRect) drawRect.setBounds([startLL, e.latlng])
    }

    const finish = () => {
      if (!startLL) return
      const bounds = drawRect ? drawRect.getBounds() : null
      if (drawRect) { drawRect.remove(); drawRect = null }

      map.off('mousedown', onDown)
      map.off('mousemove', onMove)
      map.off('mouseup',   finish)
      document.removeEventListener('mouseup', finish)
      map.dragging.enable()
      mapDivRef.current.style.cursor = ''
      setDrawMode(false)

      if (bounds && bounds.isValid()) {
        const n = bounds.getNorth(), s = bounds.getSouth()
        const e = bounds.getEast(),  w = bounds.getWest()
        if (Math.abs(n - s) > 0.005 && Math.abs(e - w) > 0.005) {
          setSelectionBounds({ north: n, south: s, east: e, west: w })
          setCenter({ lat: (n + s) / 2, lon: (e + w) / 2 })
          setTerrain(null); setSimResult(null); setCurrentStep(0)
          setOriginCells([]); setBlockedCells([])
          originRef.current = []; blockedRef.current = []
        }
      }
      startLL = null
    }

    map.on('mousedown', onDown)
    map.on('mousemove', onMove)
    map.on('mouseup',   finish)
    document.addEventListener('mouseup', finish, { once: true })
  }, [])

  useEffect(() => {
    if (!drawMode) return
    const onKey = e => {
      if (e.key !== 'Escape') return
      const map = mapRef.current
      if (map) { map.dragging.enable(); map.off('mousedown'); map.off('mousemove'); map.off('mouseup') }
      if (mapDivRef.current) mapDivRef.current.style.cursor = ''
      setDrawMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawMode])

  // ── Draw grid rectangles ───────────────────────────────────────────
  const drawGrid = useCallback((terrainData, statusGrid, origins, blocked) => {
    const L   = window.L
    const map = mapRef.current
    if (!L || !map || !terrainData) return

    cellsRef.current.forEach(l => l.remove())
    cellsRef.current = []

    const NR = terrainData.names.length
    const NC = terrainData.names[0].length
    const { north, cell_lat, cell_lon, west } = terrainData.bounds

    const isRiver    = (r, c) => terrainData.river_cells.some(([rr, cc]) => rr === r && cc === c)
    const isOrigin   = (r, c) => origins.some(([rr, cc]) => rr === r && cc === c)
    const isBlocked  = (r, c) => blocked.some(([rr, cc]) => rr === r && cc === c)

    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        const n = north - r * cell_lat
        const s = north - (r + 1) * cell_lat
        const w = west  + c * cell_lon
        const e = west  + (c + 1) * cell_lon

        const status      = statusGrid?.[r]?.[c]
        const norm        = terrainData.elevation_relative[r][c] / 48
        const origin      = isOrigin(r, c)
        const blockedCell = isBlocked(r, c)
        const river       = isRiver(r, c)
        const both        = origin && blockedCell

        // Fill — water = blue, terrain = risk gradient
        let fillColor, fillOpacity
        if      (status === 'Critical') { fillColor = '#1565c0'; fillOpacity = 0.85 }
        else if (status === 'Warning')  { fillColor = '#42a5f5'; fillOpacity = 0.65 }
        else if (river)                 { fillColor = '#1e88e5'; fillOpacity = 0.50 }
        else                            { fillColor = elevFill(norm); fillOpacity = 0.82 }

        // When both origin+blocked: purple fills prominently, thin white dashed border
        let color, weight, dashArray
        if      (both)                   { color = '#ffffff'; weight = 1.5; dashArray = '4 3'; fillColor = '#d500f9'; fillOpacity = 0.60 }
        else if (origin)                 { color = '#ffffff'; weight = 3;   dashArray = '7 4' }
        else if (blockedCell)            { color = '#d500f9'; weight = 3;   dashArray = null }
        else if (status === 'Critical')  { color = '#0d47a1'; weight = 2;   dashArray = null }
        else if (status === 'Warning')   { color = '#1976d2'; weight = 1.5; dashArray = null }
        else if (river)                  { color = '#64b5f6'; weight = 1.2; dashArray = null }
        else                             { color = 'rgba(0,0,0,0.2)'; weight = 0.5; dashArray = null }

        const rect = L.rectangle([[s, w], [n, e]], { color, fillColor, fillOpacity, weight, dashArray })

        const elev = terrainData.elevation[r][c]
        const drainStr = blockedCell
          ? `<span style="text-decoration:line-through">${terrainData.drainage[r][c]?.toFixed(0)}</span> 0 (BLOCKED)`
          : `${terrainData.drainage[r][c]?.toFixed(0)} mm/hr`

        rect.bindTooltip(
          `<div style="font-family:monospace;font-size:14px;line-height:1.6">
            <b>${terrainData.names[r][c]}</b><br/>
            Elev: ${elev?.toFixed(0) ?? '?'} m &nbsp; Drain: ${drainStr}<br/>
            ${river       ? '🔵 Waterway &nbsp;'     : ''}
            ${origin      ? '☔ Rain origin &nbsp;'  : ''}
            ${blockedCell ? '🚫 Blocked drain'       : ''}
          </div>`, { sticky: true }
        )

        rect.on('click', () => {
          const mode = pickTypeRef.current
          if (!mode) return
          if (mode === 'origin') {
            const cur = originRef.current
            const already = cur.some(([rr, cc]) => rr === r && cc === c)
            const next = already ? cur.filter(([rr, cc]) => !(rr === r && cc === c)) : [...cur, [r, c]]
            originRef.current = next; setOriginCells([...next])
          } else if (mode === 'block') {
            const cur = blockedRef.current
            const already = cur.some(([rr, cc]) => rr === r && cc === c)
            const next = already ? cur.filter(([rr, cc]) => !(rr === r && cc === c)) : [...cur, [r, c]]
            blockedRef.current = next; setBlockedCells([...next])
          }
        })

        rect.addTo(map)
        cellsRef.current.push(rect)
      }
    }
  }, [])

  // ── Sync refs ─────────────────────────────────────────────────────
  useEffect(() => { pickTypeRef.current = pickType },     [pickType])
  useEffect(() => { originRef.current   = originCells },  [originCells])
  useEffect(() => { blockedRef.current  = blockedCells }, [blockedCells])
  useEffect(() => { cellSizeRef.current = cellSize },     [cellSize])

  // Reset terrain when cell size changes
  useEffect(() => {
    setTerrain(null); setSimResult(null); setCurrentStep(0)
    setOriginCells([]); setBlockedCells([])
    originRef.current = []; blockedRef.current = []
    cellsRef.current.forEach(l => l.remove()); cellsRef.current = []
  }, [cellSize])

  // Redraw on step / selection change
  useEffect(() => {
    if (!terrain) return
    drawGrid(terrain, simResult?.status_history?.[currentStep] ?? null, originCells, blockedCells)
  }, [terrain, simResult, currentStep, originCells, blockedCells, drawGrid])

  // Preview grid outline before terrain loads
  useEffect(() => {
    const L   = window.L
    const map = mapRef.current
    if (!L || !map || terrain) return

    // Always clear existing preview cells first (including on reset when center+bounds become null)
    cellsRef.current.forEach(l => l.remove())
    cellsRef.current = []

    if (!center && !selectionBounds) return

    const { nr, nc } = getGridDims(selectionBounds)
    let gNorth, gWest, cellLat, cellLon

    if (selectionBounds) {
      const { north, south, east, west } = selectionBounds
      gNorth  = north; gWest = west
      cellLat = (north - south) / nr
      cellLon = (east  - west)  / nc
    } else {
      const latPerKm = 1 / 111.32
      const lonPerKm = 1 / (111.32 * Math.cos(center.lat * Math.PI / 180))
      const half = 16 / 2
      cellLat = (16 / nr) * latPerKm
      cellLon = (16 / nc) * lonPerKm
      gNorth  = center.lat + half * latPerKm
      gWest   = center.lon - half * lonPerKm
    }

    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const n = gNorth - r * cellLat
        const s = gNorth - (r + 1) * cellLat
        const w = gWest  + c * cellLon
        const e = gWest  + (c + 1) * cellLon
        const rect = L.rectangle([[s, w], [n, e]], {
          color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.04, weight: 0.6,
        }).addTo(map)
        cellsRef.current.push(rect)   // track so reset can remove them
      }
    }

    if (selectionBounds) {
      const { north, south, east, west } = selectionBounds
      map.flyToBounds([[south, west], [north, east]], { padding: [30, 30], duration: 0.8 })
    } else {
      map.flyTo([center.lat, center.lon], 13, { duration: 1.2 })
    }
  }, [center, selectionBounds, terrain, cellSize, getGridDims])

  // Playback
  useEffect(() => {
    if (!isPlaying || !simResult) return
    const max = simResult.time_steps.length - 1
    playRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= max) { setIsPlaying(false); return prev }
        return prev + 1
      })
    }, 200)
    return () => clearInterval(playRef.current)
  }, [isPlaying, simResult])

  // ── Nominatim search ──────────────────────────────────────────────
  const search = async () => {
    if (!searchQuery.trim()) return
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      )
      setSuggestions(await res.json())
    } catch { setSuggestions([]) }
  }

  const selectSuggestion = s => {
    setCenter({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) })
    setSelectionBounds(null)
    setSuggestions([]); setSearchQuery(s.display_name.split(',')[0])
    setTerrain(null); setSimResult(null); setCurrentStep(0)
  }

  // ── Load terrain ──────────────────────────────────────────────────
  const loadTerrain = async () => {
    if (!center && !selectionBounds) return
    setLoadingT(true); setErrMsg(null); setSimResult(null); setCurrentStep(0)
    try {
      const { nr, nc } = getGridDims(selectionBounds)
      const payload = selectionBounds
        ? { bounds: selectionBounds, grid_rows: nr, grid_cols: nc }
        : { lat: center.lat, lon: center.lon, grid_km: 16, grid_rows: nr, grid_cols: nc }
      const res = await axios.post(`${API}/terrain`, payload)
      setTerrain(res.data)
      if (mapRef.current) { mapRef.current.setMinZoom(9); mapRef.current.setMaxZoom(18) }
      if (!res.data.elev_ok) {
        const errs = res.data.elev_errors?.join('; ') || 'unknown'
        setErrMsg(`⚠ Elevation data partial — API may be rate-limited. Wait 60 s and retry. (${errs})`)
      }
    } catch {
      setErrMsg('Terrain fetch failed — check backend is running and you have internet.')
    } finally { setLoadingT(false) }
  }

  // ── Run simulation ─────────────────────────────────────────────────
  const runSim = async () => {
    if (!terrain) return
    setLoadingS(true); setErrMsg(null); setCurrentStep(0); setIsPlaying(false); setBrief(null)
    try {
      const res = await axios.post(`${API}/simulate`, {
        rainfall_intensity: rainfall, duration_hours: duration,
        time_step: 0.25, drainage_failure: false,
        blocked_channels:   blockedCells,
        scenario:           'real_terrain',
        custom_elevation:   terrain.elevation_relative,
        custom_drainage:    terrain.drainage.map(row => row.map(v => v * drainageScale)),
        custom_population:  terrain.population,
        custom_names:       terrain.names,
        custom_zone_labels: terrain.zone_labels,
        origin_cells:       originCells.length > 0 ? originCells : null,
      })
      setSimResult(res.data)
    } catch { setErrMsg('Simulation failed.') }
    finally  { setLoadingS(false) }
  }

  // ── Generate situation brief ───────────────────────────────────────
  const generateBrief = async () => {
    if (!simResult || !terrain) return
    setLoadingBrief(true); setBrief(null)

    const lastStep   = simResult.time_steps.length - 1
    const statusGrid = simResult.status_history[lastStep]
    const NR         = terrain.names.length
    const NC         = terrain.names[0].length

    const critZones = [], warnZones = []
    for (let r = 0; r < NR; r++)
      for (let c = 0; c < NC; c++) {
        const s = statusGrid[r][c]
        if      (s === 'Critical') critZones.push(terrain.names[r][c])
        else if (s === 'Warning')  warnZones.push(terrain.names[r][c])
      }

    const originNames  = originCells.map(([r, c]) => terrain.names[r]?.[c]).filter(Boolean)
    const blockedNames = blockedCells.map(([r, c]) => terrain.names[r]?.[c]).filter(Boolean)
    const pop          = simResult.affected_population[lastStep]
    const peakWater    = Math.max(...simResult.water_history[lastStep].flat())

    try {
      const res = await axios.post(`${API}/brief`, {
        rainfall_intensity: rainfall,
        duration_hours:     duration,
        drainage_failure:   drainageScale <= 0.15,
        blocked_channels:   blockedCells,
        critical_count:     critZones.length,
        warning_count:      warnZones.length,
        safe_count:         NR * NC - critZones.length - warnZones.length,
        affected_population: pop.total,
        total_population:   pop.total_city,
        peak_water:         peakWater,
        city_name:          searchQuery || null,
        critical_zones:     critZones,
        warning_zones:      warnZones,
        blocked_zone_names: blockedNames,
        origin_zone_names:  originNames,
        elev_min:           terrain.elev_min,
        elev_max:           terrain.elev_max,
      })
      setBrief(res.data.brief ?? res.data.error ?? 'No response.')
    } catch {
      setBrief('Failed to generate brief — check backend is running.')
    } finally {
      setLoadingBrief(false)
    }
  }

  // Derived values
  const { nr: previewNR, nc: previewNC } = getGridDims(selectionBounds)
  const totalSteps  = simResult ? simResult.time_steps.length - 1 : 0
  const currentTime = simResult?.time_steps?.[currentStep] ?? 0
  const pct         = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0
  const flat        = simResult?.status_history?.[currentStep]?.flat() ?? []
  const critCount   = flat.filter(s => s === 'Critical').length
  const warnCount   = flat.filter(s => s === 'Warning').length
  const actualNR    = terrain?.grid_nr ?? previewNR
  const actualNC    = terrain?.grid_nc ?? previewNC
  const totalCells  = actualNR * actualNC
  const canLoad     = (center || selectionBounds) && !loadingT

  // Cell size info
  let areaInfo = ''
  if (selectionBounds) {
    const midLat   = (selectionBounds.north + selectionBounds.south) / 2
    const heightKm = ((selectionBounds.north - selectionBounds.south) * 111.32).toFixed(1)
    const widthKm  = ((selectionBounds.east - selectionBounds.west) * 111.32 * Math.cos(midLat * Math.PI / 180)).toFixed(1)
    areaInfo = `${widthKm} × ${heightKm} km`
  }

  const PICKERS = [
    { type: 'origin', icon: '☔', label: 'RAIN ORIGIN', activeColor: 'rgba(255,255,255,0.9)', activeBg: 'rgba(255,255,255,0.08)', activeBorder: 'rgba(255,255,255,0.6)', cells: originCells, clearFn: () => { setOriginCells([]); originRef.current = [] }, hint: 'Click cells — rain only falls here, flows downhill by elevation.' },
    { type: 'block',  icon: '🚫', label: 'BLOCK DRAINAGE', activeColor: '#d500f9', activeBg: 'rgba(213,0,249,0.1)', activeBorder: 'rgba(213,0,249,0.7)', cells: blockedCells, clearFn: () => { setBlockedCells([]); blockedRef.current = [] }, hint: 'Click cells — drainage zeroed, water backs up and floods neighbours.' },
  ]

  return (
    <div style={{ padding: '10px 10px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Search bar */}
      <div className="hud-panel" style={{ padding: '12px 16px' }}>
        <div className="hud-panel-header justify-between" style={{ marginBottom: 10 }}>
          <span className="label-sys" style={{ fontSize: 13 }}>REAL TERRAIN · CITY SELECTOR</span>
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--text-muted)' }}>
            OPENSTREETMAP · OPENTOPODATA · OVERPASS API
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search any city — Mumbai, Amsterdam, Houston, Chennai..."
            style={{ flex: 1, background: '#050505', border: '1px solid var(--border)', padding: '8px 14px', fontFamily: 'Share Tech Mono', fontSize: 14, color: 'white', outline: 'none' }}
          />
          <button onClick={search} className="btn-hud" style={{ padding: '8px 22px', fontSize: 14 }}>SEARCH</button>
          <button onClick={() => { if (mapRef.current) { mapRef.current._clickMode = true; mapDivRef.current.style.cursor = 'crosshair' } }}
            style={{ padding: '8px 14px', fontFamily: 'Share Tech Mono', fontSize: 13, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >⊕ POINT</button>
          <button onClick={startAreaDraw} disabled={drawMode}
            style={{ padding: '8px 14px', fontFamily: 'Share Tech Mono', fontSize: 13, cursor: drawMode ? 'default' : 'pointer', background: drawMode ? 'rgba(0,229,255,0.12)' : 'transparent', border: `1px solid ${drawMode ? 'var(--cyan)' : 'rgba(255,255,255,0.15)'}`, color: drawMode ? 'var(--cyan)' : 'var(--text-muted)' }}
          >{drawMode ? 'DRAWING...' : '⬚ DRAW AREA'}</button>

          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 80, zIndex: 9999, background: '#0a0a0a', border: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => selectSuggestion(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontFamily: 'Share Tech Mono', fontSize: 13, color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid var(--border-dim)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{s.display_name}</div>
              ))}
            </div>
          )}
        </div>

        {drawMode && (
          <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--cyan)', letterSpacing: '0.08em' }}>
            ↖ CLICK AND DRAG on the map to select your area · ESC to cancel
          </div>
        )}
        {selectionBounds && !drawMode && (
          <div style={{ marginTop: 8, fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--cyan)' }}>
            AREA SELECTED · {areaInfo} · {previewNR}×{previewNC} grid ({previewNR * previewNC} cells)
          </div>
        )}
      </div>

      {/* LEFT sidebar | MIDDLE map | RIGHT dashboard */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

        {/* LEFT — sidebar controls */}
        <div style={{ width: 268, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Step 1 */}
          <div className="hud-panel" style={{ padding: '14px 16px' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 19, color: 'var(--cyan)', letterSpacing: '0.15em', marginBottom: 12 }}>
              STEP 1 — LOAD TERRAIN
            </div>

            {/* Cell size slider */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--text-muted)' }}>CELL SIZE</span>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--cyan)', lineHeight: 1 }}>
                  {cellSize.toFixed(2)}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}> km</span>
                </span>
              </div>
              <input type="range" min={0.25} max={5} step={0.25} value={cellSize}
                onChange={e => setCellSize(Number(e.target.value))}
                style={{ '--pct': `${((cellSize - 0.25) / 4.75) * 100}%` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>0.25 km (fine)</span>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--cyan)' }}>
                  → {previewNR}R × {previewNC}C grid
                </span>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>5 km (coarse)</span>
              </div>
            </div>

            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
              {selectionBounds ? 'Area drawn ✓ — ready to fetch terrain.' : 'Search a city, ⊕ click a point, or ⬚ draw an area on the map.'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadTerrain} disabled={!canLoad} className="btn-hud" style={{ flex: 1, fontSize: 15 }}>
                {loadingT ? `FETCHING…` : 'LOAD TERRAIN'}
              </button>
              {(selectionBounds || center || terrain) && (
                <button
                  onClick={() => {
                    setSelectionBounds(null); setCenter(null); setTerrain(null)
                    setSimResult(null); setCurrentStep(0); setIsPlaying(false)
                    setOriginCells([]); setBlockedCells([])
                    originRef.current = []; blockedRef.current = []
                    setBrief(null); setErrMsg(null)
                    setSuggestions([]); setSearchQuery('')
                    cellsRef.current.forEach(l => l.remove()); cellsRef.current = []
                    if (mapRef.current) mapRef.current.setView([20, 0], 3)
                  }}
                  style={{
                    padding: '8px 14px', fontFamily: 'Share Tech Mono', fontSize: 13,
                    background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.4)',
                    color: 'var(--red)', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  ↺ RESET
                </button>
              )}
            </div>

            {terrain && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#050505', border: '1px solid rgba(0,229,255,0.2)' }}>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--cyan)', marginBottom: 8 }}>TERRAIN LOADED ✓</div>
                {[
                  ['GRID',   `${terrain.grid_nr}R × ${terrain.grid_nc}C`],
                  ['ELEV',   `${terrain.elev_min?.toFixed(0)}–${terrain.elev_max?.toFixed(0)} m`],
                  ['RIVERS', `${terrain.river_cells?.length ?? 0} cells`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'white' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="hud-panel" style={{ padding: '14px 16px' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 19, color: 'var(--cyan)', letterSpacing: '0.15em', marginBottom: 12 }}>
              STEP 2 — SIMULATE
            </div>
            {[
              { label: 'RAINFALL', value: rainfall, min: 5, max: 200, step: 5, set: setRainfall, unit: 'mm/hr', color: rainfall > 100 ? 'var(--red)' : rainfall > 50 ? 'var(--amber)' : 'var(--green)', pct: ((rainfall - 5) / 195) * 100 },
              { label: 'DURATION', value: duration, min: 1, max: 24, step: 1, set: setDuration, unit: 'hrs', color: 'var(--cyan)', pct: ((duration - 1) / 23) * 100 },
            ].map(({ label, value, min, max, step, set, unit, color, pct: sp }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'Bebas Neue', fontSize: 26, color, lineHeight: 1 }}>
                    {value}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}> {unit}</span>
                  </span>
                </div>
                <input type="range" min={min} max={max} step={step} value={value}
                  onChange={e => set(Number(e.target.value))} style={{ '--pct': `${sp}%` }} />
              </div>
            ))}

            {/* Drainage capacity slider */}
            {(() => {
              const pct = ((drainageScale - 0.1) / 0.9) * 100
              const drainColor = drainageScale < 0.3 ? 'var(--red)' : drainageScale < 0.7 ? 'var(--amber)' : 'var(--green)'
              const drainLabel = drainageScale >= 0.9 ? 'NOMINAL' : drainageScale >= 0.6 ? 'DEGRADED' : drainageScale >= 0.3 ? 'IMPAIRED' : 'CRITICAL'
              return (
                <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--text-muted)' }}>DRAINAGE CAPACITY</span>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 26, color: drainColor, lineHeight: 1 }}>
                      {Math.round(drainageScale * 100)}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>%</span>
                    </span>
                  </div>
                  <input type="range" min={0.1} max={1.0} step={0.05} value={drainageScale}
                    onChange={e => setDrainageScale(Number(e.target.value))}
                    style={{ '--pct': `${pct}%` }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>10% (failed)</span>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: drainColor, fontWeight: 600 }}>{drainLabel}</span>
                    <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>100% (full)</span>
                  </div>
                </div>
              )
            })()}

            {PICKERS.map(({ type, icon, label, activeColor, activeBg, activeBorder, cells, clearFn, hint }) => {
              const active = pickType === type
              return (
                <div key={type} style={{ marginBottom: 10 }}>
                  <button onClick={() => { if (terrain) setPickType(active ? null : type) }} disabled={!terrain}
                    style={{
                      width: '100%', padding: '9px 12px', fontFamily: 'Share Tech Mono', fontSize: 13, letterSpacing: '0.06em',
                      background: active ? activeBg : 'transparent',
                      border: `1px solid ${active ? activeBorder : 'rgba(255,255,255,0.2)'}`,
                      color: !terrain ? 'rgba(255,255,255,0.2)' : active ? activeColor : 'var(--text-muted)',
                      cursor: terrain ? 'pointer' : 'default', transition: 'all 0.15s',
                      display: 'flex', justifyContent: 'space-between',
                    }}
                  >
                    <span>{icon} {active ? 'PICKING...' : label}</span>
                    <span style={{ opacity: 0.7, fontFamily: 'Bebas Neue', fontSize: 19 }}>{cells.length}</span>
                  </button>
                  {cells.length > 0 && (
                    <button onClick={clearFn} style={{ width: '100%', marginTop: 3, padding: '5px 12px', fontFamily: 'Share Tech Mono', fontSize: 12, background: 'transparent', border: '1px solid rgba(255,23,68,0.25)', color: 'var(--red)', cursor: 'pointer' }}>
                      CLEAR {label}
                    </button>
                  )}
                  {active && (
                    <div style={{ marginTop: 5, fontFamily: 'Share Tech Mono', fontSize: 13, color: activeColor, opacity: 0.75, lineHeight: 1.6 }}>{hint}</div>
                  )}
                </div>
              )
            })}

            <button onClick={runSim} disabled={!terrain || loadingS} className="btn-hud" style={{ width: '100%', fontSize: 15, marginTop: 6 }}>
              {loadingS ? 'SIMULATING...' : 'RUN SIMULATION'}
            </button>
          </div>

          {/* Legend */}
          <div className="hud-panel" style={{ padding: '14px 16px' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 19, color: 'var(--cyan)', letterSpacing: '0.15em', marginBottom: 10 }}>MAP LEGEND</div>
            {[
              { bg: 'rgb(220,80,20)',         border: 'rgba(0,0,0,0.3)',        label: 'Low elevation — flood risk' },
              { bg: 'rgb(155,125,18)',        border: 'rgba(0,0,0,0.3)',        label: 'Mid elevation' },
              { bg: 'rgb(30,175,10)',         border: 'rgba(0,0,0,0.3)',        label: 'High elevation — safe' },
              { bg: '#1e88e5',               border: '#64b5f6',                label: 'River / waterway' },
              { bg: 'rgba(66,165,245,0.65)', border: '#1976d2',                label: 'Warning ≥100mm water' },
              { bg: 'rgba(21,101,192,0.85)', border: '#0d47a1',                label: 'Critical ≥300mm water' },
              { bg: 'transparent',            border: 'rgba(255,255,255,0.9)', dashed: true, label: '☔ Rain origin (white dash)' },
              { bg: 'rgba(213,0,249,0.55)',  border: '#d500f9',               label: '🚫 Blocked drainage (purple)' },
              { bg: 'rgba(213,0,249,0.55)',  border: '#ffffff',               dashed: true, label: 'Both — purple fill + thin dash' },
            ].map(({ bg, border, dashed, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <div style={{ width: 16, height: 16, background: bg, flexShrink: 0, border: `2px ${dashed ? 'dashed' : 'solid'} ${border}` }} />
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE — map + timeline stacked */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, isolation: 'isolate', position: 'relative', zIndex: 0 }}>
          <div className="hud-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="hud-panel-header" style={{ padding: '7px 14px' }}>
              <span className="label-sys" style={{ fontSize: 13 }}>
                {drawMode ? '✏ DRAW MODE — DRAG TO SELECT AREA' : 'OSM LIVE MAP'}
              </span>
              {terrain && (
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {terrain.grid_nr}R × {terrain.grid_nc}C · {terrain.elev_min?.toFixed(0)}–{terrain.elev_max?.toFixed(0)} m
                </span>
              )}
            </div>
            <div ref={mapDivRef} style={{ height: 'calc(100vh - 320px)', minHeight: 400, width: '100%', background: '#111' }} />
          </div>

          {/* Timeline — sits directly under the map */}
          {simResult && (
            <div className="hud-panel" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className="label-sys" style={{ fontSize: 13 }}>TIMELINE · REAL TERRAIN SIM</span>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 15, color: 'var(--cyan)', marginLeft: 'auto' }}>
                  T+{String(Math.floor(currentTime)).padStart(2, '0')}H {String(Math.round((currentTime % 1) * 60)).padStart(2, '0')}M
                </span>
              </div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(to right,rgba(0,229,255,0.4),var(--cyan))', transition: 'width 0.15s' }} />
                </div>
                <input type="range" min={0} max={totalSteps} step={1} value={currentStep}
                  onChange={e => { setIsPlaying(false); setCurrentStep(Number(e.target.value)) }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => { setIsPlaying(false); setCurrentStep(0) }} className="btn-hud-ghost" style={{ padding: '6px 12px' }}>⏮</button>
                <button onClick={() => setIsPlaying(p => !p)} className="btn-hud" style={{ minWidth: 110, padding: '6px 18px', fontSize: 15 }}>
                  {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                </button>
                <button onClick={() => { setIsPlaying(false); setCurrentStep(totalSteps) }} className="btn-hud-ghost" style={{ padding: '6px 12px' }}>⏭</button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
                  {[
                    ['CRIT', critCount,                         'var(--red)'],
                    ['WARN', warnCount,                         'var(--amber)'],
                    ['SAFE', totalCells - critCount - warnCount, 'var(--green)'],
                  ].map(([l, v, col]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--text-muted)' }}>{l}</div>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: col, lineHeight: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Early Warning Dashboard */}
        <div style={{ width: 265, flexShrink: 0 }}>
          {(() => {
            const lastStep   = simResult ? simResult.time_steps.length - 1 : 0
            const statusGrid = simResult?.status_history?.[currentStep] ?? null
            const waterGrid  = simResult?.water_history?.[currentStep]  ?? null
            return (
              <EarlyWarningDashboard
                statusGrid={statusGrid}
                waterGrid={waterGrid}
                names={terrain?.names ?? null}
                population={terrain?.population ?? null}
                timeToC={simResult?.time_to_critical ?? null}
                currentTime={simResult?.time_steps?.[currentStep] ?? null}
                simReady={!!simResult}
                showPopulation={false}
              />
            )
          })()}
        </div>

      </div>


      {/* Situation Brief */}
      {simResult && terrain && (
        <div className="hud-panel" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span className="label-sys" style={{ fontSize: 13 }}>SITUATION BRIEF · AI ANALYSIS</span>
            <button onClick={generateBrief} disabled={loadingBrief} className="btn-hud"
              style={{ marginLeft: 'auto', padding: '6px 20px', fontSize: 14 }}>
              {loadingBrief ? 'GENERATING...' : '⚡ GENERATE BRIEF'}
            </button>
          </div>

          {/* Zone name summary */}
          {(() => {
            const lastStep   = simResult.time_steps.length - 1
            const statusGrid = simResult.status_history[lastStep]
            const NR = terrain.names.length
            const NC = terrain.names[0].length
            const critZ = [], warnZ = []
            for (let r = 0; r < NR; r++)
              for (let c = 0; c < NC; c++) {
                const s = statusGrid[r][c]
                if      (s === 'Critical') critZ.push(terrain.names[r][c])
                else if (s === 'Warning')  warnZ.push(terrain.names[r][c])
              }

            if (critZ.length === 0 && warnZ.length === 0) return (
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--green)', marginBottom: brief ? 14 : 0 }}>
                All zones SAFE at simulation end — no flooding detected.
              </div>
            )

            return (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: brief ? 14 : 0 }}>
                {critZ.length > 0 && (
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--red)', letterSpacing: '0.08em', marginBottom: 5 }}>
                      CRITICAL ({critZ.length} zones)
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'rgba(255,110,110,0.9)', lineHeight: 1.8 }}>
                      {critZ.slice(0, 30).join(' · ')}{critZ.length > 30 ? ` +${critZ.length - 30} more` : ''}
                    </div>
                  </div>
                )}
                {warnZ.length > 0 && (
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 12, color: 'var(--amber)', letterSpacing: '0.08em', marginBottom: 5 }}>
                      WARNING ({warnZ.length} zones)
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'rgba(255,185,80,0.9)', lineHeight: 1.8 }}>
                      {warnZ.slice(0, 30).join(' · ')}{warnZ.length > 30 ? ` +${warnZ.length - 30} more` : ''}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Claude brief output */}
          {brief && (
            <div style={{ padding: '16px 18px', background: '#040404', border: '1px solid rgba(0,229,255,0.18)' }}>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: 12 }}>
                ⚡ CLAUDE AI — EMERGENCY OPERATIONS BRIEF
              </div>
              <div style={{ fontFamily: 'Rajdhani', fontWeight: 500, fontSize: 17, color: 'rgba(255,255,255,0.92)', lineHeight: 2, whiteSpace: 'pre-wrap' }}>
                {brief}
              </div>
            </div>
          )}
        </div>
      )}

      {errMsg && (
        <div style={{ padding: '10px 16px', background: 'var(--red-dim)', border: '1px solid rgba(255,23,68,0.3)', fontFamily: 'Share Tech Mono', fontSize: 13, color: 'var(--red)' }}>
          ⚠ {errMsg}
        </div>
      )}
    </div>
  )
}
