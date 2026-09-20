from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from simulation import FloodSimulation, SimulationConfig
import numpy as np
import os

app = FastAPI(title="FloodShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimRequest(BaseModel):
    rainfall_intensity: float = 50.0
    duration_hours: float = 12.0
    time_step: float = 0.25
    drainage_failure: bool = False
    drainage_scale: Optional[float] = None   # 0.1–1.0 multiplier applied before simulation
    blocked_channels: List[List[int]] = []
    scenario: str = "custom"
    custom_elevation: Optional[List[List[float]]] = None
    custom_drainage: Optional[List[List[float]]] = None
    custom_population: Optional[List[List[float]]] = None
    custom_names: Optional[List[List[str]]] = None
    custom_zone_labels: Optional[List[str]] = None
    origin_cells: Optional[List[List[int]]] = None


class TerrainRequest(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    grid_km: float = 16.0
    grid_n: int = 16           # fallback square grid
    grid_rows: Optional[int] = None   # rectangular grid rows
    grid_cols: Optional[int] = None   # rectangular grid cols
    bounds: Optional[dict] = None     # {north, south, east, west}


SCENARIOS = {
    "normal": {
        "label": "Normal Rainfall",
        "description": "Light rain — 20 mm/hr. All drainage systems operational.",
        "icon": "cloud-drizzle",
        "rainfall_intensity": 20,
        "duration_hours": 12,
        "time_step": 0.25,
        "drainage_failure": False,
        "blocked_channels": [],
        "color": "#22c55e",
    },
    "heavy": {
        "label": "Heavy Rainfall",
        "description": "Intense storm — 80 mm/hr. Infrastructure under stress.",
        "icon": "cloud-rain",
        "rainfall_intensity": 80,
        "duration_hours": 12,
        "time_step": 0.25,
        "drainage_failure": False,
        "blocked_channels": [],
        "color": "#f59e0b",
    },
    "extreme": {
        "label": "Extreme Rainfall",
        "description": "Catastrophic storm — 150 mm/hr. Flash-flood conditions.",
        "icon": "zap",
        "rainfall_intensity": 150,
        "duration_hours": 12,
        "time_step": 0.25,
        "drainage_failure": False,
        "blocked_channels": [],
        "color": "#ef4444",
    },
    "drainage_failure": {
        "label": "Drainage Failure",
        "description": "Moderate rain (50 mm/hr) with 92 % infrastructure failure.",
        "icon": "alert-triangle",
        "rainfall_intensity": 50,
        "duration_hours": 12,
        "time_step": 0.25,
        "drainage_failure": True,
        "blocked_channels": [],
        "color": "#f97316",
    },
    "blocked_channel": {
        "label": "Blocked Channels",
        "description": "Heavy rain (70 mm/hr) — river-bank drainage channels blocked.",
        "icon": "x-octagon",
        "rainfall_intensity": 70,
        "duration_hours": 12,
        "time_step": 0.25,
        "drainage_failure": False,
        "blocked_channels": [[5, 2], [5, 3], [5, 4], [5, 5], [6, 2], [6, 3], [6, 4], [6, 5]],
        "color": "#a855f7",
    },
}


def _run(cfg_dict: dict):
    # Apply drainage_scale multiplier to custom_drainage (or leave None for default)
    scale = cfg_dict.get("drainage_scale")
    custom_drainage = cfg_dict.get("custom_drainage")
    if scale is not None and scale != 1.0 and custom_drainage is not None:
        custom_drainage = [[v * scale for v in row] for row in custom_drainage]

    cfg = SimulationConfig(
        rainfall_intensity=cfg_dict["rainfall_intensity"],
        duration_hours=cfg_dict["duration_hours"],
        time_step=cfg_dict["time_step"],
        drainage_failure=cfg_dict["drainage_failure"],
        blocked_channels=[tuple(c) for c in cfg_dict["blocked_channels"]],
        scenario=cfg_dict.get("scenario", "custom"),
        custom_elevation=cfg_dict.get("custom_elevation"),
        custom_drainage=custom_drainage,
        custom_population=cfg_dict.get("custom_population"),
        custom_names=cfg_dict.get("custom_names"),
        custom_zone_labels=cfg_dict.get("custom_zone_labels"),
        origin_cells=cfg_dict.get("origin_cells"),
    )
    return FloodSimulation(cfg).run()


@app.get("/api/scenarios")
def get_scenarios():
    return SCENARIOS


@app.post("/api/simulate")
def simulate(req: SimRequest):
    return _run(req.model_dump())


@app.post("/api/simulate/scenario/{name}")
def simulate_scenario(name: str):
    if name not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {name}")
    result = _run(SCENARIOS[name])
    result["scenario_info"] = SCENARIOS[name]
    return result


@app.post("/api/compare")
def compare(names: List[str]):
    results = {}
    for name in names:
        if name in SCENARIOS:
            r = _run(SCENARIOS[name])
            results[name] = {
                "label": SCENARIOS[name]["label"],
                "color": SCENARIOS[name]["color"],
                "affected_population": r["affected_population"],
                "time_steps": r["time_steps"],
                "max_water_levels": r["max_water_levels"],
            }
    return results


@app.post("/api/terrain")
def get_terrain(req: TerrainRequest):
    import requests as req_lib
    import math

    # Resolve grid dimensions (rows × cols, clamped 4–40)
    n_r = max(4, min(40, req.grid_rows or req.grid_n))
    n_c = max(4, min(40, req.grid_cols or req.grid_n))

    if req.bounds:
        # ── Drawn-selection mode: exact bounding box ──
        grid_north = req.bounds["north"]
        grid_south = req.bounds["south"]
        grid_east  = req.bounds["east"]
        grid_west  = req.bounds["west"]
        cell_lat   = (grid_north - grid_south) / n_r
        cell_lon   = (grid_east  - grid_west)  / n_c
        lat        = (grid_north + grid_south) / 2
        lon        = (grid_east  + grid_west)  / 2
        lats = [grid_north - (r + 0.5) * cell_lat for r in range(n_r)]
        lons = [grid_west  + (c + 0.5) * cell_lon for c in range(n_c)]
    else:
        # ── Center + grid_km mode ──
        lat, lon, grid_km = req.lat, req.lon, req.grid_km
        lat_per_km = 1.0 / 111.32
        lon_per_km = 1.0 / (111.32 * math.cos(math.radians(lat)))
        half        = grid_km / 2
        cell_lat    = (grid_km / n_r) * lat_per_km
        cell_lon    = (grid_km / n_c) * lon_per_km
        grid_north  = lat + half * lat_per_km
        grid_south  = lat - half * lat_per_km
        grid_west   = lon - half * lon_per_km
        grid_east   = lon + half * lon_per_km
        lats = [grid_north - (r + 0.5) * cell_lat for r in range(n_r)]
        lons = [grid_west  + (c + 0.5) * cell_lon for c in range(n_c)]

    # ── OpenTopoData: batch in chunks of 100, respect 1 req/sec rate limit ──
    import time as _time
    all_pts   = [(lats[r], lons[c]) for r in range(n_r) for c in range(n_c)]
    BATCH     = 100
    elev_flat = []        # None = fetch failed for that point
    elev_errors = []

    for i in range(0, len(all_pts), BATCH):
        if i > 0:
            _time.sleep(1.1)          # 1 req/sec hard limit on free tier
        chunk = all_pts[i:i + BATCH]
        locs  = "|".join(f"{lt:.6f},{ln:.6f}" for lt, ln in chunk)
        try:
            resp = req_lib.get(
                f"https://api.opentopodata.org/v1/srtm30m?locations={locs}",
                timeout=30
            )
            data = resp.json()
            if data.get("status") == "OK" and "results" in data:
                elev_flat.extend([
                    r["elevation"] if r.get("elevation") is not None else None
                    for r in data["results"]
                ])
            else:
                elev_errors.append(data.get("error") or data.get("status") or "unknown")
                elev_flat.extend([None] * len(chunk))
        except Exception as exc:
            elev_errors.append(str(exc))
            elev_flat.extend([None] * len(chunk))

    # Fill None values with mean of successful points (or 0 if all failed)
    valid_elevs = [e for e in elev_flat if e is not None]
    mean_elev   = sum(valid_elevs) / len(valid_elevs) if valid_elevs else 0.0
    elev_flat   = [e if e is not None else mean_elev for e in elev_flat]

    elevation_abs = [[elev_flat[r * n_c + c] for c in range(n_c)] for r in range(n_r)]
    elev_arr = np.array(elevation_abs, dtype=float)

    # ── Overpass: rivers / streams / canals ──
    river_cells = set()
    try:
        q = f"""[out:json][timeout:25];
(way["waterway"~"river|stream|canal"]({grid_south:.6f},{grid_west:.6f},{grid_north:.6f},{grid_east:.6f}););
out geom;"""
        rdata = req_lib.post("https://overpass-api.de/api/interpreter", data=q, timeout=30).json()
        for el in rdata.get("elements", []):
            if el.get("type") == "way":
                for node in el.get("geometry", []):
                    r_i = int((grid_north - node["lat"]) / cell_lat)
                    c_i = int((node["lon"]  - grid_west)  / cell_lon)
                    if 0 <= r_i < n_r and 0 <= c_i < n_c:
                        river_cells.add((r_i, c_i))
    except Exception:
        pass

    river_list = [list(rc) for rc in river_cells]

    # ── Drainage from elevation (4–30 mm/hr) ──
    e_min, e_max = float(elev_arr.min()), float(elev_arr.max())
    e_range      = max(e_max - e_min, 1.0)
    drainage_arr = 4.0 + 26.0 * (elev_arr - e_min) / e_range
    for r, c in river_cells:
        drainage_arr[r][c] = 2.0

    elev_relative = (((elev_arr - e_min) / e_range) * 48).tolist()

    zone_labels = [f"Band-{r + 1}" for r in range(n_r)]
    col_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    names = [[f"R{r+1}{col_letters[c % 26]}" for c in range(n_c)] for r in range(n_r)]

    cr = (n_r - 1) / 2
    cc = (n_c - 1) / 2
    spread  = max((n_r * n_c) / 8.0, 4.0)
    pop_raw = np.array([
        [max(1.0, 36.0 * math.exp(-((r - cr)**2 + (c - cc)**2) / spread)) for c in range(n_c)]
        for r in range(n_r)
    ])
    pop_arr = (pop_raw * (718.0 / pop_raw.sum())).tolist()

    return {
        "elevation":          elevation_abs,
        "elevation_relative": elev_relative,
        "drainage":           drainage_arr.tolist(),
        "river_cells":        river_list,
        "zone_labels":        zone_labels,
        "names":              names,
        "population":         pop_arr,
        "bounds": {
            "north": grid_north, "south": grid_south,
            "east":  grid_east,  "west":  grid_west,
            "lats":  lats,       "lons":  lons,
            "cell_lat": cell_lat, "cell_lon": cell_lon,
        },
        "center":      {"lat": lat, "lon": lon},
        "elev_min":    e_min, "elev_max": e_max,
        "grid_n":      n_r,   "grid_nr": n_r, "grid_nc": n_c,
        "elev_ok":     len(valid_elevs) == n_r * n_c,
        "elev_errors": elev_errors,
    }


class BriefRequest(BaseModel):
    rainfall_intensity: float
    duration_hours: float
    drainage_failure: bool = False
    blocked_channels: List[List[int]] = []
    critical_count: int
    warning_count: int
    safe_count: int
    affected_population: int
    total_population: int
    peak_water: float
    # Terrain-specific fields
    city_name: Optional[str] = None
    critical_zones: Optional[List[str]] = None   # cell names at critical
    warning_zones: Optional[List[str]] = None    # cell names at warning
    blocked_zone_names: Optional[List[str]] = None
    origin_zone_names: Optional[List[str]] = None
    elev_min: Optional[float] = None
    elev_max: Optional[float] = None


@app.post("/api/brief")
def generate_brief(req: BriefRequest):
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        location   = req.city_name or "the selected area"
        infra_note = "92% infrastructure failure" if req.drainage_failure else "drainage infrastructure nominal"
        blocked_note = (
            f"{len(req.blocked_channels)} drainage channels manually blocked"
            if req.blocked_channels else "no manually blocked channels"
        )
        total_cells = req.critical_count + req.warning_count + req.safe_count

        # Summarise zone names (cap at 12 each to keep prompt tight)
        def fmt_zones(zones, cap=12):
            if not zones: return "none"
            shown = zones[:cap]
            extra = len(zones) - cap
            s = ", ".join(shown)
            return f"{s} (+{extra} more)" if extra > 0 else s

        crit_str    = fmt_zones(req.critical_zones)
        warn_str    = fmt_zones(req.warning_zones)
        blocked_str = fmt_zones(req.blocked_zone_names, 6)
        origin_str  = fmt_zones(req.origin_zone_names,  6)

        elev_info = ""
        if req.elev_min is not None and req.elev_max is not None:
            elev_info = f"\n- Terrain elevation range: {req.elev_min:.0f}–{req.elev_max:.0f} m"

        prompt = f"""You are a flood emergency operations analyst generating a real-time tactical situation brief.

SIMULATION: {location.upper()}
- Rainfall: {req.rainfall_intensity} mm/hr over {req.duration_hours} hours
- Infrastructure: {infra_note}, {blocked_note}
- Origin of rainfall: {origin_str}
- Blocked drainage zones: {blocked_str}{elev_info}

FLOOD STATUS ({total_cells} total cells):
- CRITICAL (≥300 mm water depth) — {req.critical_count} cells: {crit_str}
- WARNING  (≥100 mm water depth) — {req.warning_count} cells: {warn_str}
- SAFE — {req.safe_count} cells
- Affected population: {req.affected_population:,} of {req.total_population:,} residents
- Peak recorded water depth: {req.peak_water:.0f} mm

Write a 5-sentence tactical emergency brief:
1. Overall severity level and the specific named zones facing critical flooding.
2. How the flooding propagated — from origin cells through blocked channels into downstream zones.
3. Immediate evacuation and rescue priorities for the named critical zones.
4. Precautionary actions for warning zones to prevent escalation to critical.
5. Infrastructure and emergency response recommendations.
Use emergency-operations language. Reference actual zone names where possible. No bullet points."""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=380,
            messages=[{"role": "user", "content": prompt}]
        )
        return {"brief": message.content[0].text}
    except Exception as e:
        return {"brief": None, "error": str(e)}


@app.get("/health")
def health():
    return {"status": "ok"}
