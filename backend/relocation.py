from typing import List, Dict, Any
from shapely.geometry import shape

try:
    from routing import get_route_distance, haversine_distance_km
except ImportError:
    from .routing import get_route_distance, haversine_distance_km

# Risk Score Weights for Emergency Triage
RISK_SCORES = {
    "high": 3,
    "medium": 2,
    "low": 1
}

def generate_relocation_plan(geo_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Analyzes multi-hazard GeoJSON data, computes priority scores,
    matches hazard zones to closest safe zones using road routing / centroid distances,
    and dynamically allocates population with capacity reduction and splitting.
    """
    features = geo_data.get("features", [])
    
    hazard_zones = []
    safe_zones = []

    # Parse and extract centroids using Shapely
    for idx, f in enumerate(features):
        props = f.get("properties", {})
        geom_json = f.get("geometry")
        if not geom_json:
            continue
            
        geom = shape(geom_json)
        centroid = geom.centroid  # Shapely Centroid (x=lon, y=lat)
        
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
            
            # Step 1: Assign risk score
            risk_score = RISK_SCORES.get(risk, 1)
            
            # Step 2: Calculate relocation priority score
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

    # Emergency Triage: Process highest priority scores first
    hazard_zones.sort(key=lambda x: x["priority_score"], reverse=True)

    relocations: List[Dict[str, Any]] = []

    # Step 3 & 4: Match to nearest safe zones with capacity deduction & splitting
    for hz in hazard_zones:
        people_to_relocate = hz["population"]
        if people_to_relocate <= 0:
            continue

        # Sort safe zones by proximity from this hazard zone's centroid
        safe_zones_by_distance = []
        for sz in safe_zones:
            # Fast straight-line sorting metric
            crow_dist = haversine_distance_km(
                hz["centroid_lon"], hz["centroid_lat"],
                sz["centroid_lon"], sz["centroid_lat"]
            )
            safe_zones_by_distance.append((crow_dist, sz))

        safe_zones_by_distance.sort(key=lambda x: x[0])

        for _, sz in safe_zones_by_distance:
            if people_to_relocate <= 0:
                break

            if sz["remaining_capacity"] <= 0:
                continue

            # Calculate real-world road routing distance and transit time
            route_dist_km, travel_time_min = get_route_distance(
                origin_lat=hz["centroid_lat"],
                origin_lon=hz["centroid_lon"],
                dest_lat=sz["centroid_lat"],
                dest_lon=sz["centroid_lon"]
            )

            # Allocate up to the remaining capacity of the current safe zone
            allocated = min(people_to_relocate, sz["remaining_capacity"])
            
            sz["remaining_capacity"] -= allocated
            people_to_relocate -= allocated

            # Step 5: Updated relocation output schema with road distance and travel time
            relocation_item = {
                "from": hz["area_name"],
                "to": sz["area_name"],
                "people": allocated,
                "priority_score": hz["priority_score"],
                "distance_km": route_dist_km,
                "travel_time_min": travel_time_min,
                "hazard_type": hz["hazard_type"],
                "risk": hz["risk"]
            }
            relocations.append(relocation_item)

        # Overflow fallback if all safe zones are full
        if people_to_relocate > 0:
            relocations.append({
                "from": hz["area_name"],
                "to": "UNASSIGNED (Shelter Capacity Full)",
                "people": people_to_relocate,
                "priority_score": hz["priority_score"],
                "distance_km": None,
                "travel_time_min": None,
                "hazard_type": hz["hazard_type"],
                "risk": hz["risk"],
                "status": "OVERFLOW_ALERT"
            })

    return relocations
