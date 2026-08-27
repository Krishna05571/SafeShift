from fastapi import FastAPI, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
import json

# Load environment variables
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

try:
    from relocation import generate_relocation_plan
    from gemini_explainer import explain_relocation_plan
    from simulation import simulate_disaster_state
except ImportError:
    from .relocation import generate_relocation_plan
    from .gemini_explainer import explain_relocation_plan
    from .simulation import simulate_disaster_state

app = FastAPI(
    title="SafeShift Disaster Intelligence API",
    description="Multi-Hazard Spatial Relocation Engine, Road Routing, AI Explainer & Disaster Simulator",
    version="2.1.0"
)

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Robust path resolution for GeoJSON data
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR.parent / "data" / "hazard_zones.geojson"
if not DATA_PATH.exists():
    DATA_PATH = BASE_DIR / "data" / "hazard_zones.geojson"

with open(DATA_PATH, "r", encoding="utf-8") as f:
    geo_data = json.load(f)

class ExplainRequest(BaseModel):
    relocation_plan: Optional[List[Dict[str, Any]]] = None

class SimulationRequest(BaseModel):
    time_step: int = 0

@app.get("/")
def home():
    return {
        "message": "SafeShift Disaster Intelligence API running",
        "version": "2.1.0",
        "endpoints": [
            "GET /zones",
            "GET /relocation-plan",
            "GET /simulate-disaster?t=0",
            "POST /simulate-disaster",
            "POST /ai-explain",
            "GET /ai-explain"
        ]
    }

@app.get("/zones")
def get_zones():
    """Returns the multi-hazard GeoJSON FeatureCollection."""
    return geo_data

@app.get("/relocation-plan")
def get_relocation_plan():
    """
    Computes and returns the optimal relocation plan:
    - Ranks hazard zones by priority score (risk * population)
    - Pairs them with closest safe zones by road routing / centroid distances
    - Computes distance_km and travel_time_min
    - Allocates people and splits across safe zones if capacity is exceeded
    """
    return generate_relocation_plan(geo_data)

@app.get("/simulate-disaster")
def get_simulate_disaster(t: int = Query(default=0, description="Simulation time step: 0=normal, 1=medium expands, 2=high spreads, 3=peak outbreak")):
    """
    Simulates disaster progression across India at time step t:
    t=0 -> Normal baseline
    t=1 -> Medium risk expands (+35% displacement)
    t=2 -> High risk spreads (+65% surge, immediate priority)
    t=3 -> Peak emergency outbreak
    """
    return simulate_disaster_state(geo_data, time_step=t)

@app.post("/simulate-disaster")
def post_simulate_disaster(body: Optional[SimulationRequest] = Body(default=None)):
    """
    POST endpoint to simulate dynamic disaster escalation and recompute the relocation plan.
    """
    t = body.time_step if body else 0
    return simulate_disaster_state(geo_data, time_step=t)

@app.post("/ai-explain")
def post_ai_explain(body: Optional[ExplainRequest] = Body(default=None)):
    """
    Analyzes the relocation plan using Google Gemini AI and generates
    human-readable explanations, priority justifications, and emergency recommendations.
    Accepts optional custom relocation_plan payload; defaults to live computed plan.
    """
    plan = body.relocation_plan if (body and body.relocation_plan) else generate_relocation_plan(geo_data)
    return explain_relocation_plan(plan)

@app.get("/ai-explain")
def get_ai_explain():
    """
    GET shortcut to generate and explain the live disaster relocation plan using Google Gemini AI.
    """
    plan = generate_relocation_plan(geo_data)
    return explain_relocation_plan(plan)