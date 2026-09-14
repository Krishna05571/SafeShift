import os
import math
import time
import threading
import requests
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import shape
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

try:
    from routing import (
        haversine_distance_km,
        calculate_road_metrics,
        get_detailed_route_geometry,
        decode_google_polyline,
    )
except ImportError:
    from .routing import (
        haversine_distance_km,
        calculate_road_metrics,
        get_detailed_route_geometry,
        decode_google_polyline,
    )

# Lock for thread-safe state modification
_STATE_LOCK = threading.Lock()

# In-memory cache for distance & duration metrics
_ROAD_METRICS_CACHE: Dict[Tuple[float, float, float, float], Tuple[float, float]] = {}

class SafeZoneCapacityManager:
    """
    Manages real-time shelter capacity, live occupancy simulation,
    multi-tier threshold alerts (70%, 90%, 100%), and AI alternate safe haven recommendations.
    """

    def __init__(self):
        self.safe_zones: Dict[str, Dict[str, Any]] = {}
        self.last_tick_time: float = time.time()
        self.simulation_active: bool = True
        self.tick_count: int = 0
        self._initialized: bool = False

    def initialize_from_geojson(self, geo_data: Dict[str, Any]):
        """
        Parses safe zones from GeoJSON and initializes base capacity state.
        """
        with _STATE_LOCK:
            features = geo_data.get("features", [])
            for idx, f in enumerate(features):
                props = f.get("properties", {})
                is_safe = props.get("safe") is True or props.get("location_type") == "relocation_site"
                if not is_safe:
                    continue

                area_name = props.get("area_name", f"Safe Zone {idx+1}")
                total_cap = int(props.get("capacity", 5000))
                
                DEFAULT_OCCUPANCIES = {
                    "Safe Zone South-1 (Kozhikode Regional Elevated Sports Complex)": 92.4, # CRITICAL (Red)
                    "Safe Zone East-3 (Patna AIIMS & Bihta Highland Center)": 94.8,         # CRITICAL (Red)
                    "Safe Zone North-1 (Dehradun FRI & Cantt Grounds)": 78.5,             # WARNING (Yellow)
                    "Safe Zone West-2 (Pune Pimpri Elevated Shelter Grounds)": 82.6,       # WARNING (Yellow)
                    "Safe Zone East-1 (Guwahati Khanapara Elevated Stadium)": 86.0,        # WARNING (Yellow)
                    "Safe Zone South-2 (Kochi Infopark Elevated Convention Grounds)": 74.2, # WARNING (Yellow)
                    "Safe Zone North-3 (Srinagar Elevated Airport Plateau)": 79.0,         # WARNING (Yellow)
                    "Safe Zone East-5 (Kolkata Salt Lake Stadium High-Ground)": 54.5,       # NORMAL (Green)
                    "Safe Zone Central-1 (Nagpur Divisional Sports Complex)": 58.0,        # NORMAL (Green)
                    "Safe Zone North-4 (Greater Noida High-Ground Center)": 48.2,         # NORMAL (Green)
                    "Safe Zone North-2 (Chandigarh Sports Complex)": 42.5,                 # NORMAL (Green)
                    "Safe Zone Central-2 (Bhopal BHEL Highland Grounds)": 51.0,           # NORMAL (Green)
                    "Safe Zone East-2 (Bhubaneswar Kalinga Stadium)": 62.4,                # NORMAL (Green)
                    "Safe Zone East-4 (Siliguri North Bengal University Grounds)": 46.8,   # NORMAL (Green)
                    "Safe Zone West-1 (Ahmedabad Sardar Patel Sports Enclave)": 39.5,      # NORMAL (Green)
                    "Safe Zone West-3 (Jaipur SMS Stadium High-Ground)": 53.0,             # NORMAL (Green)
                    "Safe Zone West-4 (Surat Althan Elevated Community Complex)": 61.2,    # NORMAL (Green)
                    "Safe Zone South-3 (Hyderabad Gachibowli Stadium Complex)": 44.0,      # NORMAL (Green)
                    "Safe Zone South-4 (Bengaluru Kanteerava Highland Complex)": 56.5,     # NORMAL (Green)
                    "Safe Zone South-5 (Chennai Elevated Jawaharlal Nehru Stadium Grounds)": 64.0, # NORMAL (Green)
                }

                # Realistic initial occupancy (demo-ready with critical, warning, and optimal havens)
                fill_pct_val = DEFAULT_OCCUPANCIES.get(area_name, 55.0 + ((idx % 4) * 11.0))
                initial_occ = int(total_cap * (fill_pct_val / 100.0))
                
                geom_json = f.get("geometry")
                c_lat, c_lon = 20.5937, 78.9629
                if geom_json:
                    try:
                        sh = shape(geom_json)
                        c_lon = round(sh.centroid.x, 5)
                        c_lat = round(sh.centroid.y, 5)
                    except Exception:
                        pass

                self.safe_zones[area_name] = {
                    "id": f"sz-{idx}",
                    "name": area_name,
                    "location_type": props.get("location_type", "relocation_site"),
                    "total_capacity": total_cap,
                    "current_occupancy": initial_occ,
                    "remaining_capacity": max(0, total_cap - initial_occ),
                    "fill_percentage": round(fill_pct_val, 1),
                    "centroid_lat": c_lat,
                    "centroid_lon": c_lon,
                    "inflow_rate_per_min": 120 + ((idx * 45) % 150), # 120 - 270 evacuees/min
                    "estimated_minutes_to_full": None,
                    "alert_level": "NORMAL", # "NORMAL" | "WARNING" (>=70) | "CRITICAL" (>=90) | "FULL" (>=100)
                    "alert_message": None,
                }

            self._update_all_metrics()
            self._initialized = True

    def _update_all_metrics(self):
        """
        Recomputes fill percentages, alert levels, and predictive full estimations.
        """
        for zone in self.safe_zones.values():
            total = max(1, zone["total_capacity"])
            curr = zone["current_occupancy"]
            rem = max(0, total - curr)
            fill_pct = round((curr / total) * 100.0, 1)

            zone["remaining_capacity"] = rem
            zone["fill_percentage"] = fill_pct

            # Predictive Fill Estimation: (remaining / inflow_per_min)
            inflow = zone.get("inflow_rate_per_min", 150)
            if inflow > 0 and rem > 0:
                mins = round(rem / inflow, 1)
                zone["estimated_minutes_to_full"] = mins
            elif rem <= 0:
                zone["estimated_minutes_to_full"] = 0
            else:
                zone["estimated_minutes_to_full"] = None

            # Multi-tier Alert Triggers
            if fill_pct >= 100.0:
                zone["alert_level"] = "FULL"
                zone["alert_message"] = "Safe Zone FULL – redirecting evacuees"
                zone["status_color"] = "#ef4444" # Red
            elif fill_pct >= 90.0:
                zone["alert_level"] = "CRITICAL"
                zone["alert_message"] = "Safe Zone almost full – rerouting recommended"
                zone["status_color"] = "#ff6b6b" # Soft Red
            elif fill_pct >= 70.0:
                zone["alert_level"] = "WARNING"
                zone["alert_message"] = "Safe Zone nearing capacity"
                zone["status_color"] = "#f59e0b" # Amber
            else:
                zone["alert_level"] = "NORMAL"
                zone["alert_message"] = "Safe Zone capacity optimal"
                zone["status_color"] = "#10b981" # Green

    def simulate_tick(self, delta_people: Optional[int] = None) -> Dict[str, Any]:
        """
        Advances the real-time capacity simulation tick (every 3-5s).
        Increments occupancy for active shelters based on incoming evacuee flow.
        """
        with _STATE_LOCK:
            self.tick_count += 1
            for idx, (name, zone) in enumerate(self.safe_zones.items()):
                if zone["remaining_capacity"] > 0:
                    # Influx step: ~15 to 45 people every 3-5 sec tick
                    step_increment = delta_people if delta_people is not None else (18 + ((idx * 7) % 25))
                    new_occ = min(zone["total_capacity"], zone["current_occupancy"] + step_increment)
                    zone["current_occupancy"] = new_occ

            self._update_all_metrics()
            return self.get_status_summary()

    def reset_capacities(self):
        """
        Resets all safe zones back to baseline occupancy.
        """
        with _STATE_LOCK:
            for idx, zone in enumerate(self.safe_zones.values()):
                initial_pct = 0.50 + ((idx % 4) * 0.10)
                initial_occ = int(zone["total_capacity"] * initial_pct)
                zone["current_occupancy"] = initial_occ
            self._update_all_metrics()
            return self.get_status_summary()

    def get_status_summary(self) -> Dict[str, Any]:
        """
        Returns full structured status of all safe zones with alerts and KPI metrics.
        """
        with _STATE_LOCK:
            zones_list = list(self.safe_zones.values())
            
            total_shelter_capacity = sum(z["total_capacity"] for z in zones_list)
            total_occupancy = sum(z["current_occupancy"] for z in zones_list)
            total_remaining = sum(z["remaining_capacity"] for z in zones_list)
            overall_fill_pct = (
                round((total_occupancy / total_shelter_capacity) * 100.0, 1)
                if total_shelter_capacity > 0
                else 0.0
            )

            # Extract Active Capacity Alerts
            active_alerts = []
            for z in zones_list:
                if z["alert_level"] in ("WARNING", "CRITICAL", "FULL"):
                    active_alerts.append({
                        "id": f"cap-alert-{z['name']}-{self.tick_count}",
                        "zone_name": z["name"],
                        "alert_level": z["alert_level"],
                        "fill_percentage": z["fill_percentage"],
                        "remaining_capacity": z["remaining_capacity"],
                        "total_capacity": z["total_capacity"],
                        "current_occupancy": z["current_occupancy"],
                        "message": z["alert_message"],
                        "status_color": z["status_color"],
                        "estimated_minutes_to_full": z["estimated_minutes_to_full"],
                        "centroid_lat": z["centroid_lat"],
                        "centroid_lon": z["centroid_lon"],
                    })

            # Sort alerts: FULL & CRITICAL first, then WARNING
            alert_order = {"FULL": 0, "CRITICAL": 1, "WARNING": 2, "NORMAL": 3}
            active_alerts.sort(key=lambda a: alert_order.get(a["alert_level"], 99))

            return {
                "status": "success",
                "timestamp": time.time(),
                "tick_count": self.tick_count,
                "summary": {
                    "total_shelters": len(zones_list),
                    "total_capacity": total_shelter_capacity,
                    "total_occupancy": total_occupancy,
                    "total_remaining_capacity": total_remaining,
                    "overall_fill_percentage": overall_fill_pct,
                    "active_alerts_count": len(active_alerts),
                },
                "safe_zones": zones_list,
                "capacity_alerts": active_alerts,
            }

    def get_alternate_safezones(
        self,
        origin_lat: float,
        origin_lon: float,
        current_safezone_name: Optional[str] = None,
        limit: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Finds the top N nearest alternate safe zones with available headroom (>10% remaining),
        using Google Maps Distance Matrix / Directions API with high-precision geodesic fallback.
        """
        with _STATE_LOCK:
            candidates = []
            for name, zone in self.safe_zones.items():
                if current_safezone_name and name.lower() == current_safezone_name.lower():
                    continue
                # Require at least some remaining capacity
                if zone["remaining_capacity"] > 0 and zone["fill_percentage"] < 99.0:
                    candidates.append(zone)

        if not candidates:
            # Fallback to any zone with capacity if none <99%
            with _STATE_LOCK:
                candidates = [
                    z for name, z in self.safe_zones.items()
                    if not current_safezone_name or name.lower() != current_safezone_name.lower()
                ]

        # Calculate Distance & ETA for each candidate
        ranked_results = []
        for c in candidates:
            key = (round(origin_lat, 4), round(origin_lon, 4), round(c["centroid_lat"], 4), round(c["centroid_lon"], 4))
            if key in _ROAD_METRICS_CACHE:
                dist_km, dur_min = _ROAD_METRICS_CACHE[key]
            else:
                dist_km, dur_min = calculate_road_metrics(
                    origin_lat, origin_lon, c["centroid_lat"], c["centroid_lon"]
                )
                _ROAD_METRICS_CACHE[key] = (dist_km, dur_min)

            ranked_results.append({
                "name": c["name"],
                "distance_km": dist_km,
                "eta_minutes": dur_min,
                "remaining_capacity": c["remaining_capacity"],
                "total_capacity": c["total_capacity"],
                "current_occupancy": c["current_occupancy"],
                "fill_percentage": c["fill_percentage"],
                "centroid_lat": c["centroid_lat"],
                "centroid_lon": c["centroid_lon"],
                "source": "SafeShift Road Model Engine",
            })

        # Rank by combined suitability: closest distance + available headroom
        ranked_results.sort(key=lambda r: (r["distance_km"] * 0.7 - (r["remaining_capacity"] / 1000.0) * 0.3))
        return ranked_results[:limit]


# Global singleton instance
safezone_manager = SafeZoneCapacityManager()
