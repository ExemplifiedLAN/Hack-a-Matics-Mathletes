import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional

GRID_SIZE = 8

# Elevation map (meters above sea level) — river valley topology
ELEVATION_MAP = np.array([
    [48, 44, 40, 36, 36, 40, 44, 48],  # Northern Hills
    [36, 30, 24, 20, 20, 24, 30, 36],  # Upper Suburbs
    [26, 20, 14, 10, 10, 14, 20, 26],  # Suburbs
    [18, 12,  7,  4,  4,  7, 12, 18],  # Inner City
    [12,  7,  3,  1,  1,  3,  7, 12],  # Downtown / CBD
    [ 8,  4,  1,  0,  0,  1,  4,  8],  # River Bank
    [ 5,  2,  0,  0,  0,  0,  2,  5],  # Flood Plain
    [ 3,  1,  0,  0,  0,  0,  1,  3],  # Southern Lowlands
], dtype=float)

# Drainage capacity (mm/hr) — urban core has best infrastructure
DRAINAGE_BASE = np.array([
    [30, 28, 25, 22, 22, 25, 28, 30],
    [25, 22, 20, 18, 18, 20, 22, 25],
    [20, 18, 16, 14, 14, 16, 18, 20],
    [16, 14, 22, 26, 26, 22, 14, 16],
    [14, 12, 28, 32, 32, 28, 12, 14],  # CBD — best storm sewers
    [ 8,  6,  8,  6,  6,  8,  6,  8],
    [ 5,  4,  4,  2,  2,  4,  4,  5],
    [ 3,  2,  2,  0,  0,  2,  2,  3],  # Lowest areas — almost no drainage
], dtype=float)

# Population density (thousands per cell)
POPULATION_MAP = np.array([
    [ 2,  3,  5,  4,  4,  5,  3,  2],
    [ 5,  8, 11,  9,  9, 11,  8,  5],
    [ 8, 13, 16, 14, 14, 16, 13,  8],
    [10, 16, 21, 26, 26, 21, 16, 10],
    [11, 19, 27, 36, 36, 27, 19, 11],  # Downtown — densest
    [ 8, 11, 13, 16, 16, 13, 11,  8],
    [ 5,  7,  9, 11, 11,  9,  7,  5],
    [ 2,  3,  4,  6,  6,  4,  3,  2],
], dtype=float)

REGION_NAMES = [
    ["N.Hill-A", "N.Hill-B", "N.Hill-C", "N.Hill-D", "N.Hill-E", "N.Hill-F", "N.Hill-G", "N.Hill-H"],
    ["UpSub-A",  "UpSub-B",  "UpSub-C",  "UpSub-D",  "UpSub-E",  "UpSub-F",  "UpSub-G",  "UpSub-H"],
    ["Suburb-A", "Suburb-B", "Suburb-C", "Suburb-D", "Suburb-E", "Suburb-F", "Suburb-G", "Suburb-H"],
    ["ICity-A",  "ICity-B",  "ICity-C",  "ICity-D",  "ICity-E",  "ICity-F",  "ICity-G",  "ICity-H"],
    ["DT-A",     "DT-B",     "DT-C",     "CBD-D",    "CBD-E",    "DT-F",     "DT-G",     "DT-H"],
    ["RBank-A",  "RBank-B",  "RBank-C",  "RBank-D",  "RBank-E",  "RBank-F",  "RBank-G",  "RBank-H"],
    ["FPlain-A", "FPlain-B", "FPlain-C", "FPlain-D", "FPlain-E", "FPlain-F", "FPlain-G", "FPlain-H"],
    ["LLand-A",  "LLand-B",  "LLand-C",  "LLand-D",  "LLand-E",  "LLand-F",  "LLand-G",  "LLand-H"],
]

CRITICAL_THRESHOLD = 300.0  # mm  (30 cm depth — serious flooding)
WARNING_THRESHOLD  = 100.0  # mm  (10 cm depth — minor flooding)
FLOW_COEFFICIENT   =   0.08  # lateral flow rate

ZONE_LABELS = [
    "Northern Hills", "Upper Suburbs", "Suburbs", "Inner City",
    "Downtown", "River Bank", "Flood Plain", "Southern Lowlands",
]


@dataclass
class SimulationConfig:
    rainfall_intensity: float = 50.0   # mm/hr
    duration_hours: float = 12.0
    time_step: float = 0.25            # hours per step (15 min)
    drainage_failure: bool = False
    blocked_channels: List = field(default_factory=list)
    scenario: str = "custom"


