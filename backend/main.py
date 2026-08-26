from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json

try:
    from relocation import generate_relocation_plan
except ImportError:
    from .relocation import generate_relocation_plan

app = FastAPI(title="SafeShift Disaster Intelligence API", version="1.0.0")

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

@app.get("/")
def home():
    return {
        "message": "SafeShift API running",
        "endpoints": [
            "/zones",
            "/relocation-plan"
        ]
    }

@app.get("/zones")
def get_zones():
    """Returns the raw multi-hazard GeoJSON dataset."""
    return geo_data

@app.get("/relocation-plan")
def get_relocation_plan():
    """
    Computes and returns the optimal relocation plan:
    - Ranks hazard zones by priority score (risk * population)
    - Pairs them with closest safe zones by centroid distance
    - Allocates people and splits across safe zones if capacity is exceeded
    """
    plan = generate_relocation_plan(geo_data)
    return plan