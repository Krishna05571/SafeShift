import math
from typing import List, Dict, Any
from shapely.geometry import shape

# 1. Risk Score Mapping
RISK_SCORES = {
    "high": 3,
    "medium": 2,
    "low": 1
}

def haversine_distance_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth (in km)
    using the Haversine formula.
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

def generate_relocation_plan(geo_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Analyzes multi-hazard GeoJSON data, computes priority scores,
    and matches hazard zones to closest safe zones with capacity allocation and splitting.
    """
    features = geo_data.get("features", [])
    
    hazard_zones = []
    safe_zones = []

    # Parse and categorize features
    for idx, f in enumerate(features):
        props = f.get("properties", {})
        geom_json = f.get("geometry")
        if not geom_json:
            continue
            
        geom = shape(geom_json)
        centroid = geom.centroid  # Shapely centroid (x=lon, y=lat)
        
        is_safe = props.get("safe") is True or props.get("location_type") == "relocation_site"
        
        if is_safe:
            capacity = int(props.get("capacity", 0))
            safe_zones.append({
                "id": idx,
                "area_name": props.get("area_name", f"Safe Zone {len(safe_zones)+1}"),
                "capacity": capacity,
                "remaining_capacity": capacity,
                "centroid_lon": centroid.x,
                "centroid_lat": centroid.y,
            })
        else:
            risk = str(props.get("risk", "low")).lower()
            population = int(props.get("population", 0))
            
            # 1. Assign risk score
            risk_score = RISK_SCORES.get(risk, 1)
            
            # 2. Calculate relocation priority score
            priority_score = risk_score * population
            
            hazard_zones.append({
                "id": idx,
                "area_name": props.get("area_name", f"Hazard Zone {len(hazard_zones)+1}"),
                "hazard_type": props.get("hazard_type", "general"),
                "risk": risk,
                "risk_score": risk_score,
                "population": population,
                "priority_score": priority_score,
                "priority": props.get("priority", "short-term"),
                "centroid_lon": centroid.x,
                "centroid_lat": centroid.y,
            })

    # Sort hazard zones by highest priority score first (emergency triage)
    hazard_zones.sort(key=lambda x: x["priority_score"], reverse=True)

    relocations: List[Dict[str, Any]] = []

    # 3 & 4. Match hazard zones to closest safe zones and allocate population
    for hz in hazard_zones:
        people_to_relocate = hz["population"]
        if people_to_relocate <= 0:
            continue

        # Sort safe zones by distance from this hazard zone centroid
        safe_zones_by_distance = []
        for sz in safe_zones:
            dist = haversine_distance_km(
                hz["centroid_lon"], hz["centroid_lat"],
                sz["centroid_lon"], sz["centroid_lat"]
            )
            safe_zones_by_distance.append((dist, sz))

        safe_zones_by_distance.sort(key=lambda x: x[0])

        # Allocate people across closest safe zones (splitting if needed)
        for dist, sz in safe_zones_by_distance:
            if people_to_relocate <= 0:
                break

            if sz["remaining_capacity"] <= 0:
                continue

            # Allocate up to the remaining capacity of the current safe zone
            allocated = min(people_to_relocate, sz["remaining_capacity"])
            
            sz["remaining_capacity"] -= allocated
            people_to_relocate -= allocated

            # 5. Exact output format requested + distance & hazard metadata
            relocation_item = {
                "from": hz["area_name"],
                "to": sz["area_name"],
                "people": allocated,
                "priority_score": hz["priority_score"],
                "distance_km": dist,
                "hazard_type": hz["hazard_type"],
                "risk": hz["risk"]
            }
            relocations.append(relocation_item)

        # If safe capacity was exhausted and people remain
        if people_to_relocate > 0:
            relocations.append({
                "from": hz["area_name"],
                "to": "UNASSIGNED (Shelter Capacity Full)",
                "people": people_to_relocate,
                "priority_score": hz["priority_score"],
                "distance_km": None,
                "hazard_type": hz["hazard_type"],
                "risk": hz["risk"],
                "status": "OVERFLOW_ALERT"
            })

    return relocations