class FloodSimulation:
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.elevation = ELEVATION_MAP.copy()
        self.drainage = DRAINAGE_BASE.copy()
        self.population = POPULATION_MAP.copy()

        if config.drainage_failure:
            self.drainage *= 0.08   # 92 % failure — almost no drainage

        for rc in config.blocked_channels:
            r, c = int(rc[0]), int(rc[1])
            if 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE:
                self.drainage[r][c] = 0.0

        self.water = np.zeros((GRID_SIZE, GRID_SIZE))

    # ------------------------------------------------------------------
    def _rainfall(self, row: int, col: int) -> float:
        """Rainfall adjusted for orographic uplift on hills."""
        elev_factor = 1.0 + (self.elevation[row][col] / 200.0) * 0.4
        return self.config.rainfall_intensity * elev_factor

    def _flow(self, fr: int, fc: int, tr: int, tc: int) -> float:
        if not (0 <= fr < GRID_SIZE and 0 <= fc < GRID_SIZE):
            return 0.0
        if not (0 <= tr < GRID_SIZE and 0 <= tc < GRID_SIZE):
            return 0.0
        h_from = self.water[fr][fc] + self.elevation[fr][fc]
        h_to   = self.water[tr][tc] + self.elevation[tr][tc]
        if h_from > h_to:
            raw = FLOW_COEFFICIENT * (h_from - h_to)
            return min(raw, self.water[fr][fc] * 0.25)
        return 0.0

    def _classify(self, wl: float) -> str:
        if wl >= CRITICAL_THRESHOLD:
            return "Critical"
        if wl >= WARNING_THRESHOLD:
            return "Warning"
        return "Safe"

    def _step(self, dt: float):
        new_w = self.water.copy()
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                rain     = self._rainfall(r, c) * dt
                drain    = min(self.drainage[r][c] * dt, self.water[r, c])
                flow_out = sum(self._flow(r, c, r+dr, c+dc) for dr, dc in directions)
                flow_in  = sum(self._flow(r+dr, c+dc, r, c) for dr, dc in directions)
                new_w[r, c] = max(0.0, self.water[r, c] + rain - drain + flow_in - flow_out)
        self.water = new_w

    # ------------------------------------------------------------------
    def run(self) -> Dict:
        num_steps = int(self.config.duration_hours / self.config.time_step)
        times, water_hist, status_hist = [], [], []

        for i in range(num_steps + 1):
            t = round(i * self.config.time_step, 4)
            times.append(t)
            water_hist.append(self.water.tolist())
            status_hist.append(
                [[self._classify(self.water[r, c]) for c in range(GRID_SIZE)]
                 for r in range(GRID_SIZE)]
            )
            if i < num_steps:
                self._step(self.config.time_step)

        ttc = self._time_to_critical(times, water_hist)
        aff = self._affected_population(status_hist)
        max_wl = self._max_water_levels(water_hist)

        return {
            "time_steps": times,
            "water_history": water_hist,
            "status_history": status_hist,
            "time_to_critical": ttc,
            "affected_population": aff,
            "max_water_levels": max_wl,
            "grid_metadata": {
                "elevation": ELEVATION_MAP.tolist(),
                "drainage":  DRAINAGE_BASE.tolist(),
                "population": POPULATION_MAP.tolist(),
                "names": REGION_NAMES,
                "zone_labels": ZONE_LABELS,
                "total_population": int(POPULATION_MAP.sum() * 1000),
                "zone_populations": [
                    {"zone": ZONE_LABELS[r], "population": int(POPULATION_MAP[r].sum() * 1000)}
                    for r in range(GRID_SIZE)
                ],
            },
            "config": {
                "rainfall_intensity": self.config.rainfall_intensity,
                "duration_hours": self.config.duration_hours,
                "time_step": self.config.time_step,
                "drainage_failure": self.config.drainage_failure,
                "scenario": self.config.scenario,
            },
            "thresholds": {
                "critical": CRITICAL_THRESHOLD,
                "warning":  WARNING_THRESHOLD,
            },
        }

    def _time_to_critical(self, times, water_hist):
        ttc = [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                for i, t in enumerate(times):
                    if water_hist[i][r][c] >= CRITICAL_THRESHOLD:
                        ttc[r][c] = t
                        break
        return ttc

    def _affected_population(self, status_hist):
        total_city = int(self.population.sum() * 1000)
        result = []
        for step in status_hist:
            warn = crit = safe = 0
            zone_breakdown = []
            for r in range(GRID_SIZE):
                zone_warn = zone_crit = zone_safe = 0
                for c in range(GRID_SIZE):
                    pop = int(self.population[r, c] * 1000)
                    s = step[r][c]
                    if s == "Warning":
                        warn += pop; zone_warn += pop
                    elif s == "Critical":
                        crit += pop; zone_crit += pop
                    else:
                        safe += pop; zone_safe += pop
                zone_breakdown.append({
                    "zone": ZONE_LABELS[r],
                    "safe": zone_safe,
                    "warning": zone_warn,
                    "critical": zone_crit,
                    "total": zone_safe + zone_warn + zone_crit,
                })
            result.append({
                "safe": safe,
                "warning": warn,
                "critical": crit,
                "total": warn + crit,
                "total_city": total_city,
                "pct_safe":     round(safe / total_city * 100, 1),
                "pct_warning":  round(warn / total_city * 100, 1),
                "pct_critical": round(crit / total_city * 100, 1),
                "zone_breakdown": zone_breakdown,
            })
        return result

    def _max_water_levels(self, water_hist):
        arr = np.array(water_hist)
        return np.max(arr, axis=0).tolist()
