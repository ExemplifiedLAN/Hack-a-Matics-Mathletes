# FlowShield — Urban Flood Simulation & Early Warning Platform

FlowShield is a real-time urban flood simulation platform that models drainage networks, tracks rising water across real terrain, and generates AI-powered tactical briefs for emergency response teams.

---

## Features

- **Flood Simulation** — Physics-based water flow across an 8×8 city grid with configurable rainfall intensity, storm duration, and drainage capacity
- **Real Terrain Mode** — Search any city on Earth, load live elevation data (OpenTopoData SRTM30m), detect rivers via OpenStreetMap Overpass API, and run flood simulations on actual geography
- **Scenario Comparison** — Run and compare five preset scenarios side-by-side (Normal, Heavy, Extreme, Drainage Failure, Blocked Channels)
- **Early Warning Dashboard** — Real-time zone-level alerts with critical/warning/safe counts, time-to-critical, and population-at-risk tracking
- **AI Situation Brief** — One-click Claude AI tactical brief summarising flood severity, evacuation priorities, and infrastructure recommendations
- **Interactive Controls** — Paint rain origin cells, block drainage channels, adjust drainage capacity, and replay simulations step-by-step

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, React-Leaflet |
| Backend | FastAPI, Python 3, NumPy |
| AI | Claude Haiku (Anthropic API) |
| Terrain | OpenTopoData SRTM30m, OpenStreetMap Overpass API |
| Maps | Leaflet + OpenStreetMap tiles |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- An Anthropic API key (for AI situation briefs — optional, rest of app works without it)

### One-command start

```bash
bash start.sh
```

This script:
1. Creates a Python virtual environment and installs backend dependencies
2. Installs frontend npm packages
3. Starts the FastAPI server on `http://localhost:8000`
4. Starts the React dev server on `http://localhost:3000`

### Manual setup

**Backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

### Environment variables

Create `backend/.env` (optional — only needed for AI briefs):
```
ANTHROPIC_API_KEY=your_key_here
```

---

## Usage

### Simulation tab
1. Adjust **Rainfall Intensity**, **Duration**, and **Drainage Capacity** sliders
2. Optionally select a preset scenario or click a grid cell to inspect it
3. Click **RUN SIMULATION** — water propagates across the city grid in real time
4. Use the timeline slider or **PLAY** to replay the flood progression
5. Click **GENERATE BRIEF** for an AI tactical situation report

### Real Terrain tab
1. Search any city (e.g. *Mumbai*, *Amsterdam*, *Houston*) or draw a custom area on the map
2. Adjust **Cell Size** to control grid resolution (0.25 km fine → 5 km coarse)
3. Click **LOAD TERRAIN** — elevation and river data are fetched from live APIs
4. Optionally paint **Rain Origin** cells or **Block Drainage** cells on the map
5. Click **RUN SIMULATION** to simulate flooding on real geography
6. Use **GENERATE BRIEF** for a location-specific AI emergency report

### Scenario Comparison tab
Select two or more scenarios and click **RUN COMPARISON** to see water depth and population impact charts side-by-side.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/simulate` | POST | Run a custom flood simulation |
| `/api/simulate/scenario/{name}` | POST | Run a preset scenario |
| `/api/compare` | POST | Compare multiple scenarios |
| `/api/terrain` | POST | Fetch real terrain data for a location |
| `/api/brief` | POST | Generate an AI situation brief |
| `/api/scenarios` | GET | List available preset scenarios |
| `/api/docs` | GET | Interactive Swagger API docs |

---

## Project Structure

```
FlowShield2.0/
├── backend/
│   ├── main.py          # FastAPI routes and terrain fetching
│   ├── simulation.py    # Flood physics engine (NumPy)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx                          # Root app, routing, state
│       └── components/
│           ├── RealTerrainMap.jsx           # Leaflet map + terrain simulation
│           ├── EarlyWarningDashboard.jsx    # Alert panel
│           ├── CityGrid.jsx                 # Grid visualisation
│           ├── WaterLevelChart.jsx          # Water/population charts
│           ├── ScenarioComparison.jsx       # Multi-scenario charts
│           ├── SituationBrief.jsx           # AI brief UI
│           └── ...
├── start.sh             # One-command launcher
└── .gitignore
```

---

## Team

**Hack-a-Matics Mathletes** — Built for hackathon submission.
