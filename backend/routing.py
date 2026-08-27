import os
import math
import requests
from typing import Tuple, Dict
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from backend/.env
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# In-memory routing cache to optimize performance and prevent rate limiting
_ROUTE_CACHE: Dict[Tuple[float, float, float, float], Tuple[float, float]] = {}

def haversine_distance_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Calculate great-circle distance between two coordinates in kilometers.
    """
    R = 6371.0  # Earth's mean radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def get_route_distance(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float
) -> Tuple[float, float]:
    """
    Computes real-world road distance (km) and estimated travel time (minutes)
    using the OpenRouteService API with automatic fallback to Haversine.

    Returns:
        (route_distance_km, estimated_travel_time_minutes)
    """
    cache_key = (
        round(origin_lat, 4),
        round(origin_lon, 4),
        round(dest_lat, 4),
        round(dest_lon, 4),
    )
    if cache_key in _ROUTE_CACHE:
        return _ROUTE_CACHE[cache_key]

    api_key = os.getenv("OPENROUTESERVICE_API_KEY", "").strip()

    if api_key:
        try:
            url = "https://api.openrouteservice.org/v2/directions/driving-car"
            headers = {
                "Authorization": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json, application/geo+json",
            }
            body = {
                "coordinates": [
                    [origin_lon, origin_lat],
                    [dest_lon, dest_lat],
                ]
            }
            response = requests.post(url, json=body, headers=headers, timeout=5)

            if response.status_code == 200:
                data = response.json()
                routes = data.get("routes", [])
                if routes:
                    summary = routes[0].get("summary", {})
                    distance_meters = summary.get("distance", 0)
                    duration_seconds = summary.get("duration", 0)

                    route_distance_km = round(distance_meters / 1000.0, 2)
                    travel_time_min = round(duration_seconds / 60.0, 1)

                    result = (route_distance_km, travel_time_min)
                    _ROUTE_CACHE[cache_key] = result
                    return result
            else:
                print(f"[OpenRouteService] API returned status {response.status_code}, falling back to Haversine.")
        except Exception as e:
            print(f"[OpenRouteService] Request failed: {e}, falling back to Haversine.")

    # Fallback to Haversine with road winding factor & average speed estimation
    crow_dist = haversine_distance_km(origin_lon, origin_lat, dest_lon, dest_lat)
    
    # Real-world road distance is typically ~20-30% longer than straight-line distance
    road_distance_km = round(crow_dist * 1.25, 2)
    
    # Average disaster transit evacuation speed ~ 50 km/h
    travel_time_min = round((road_distance_km / 50.0) * 60.0, 1)

    result = (road_distance_km, travel_time_min)
    _ROUTE_CACHE[cache_key] = result
    return result
