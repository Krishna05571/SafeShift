import json, sys
from pathlib import Path
from shapely.geometry import shape

root_dir = Path(".").resolve()
cache_file = root_dir / "data" / "precomputed_routes.json"
geojson_file = root_dir / "data" / "hazard_zones.geojson"

sys.path.insert(0, str(root_dir / "backend"))
from routing import get_detailed_route_geometry

existing_data = {}
if cache_file.exists():
    with open(cache_file, "r", encoding="utf-8") as f:
        existing_data = json.load(f)

print("Existing entries:", len(existing_data))

with open(geojson_file, "r", encoding="utf-8") as f:
    geo = json.load(f)

hazards = []
safes = []

for f in geo["features"]:
    p = f.get("properties", {})
    geom = shape(f["geometry"])
    c = geom.centroid
    is_safe = p.get("safe") is True or p.get("location_type") == "relocation_site"
    if is_safe:
        safes.append({"name": p.get("area_name"), "lat": c.y, "lon": c.x})
    else:
        hazards.append({"name": p.get("area_name"), "lat": c.y, "lon": c.x})

print(f"Total pairs to cover: {len(hazards) * len(safes)}")

new_count = 0
for h in hazards:
    for s in safes:
        k = f"{round(h['lat'], 4)}_{round(h['lon'], 4)}_{round(s['lat'], 4)}_{round(s['lon'], 4)}"
        if k not in existing_data:
            res = get_detailed_route_geometry(h["lat"], h["lon"], s["lat"], s["lon"])
            existing_data[k] = {
                "coordinates": res.get("coordinates", []),
                "distance_km": res.get("distance_km", 0),
                "travel_time_min": res.get("travel_time_min", 0),
                "source": res.get("source", "SafeShift Routing Engine"),
                "waypoints_count": res.get("waypoints_count", len(res.get("coordinates", []))),
                "from": h["name"],
                "to": s["name"]
            }
            new_count += 1

print(f"Computed {new_count} new routes. Total: {len(existing_data)}")
with open(cache_file, "w", encoding="utf-8") as f:
    json.dump(existing_data, f, indent=2)
print("Done saving!")
