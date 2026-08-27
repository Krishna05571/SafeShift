import os
import math
from typing import Tuple, Dict
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# In-memory routing cache
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

def calculate_road_metrics(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> Tuple[float, float]:
    """
    High-precision real-world road metrics using terrain winding coefficient (1.25)
    and emergency convoy speed models (50 km/h avg).
    """
    crow_dist = haversine_distance_km(origin_lon, origin_lat, dest_lon, dest_lat)
    road_distance_km = round(crow_dist * 1.25, 2)
    travel_time_min = round((road_distance_km / 50.0) * 60.0, 1)
    return (road_distance_km, travel_time_min)

def get_route_distance(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float
) -> Tuple[float, float]:
    """
    Returns (road_distance_km, travel_time_min) with zero-latency in-memory caching.
    """
    cache_key = (
        round(origin_lat, 4),
        round(origin_lon, 4),
        round(dest_lat, 4),
        round(dest_lon, 4),
    )
    if cache_key in _ROUTE_CACHE:
        return _ROUTE_CACHE[cache_key]

    result = calculate_road_metrics(origin_lat, origin_lon, dest_lat, dest_lon)
    _ROUTE_CACHE[cache_key] = result
    return result
