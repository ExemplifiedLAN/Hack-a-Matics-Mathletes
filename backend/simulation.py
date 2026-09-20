import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional

ELEVATION_MAP = np.array([
    [48, 44, 40, 36, 36, 40, 44, 48],
    [36, 30, 24, 20, 20, 24, 30, 36],
    [26, 20, 14, 10, 10, 14, 20, 26],
    [18, 12,  7,  4,  4,  7, 12, 18],
    [12,  7,  3,  1,  1,  3,  7, 12],
    [ 8,  4,  1,  0,  0,  1,  4,  8],
    [ 5,  2,  0,  0,  0,  0,  2,  5],
    [ 3,  1,  0,  0,  0,  0,  1,  3],
], dtype=float)

DRAINAGE_BASE = np.array([
    [30, 28, 25, 22, 22, 25, 28, 30],
    [25, 22, 20, 18, 18, 20, 22, 25],
    [20, 18, 16, 14, 14, 16, 18, 20],
    [16, 14, 22, 26, 26, 22, 14, 16],
    [14, 12, 28, 32, 32, 28, 12, 14],
    [ 8,  6,  8,  6,  6,  8,  6,  8],
    [ 5,  4,  4,  2,  2,  4,  4,  5],
    [ 3,  2,  2,  0,  0,  2,  2,  3],
], dtype=float)

POPULATION_MAP = np.array([
    [ 2,  3,  5,  4,  4,  5,  3,  2],
    [ 5,  8, 11,  9,  9, 11,  8,  5],
    [ 8, 13, 16, 14, 14, 16, 13,  8],
    [10, 16, 21, 26, 26, 21, 16, 10],
    [11, 19, 27, 36, 36, 27, 19, 11],
    [ 8, 11, 13, 16, 16, 13, 11,  8],
    [ 5,  7,  9, 11, 11,  9,  7,  5],
    [ 2,  3,  4,  6,  6,  4,  3,  2],
], dtype=float)

REGION_NAMES = [
    ["N.Hill-A","N.Hill-B","N.Hill-C","N.Hill-D","N.Hill-E","N.Hill-F","N.Hill-G","N.Hill-H"],
    ["UpSub-A", "UpSub-B", "UpSub-C", "UpSub-D", "UpSub-E", "UpSub-F", "UpSub-G", "UpSub-H"],
    ["Suburb-A","Suburb-B","Suburb-C","Suburb-D","Suburb-E","Suburb-F","Suburb-G","Suburb-H"],
    ["ICity-A", "ICity-B", "ICity-C", "ICity-D", "ICity-E", "ICity-F", "ICity-G", "ICity-H"],
    ["DT-A",    "DT-B",    "DT-C",    "CBD-D",   "CBD-E",   "DT-F",    "DT-G",    "DT-H"],
    ["RBank-A", "RBank-B", "RBank-C", "RBank-D", "RBank-E", "RBank-F", "RBank-G", "RBank-H"],
    ["FPlain-A","FPlain-B","FPlain-C","FPlain-D","FPlain-E","FPlain-F","FPlain-G","FPlain-H"],
    ["LLand-A", "LLand-B", "LLand-C", "LLand-D", "LLand-E", "LLand-F", "LLand-G", "LLand-H"],
]

CRITICAL_THRESHOLD = 300.0
WARNING_THRESHOLD  = 100.0
FLOW_COEFFICIENT   =   0.08

ZONE_LABELS = [
    "Northern Hills", "Upper Suburbs", "Suburbs", "Inner City",
    "Downtown", "River Bank", "Flood Plain", "Southern Lowlands",
]


@dataclass
class SimulationConfig:
    rainfall_intensity: float = 50.0
    duration_hours: float = 12.0
    time_step: float = 0.25
    drainage_failure: bool = False
    blocked_channels: List = field(default_factory=list)
    scenario: str = "custom"
    custom_elevation: Optional[List] = None
    custom_drainage: Optional[List] = None
    custom_population: Optional[List] = None
    custom_names: Optional[List] = None
    custom_zone_labels: Optional[List] = None
    origin_cells: Optional[List] = None


