from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from simulation import FloodSimulation, SimulationConfig
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
    blocked_channels: List[List[int]] = []
    scenario: str = "custom"


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
    cfg = SimulationConfig(
        rainfall_intensity=cfg_dict["rainfall_intensity"],
        duration_hours=cfg_dict["duration_hours"],
        time_step=cfg_dict["time_step"],
        drainage_failure=cfg_dict["drainage_failure"],
        blocked_channels=[tuple(c) for c in cfg_dict["blocked_channels"]],
        scenario=cfg_dict.get("scenario", "custom"),
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


class BriefRequest(BaseModel):
    scenario: str = "custom"
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
    worst_zone: Optional[str] = None


@app.post("/api/brief")
def generate_brief(req: BriefRequest):
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        blocked_note = (
            f"{len(req.blocked_channels)} drainage channels blocked" if req.blocked_channels else "all channels clear"
        )
        infra_note = "92% infrastructure failure" if req.drainage_failure else "infrastructure nominal"

        prompt = f"""You are a flood emergency operations analyst providing a real-time situation brief.

SIMULATION RESULTS:
- Scenario: {req.scenario.replace('_', ' ').title()}
- Rainfall: {req.rainfall_intensity} mm/hr over {req.duration_hours} hours
- Infrastructure: {infra_note}, {blocked_note}
- Region status: {req.critical_count} CRITICAL / {req.warning_count} WARNING / {req.safe_count} SAFE (out of 64 total)
- Affected population: {req.affected_population:,} of {req.total_population:,} residents
- Peak water depth recorded: {req.peak_water:.0f} mm
- Most at-risk zone: {req.worst_zone or "N/A"}

Write a 3-sentence tactical situation brief. Cover: (1) overall flood severity and key zones at risk, (2) population impact, (3) recommended immediate actions. Be direct, factual, and use emergency-operations language. No bullet points."""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=220,
            messages=[{"role": "user", "content": prompt}]
        )
        return {"brief": message.content[0].text}
    except Exception as e:
        return {"brief": None, "error": str(e)}


@app.get("/health")
def health():
    return {"status": "ok"}
