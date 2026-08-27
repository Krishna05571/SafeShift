from fastapi import FastAPI, Body
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
except ImportError:
    from .relocation import generate_relocation_plan
    from .gemini_explainer import explain_relocation_plan

app = FastAPI(
    title="SafeShift Disaster Intelligence API",
    description="Multi-Hazard Spatial Relocation Engine & AI Decision Explainer",
    version="2.0.0"
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

@app.get("/")
def home():
    return {
        "message": "SafeShift Disaster Intelligence API running",
        "version": "2.0.0",
        "endpoints": [
            "GET /zones",
            "GET /relocation-plan",
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