class FloodSimulation:
    def __init__(self, config: SimulationConfig):
        self.config = config

        if config.custom_elevation is not None:
            self.elevation = np.array(config.custom_elevation, dtype=float)
        else:
            self.elevation = ELEVATION_MAP.copy()

        if config.custom_drainage is not None:
            self.drainage = np.array(config.custom_drainage, dtype=float)
        else:
            self.drainage = DRAINAGE_BASE.copy()

        if config.custom_population is not None:
            self.population = np.array(config.custom_population, dtype=float)
        else:
            self.population = POPULATION_MAP.copy()

        self.names      = config.custom_names      if config.custom_names      else REGION_NAMES
        self.zone_labels = config.custom_zone_labels if config.custom_zone_labels else ZONE_LABELS

        self.origin_set = (
            {(int(rc[0]), int(rc[1])) for rc in config.origin_cells}
            if config.origin_cells else None
        )

        # Support rectangular grids (NR rows × NC cols)
        self.grid_nr = self.elevation.shape[0]
        self.grid_nc = self.elevation.shape[1]

        if config.drainage_failure:
            self.drainage *= 0.08

        for rc in config.blocked_channels:
            r, c = int(rc[0]), int(rc[1])
            if 0 <= r < self.grid_nr and 0 <= c < self.grid_nc:
                self.drainage[r][c] = 0.0

        self.water = np.zeros_like(self.elevation)

    def _rainfall(self, row: int, col: int) -> float:
        if self.origin_set is not None and (row, col) not in self.origin_set:
            return 0.0
        elev_factor = 1.0 + (self.elevation[row][col] / 200.0) * 0.4
        return self.config.rainfall_intensity * elev_factor

    def _flow(self, fr: int, fc: int, tr: int, tc: int) -> float:
        NR, NC = self.grid_nr, self.grid_nc
        if not (0 <= fr < NR and 0 <= fc < NC): return 0.0
        if not (0 <= tr < NR and 0 <= tc < NC): return 0.0
        h_from = self.water[fr][fc] + self.elevation[fr][fc]
        h_to   = self.water[tr][tc] + self.elevation[tr][tc]
        if h_from > h_to:
            raw = FLOW_COEFFICIENT * (h_from - h_to)
            return min(raw, self.water[fr][fc] * 0.25)
        return 0.0

    def _classify(self, wl: float) -> str:
        if wl >= CRITICAL_THRESHOLD: return "Critical"
        if wl >= WARNING_THRESHOLD:  return "Warning"
        return "Safe"

    def _step(self, dt: float):
        new_w = self.water.copy()
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        NR, NC = self.grid_nr, self.grid_nc
        for r in range(NR):
            for c in range(NC):
                rain     = self._rainfall(r, c) * dt
                drain    = min(self.drainage[r][c] * dt, self.water[r, c])
                flow_out = sum(self._flow(r, c, r+dr, c+dc) for dr, dc in directions)
                flow_in  = sum(self._flow(r+dr, c+dc, r, c) for dr, dc in directions)
                new_w[r, c] = max(0.0, self.water[r, c] + rain - drain + flow_in - flow_out)
        self.water = new_w

    def run(self) -> Dict:
        NR, NC = self.grid_nr, self.grid_nc
        num_steps = int(self.config.duration_hours / self.config.time_step)
        times, water_hist, status_hist = [], [], []

        for i in range(num_steps + 1):
            t = round(i * self.config.time_step, 4)
            times.append(t)
            water_hist.append(self.water.tolist())
            status_hist.append(
                [[self._classify(self.water[r, c]) for c in range(NC)]
                 for r in range(NR)]
            )
            if i < num_steps:
                self._step(self.config.time_step)

        ttc  = self._time_to_critical(times, water_hist)
        aff  = self._affected_population(status_hist)
        max_wl = self._max_water_levels(water_hist)

        return {
            "time_steps": times,
            "water_history": water_hist,
            "status_history": status_hist,
            "time_to_critical": ttc,
            "affected_population": aff,
            "max_water_levels": max_wl,
            "grid_metadata": {
                "elevation":  self.elevation.tolist(),
                "drainage":   self.drainage.tolist(),
                "population": self.population.tolist(),
                "names":      self.names,
                "zone_labels": self.zone_labels,
                "total_population": int(self.population.sum() * 1000),
                "grid_nr": NR, "grid_nc": NC,
                "zone_populations": [
                    {"zone": self.zone_labels[r], "population": int(self.population[r].sum() * 1000)}
                    for r in range(NR)
                ],
            },
            "config": {
                "rainfall_intensity": self.config.rainfall_intensity,
                "duration_hours":     self.config.duration_hours,
                "time_step":          self.config.time_step,
                "drainage_failure":   self.config.drainage_failure,
                "scenario":           self.config.scenario,
            },
            "thresholds": {"critical": CRITICAL_THRESHOLD, "warning": WARNING_THRESHOLD},
        }

    def _time_to_critical(self, times, water_hist):
        NR, NC = self.grid_nr, self.grid_nc
        ttc = [[None] * NC for _ in range(NR)]
        for r in range(NR):
            for c in range(NC):
                for i, t in enumerate(times):
                    if water_hist[i][r][c] >= CRITICAL_THRESHOLD:
                        ttc[r][c] = t
                        break
        return ttc

    def _affected_population(self, status_hist):
        NR, NC = self.grid_nr, self.grid_nc
        total_city = int(self.population.sum() * 1000)
        result = []
        for step in status_hist:
            warn = crit = safe = 0
            zone_breakdown = []
            for r in range(NR):
                zone_warn = zone_crit = zone_safe = 0
                for c in range(NC):
                    pop = int(self.population[r, c] * 1000)
                    s = step[r][c]
                    if s == "Warning":   warn += pop; zone_warn += pop
                    elif s == "Critical": crit += pop; zone_crit += pop
                    else:                safe += pop; zone_safe += pop
                zone_breakdown.append({
                    "zone": self.zone_labels[r],
                    "safe": zone_safe, "warning": zone_warn,
                    "critical": zone_crit,
                    "total": zone_safe + zone_warn + zone_crit,
                })
            result.append({
                "safe": safe, "warning": warn, "critical": crit,
                "total": warn + crit, "total_city": total_city,
                "pct_safe":     round(safe / total_city * 100, 1),
                "pct_warning":  round(warn / total_city * 100, 1),
                "pct_critical": round(crit / total_city * 100, 1),
                "zone_breakdown": zone_breakdown,
            })
        return result

    def _max_water_levels(self, water_hist):
        arr = np.array(water_hist)
        return np.max(arr, axis=0).tolist()
