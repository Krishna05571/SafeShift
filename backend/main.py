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
    from simulation import simulate_disaster_state, project_disaster_scenario
    from routing import get_detailed_route_geometry
    from weather_service import get_live_zones_with_weather, fetch_weather_for_coordinate
    from safezone_service import safezone_manager
except ImportError:
    from .relocation import generate_relocation_plan
    from .gemini_explainer import explain_relocation_plan
    from .simulation import simulate_disaster_state, project_disaster_scenario
    from .routing import get_detailed_route_geometry
    from .weather_service import get_live_zones_with_weather, fetch_weather_for_coordinate
    from .safezone_service import safezone_manager

app = FastAPI(
    title="SafeShift Disaster Intelligence API",
    description="Multi-Hazard Spatial Relocation Engine, Live Meteorological Risk Prediction, Real-Time Shelter Capacity Tracking, Google Maps Routing, AI Explainer & Disaster Simulator",
    version="3.0.0"
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

# Initialize Safe Zone Capacity State from GeoJSON
safezone_manager.initialize_from_geojson(geo_data)

# Pre-warm weather cache on initialization for instantaneous API responses (<1ms)
try:
    get_live_zones_with_weather(geo_data, force_refresh=False)
except Exception as e:
    print(f"Initial weather pre-warm notice: {e}")



class ExplainRequest(BaseModel):
    relocation_plan: Optional[List[Dict[str, Any]]] = None

class SimulationRequest(BaseModel):
    time_step: Optional[int] = None
    minutes: Optional[int] = None
    refresh_weather: bool = False

class CapacityUpdateRequest(BaseModel):
    reset: bool = False
    delta_people: Optional[int] = None


@app.get("/")
def home():
    return {
        "message": "SafeShift Disaster Scenario Intelligence & Dynamic Weather API running",
        "version": "3.0.0",
        "endpoints": [
            "GET /zones",
            "GET /zones/live",
            "GET /weather-impact",
            "GET /relocation-plan?live=true",
            "GET /route-geometry?origin_lat=...&origin_lon=...&dest_lat=...&dest_lon=...",
            "GET /simulate-disaster?minutes=0",
            "POST /simulate-disaster",
            "POST /ai-explain",
            "GET /ai-explain"
        ]
    }

@app.get("/zones")
def get_zones():
    """Returns the multi-hazard GeoJSON FeatureCollection (baseline)."""
    return geo_data

@app.get("/zones/live")
def get_zones_live(refresh: bool = Query(default=False, description="Force refresh weather cache")):
    """
    Returns updated GeoJSON FeatureCollection with live meteorological data (rainfall, humidity, temp)
    and dynamically predicted disaster risk levels (Floods & Landslides).
    """
    live_geo_data, _ = get_live_zones_with_weather(geo_data, force_refresh=refresh)
    return live_geo_data

@app.get("/weather-impact")
def get_weather_impact(refresh: bool = Query(default=False, description="Force refresh weather cache")):
    """
    Returns structured meteorological data, rainfall impact on each hazard zone,
    and smart alerts triggered for critical risk escalations.
    """
    live_geo_data, impact_summary = get_live_zones_with_weather(geo_data, force_refresh=refresh)
    metadata = live_geo_data.get("metadata", {})
    return {
        "status": "success",
        "timestamp": metadata.get("cached_at"),
        "ttl_seconds": metadata.get("ttl_seconds", 600),
        "total_monitored_zones": len(impact_summary),
        "smart_alerts_count": metadata.get("smart_alerts_count", 0),
        "smart_alerts": metadata.get("smart_alerts", []),
        "zones_impact": impact_summary,
    }

@app.get("/relocation-plan")
def get_relocation_plan(live: bool = Query(default=True, description="Compute relocation plan using live weather predicted risk")):
    """
    Computes and returns the optimal relocation plan:
    - Ranks hazard zones by priority score (risk * population)
    - Pairs them with closest safe zones by road routing / centroid distances
    - Computes distance_km, travel_time_min, origin_coords, and dest_coords
    - Allocates people and splits across safe zones if capacity is exceeded
    """
    active_geo = geo_data
    if live:
        active_geo, _ = get_live_zones_with_weather(geo_data, force_refresh=False)
    return generate_relocation_plan(active_geo)

@app.get("/route-geometry")
def get_route_geometry(
    origin_lat: float = Query(..., description="Origin Hazard Zone Latitude"),
    origin_lon: float = Query(..., description="Origin Hazard Zone Longitude"),
    dest_lat: float = Query(..., description="Destination Safe Shelter Latitude"),
    dest_lon: float = Query(..., description="Destination Safe Shelter Longitude"),
):
    """
    Returns high-resolution curved highway coordinates, distance, and duration
    between a selected hazard zone and its assigned safe haven.
    """
    return get_detailed_route_geometry(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon
    )

@app.get("/simulate-disaster")
def get_simulate_disaster(
    minutes: Optional[int] = Query(default=None, ge=0, le=60, description="Forecast timeline minutes (0 to 60)"),
    t: Optional[int] = Query(default=None, description="Legacy discrete time step: 0=0m, 1=15m, 2=35m, 3=60m"),
    refresh_weather: bool = Query(default=False, description="Force refresh weather before projection")
):
    """
    Scenario Intelligence Engine: Simulates disaster progression across India over a continuous 0-60 min timeline:
    - Integrates live rainfall, humidity, and atmospheric conditions
    - Projects physical flood spread and landslide slope failure probability
    - Forecasts safe zone load growth, triggers 30% and 10% remaining threshold warnings
    - Evaluates multi-zone spillover reallocations to top 2 nearest candidate safe havens
    """
    if minutes is not None:
        target_minutes = max(0, min(int(minutes), 60))
    elif t is not None:
        step_map = {0: 0, 1: 15, 2: 35, 3: 60}
        target_minutes = step_map.get(int(t), min(60, max(0, int(t))))
    else:
        target_minutes = 0

    return project_disaster_scenario(geo_data, forecast_minutes=target_minutes, force_weather_refresh=refresh_weather)

@app.post("/simulate-disaster")
def post_simulate_disaster(body: Optional[SimulationRequest] = Body(default=None)):
    """
    POST endpoint to run dynamic scenario projections over 0-60 min timeline.
    """
    target_minutes = 0
    refresh = False
    if body:
        refresh = body.refresh_weather
        if body.minutes is not None:
            target_minutes = max(0, min(int(body.minutes), 60))
        elif body.time_step is not None:
            step_map = {0: 0, 1: 15, 2: 35, 3: 60}
            target_minutes = step_map.get(int(body.time_step), min(60, max(0, int(body.time_step))))

    return project_disaster_scenario(geo_data, forecast_minutes=target_minutes, force_weather_refresh=refresh)

@app.post("/ai-explain")
def post_ai_explain(body: Optional[ExplainRequest] = Body(default=None)):
    """
    Analyzes the relocation plan using Google Gemini AI and generates
    human-readable explanations, priority justifications, and emergency recommendations.
    Accepts optional custom relocation_plan payload; defaults to live computed plan.
    """
    plan = body.relocation_plan if (body and body.relocation_plan) else generate_relocation_plan(geo_data)
    return explain_relocation_plan(plan)

@app.get("/safezones/status")
def get_safezones_status(auto_tick: bool = Query(default=True, description="Automatically advance capacity simulation tick")):
    """
    Returns real-time capacity, current occupancy, remaining capacity, fill percentages,
    predictive fill ETA (minutes to 100%), and active stacked threshold alerts.
    """
    if auto_tick:
        return safezone_manager.simulate_tick()
    return safezone_manager.get_status_summary()

@app.post("/safezones/update")
def post_safezones_update(body: Optional[CapacityUpdateRequest] = Body(default=None)):
    """
    Simulates live shelter occupancy influx or resets capacities.
    """
    if body and body.reset:
        return safezone_manager.reset_capacities()
    delta = body.delta_people if body else None
    return safezone_manager.simulate_tick(delta_people=delta)

@app.get("/safezones/alternatives")
def get_safezones_alternatives(
    origin_lat: float = Query(..., description="Hazard Origin Latitude"),
    origin_lon: float = Query(..., description="Hazard Origin Longitude"),
    current_zone: Optional[str] = Query(default=None, description="Currently assigned or nearing-capacity safe zone name to exclude"),
    limit: int = Query(default=2, description="Number of alternative safe zones to return")
):
    """
    Finds the top N nearest alternative safe zones with available headroom (>10%),
    using Google Maps Distance Matrix / Directions API with high-precision road fallback.
    """
    return safezone_manager.get_alternate_safezones(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        current_safezone_name=current_zone,
        limit=limit
    )

@app.get("/safezones/multi-routes")
def get_multi_routes(
    origin_lat: float = Query(..., description="Hazard Origin Latitude"),
    origin_lon: float = Query(..., description="Hazard Origin Longitude"),
    origin_name: Optional[str] = Query(default="Hazard Origin", description="Origin Zone Name"),
    dest_lat: float = Query(..., description="Primary Destination Safe Zone Latitude"),
    dest_lon: float = Query(..., description="Primary Destination Safe Zone Longitude"),
    dest_name: str = Query(..., description="Primary Destination Safe Zone Name"),
):
    """
    Returns 3 color-coded highway evacuation routes:
    - 🔵 Primary Route (to current matched safe haven)
    - 🟢 Alternate Route 1 (nearest candidate with capacity)
    - 🟡 Alternate Route 2 (second candidate with capacity)
    """
    # 1. Primary Route Geometry
    primary_geom = get_detailed_route_geometry(origin_lat, origin_lon, dest_lat, dest_lon)
    
    # Retrieve current primary shelter state
    primary_zone_state = safezone_manager.safe_zones.get(dest_name, {})
    primary_data = {
        "id": "primary",
        "name": dest_name,
        "type": "primary",
        "color": "#3b82f6", # Blue
        "distance_km": primary_geom.get("distance_km", 0),
        "travel_time_min": primary_geom.get("travel_time_min", 0),
        "remaining_capacity": primary_zone_state.get("remaining_capacity", 0),
        "total_capacity": primary_zone_state.get("total_capacity", 5000),
        "fill_percentage": primary_zone_state.get("fill_percentage", 50.0),
        "alert_level": primary_zone_state.get("alert_level", "NORMAL"),
        "coordinates": primary_geom.get("coordinates", []),
        "source": primary_geom.get("source", "SafeShift Engine"),
        "dest_coords": [dest_lat, dest_lon],
    }

    # 2. Fetch 2 Alternate Safe Zones
    alternatives = safezone_manager.get_alternate_safezones(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        current_safezone_name=dest_name,
        limit=2
    )

    alt_routes = []
    colors = ["#10b981", "#f59e0b"] # Emerald Green, Amber
    types = ["alternate_1", "alternate_2"]

    for idx, alt in enumerate(alternatives):
        alt_geom = get_detailed_route_geometry(
            origin_lat, origin_lon, alt["centroid_lat"], alt["centroid_lon"]
        )
        alt_routes.append({
            "id": types[idx] if idx < len(types) else f"alternate_{idx+1}",
            "name": alt["name"],
            "type": types[idx] if idx < len(types) else f"alternate_{idx+1}",
            "color": colors[idx] if idx < len(colors) else "#8b5cf6",
            "distance_km": alt.get("distance_km", alt_geom.get("distance_km", 0)),
            "travel_time_min": alt.get("eta_minutes", alt_geom.get("travel_time_min", 0)),
            "remaining_capacity": alt.get("remaining_capacity", 0),
            "total_capacity": alt.get("total_capacity", 5000),
            "fill_percentage": alt.get("fill_percentage", 0),
            "coordinates": alt_geom.get("coordinates", []),
            "source": alt_geom.get("source", "SafeShift Engine"),
            "dest_coords": [alt["centroid_lat"], alt["centroid_lon"]],
        })

    return {
        "status": "success",
        "origin": {
            "name": origin_name,
            "coords": [origin_lat, origin_lon],
        },
        "primary": primary_data,
        "alternates": alt_routes,
    }

@app.get("/ai-explain")
def get_ai_explain():
    """
    GET shortcut to generate and explain the live disaster relocation plan using Google Gemini AI.
    """
    live_geo, _ = get_live_zones_with_weather(geo_data, force_refresh=False)
    plan = generate_relocation_plan(live_geo)
    return explain_relocation_plan(plan)