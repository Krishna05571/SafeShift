import sys
import copy
import math
import time
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from shapely.geometry import shape, mapping

# Ensure local backend directory is on sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from relocation import generate_relocation_plan
    from weather_service import get_live_zones_with_weather, _generate_fallback_weather
    from safezone_service import safezone_manager
    from routing import get_detailed_route_geometry, calculate_road_metrics
except ImportError:
    try:
        from .relocation import generate_relocation_plan
        from .weather_service import get_live_zones_with_weather, _generate_fallback_weather
        from .safezone_service import safezone_manager
        from .routing import get_detailed_route_geometry, calculate_road_metrics
    except Exception as e:
        print(f"Simulation import warning: {e}")


def get_risk_gradient_color(hazard_type: str, severity_score: float) -> str:
    """
    Computes smooth dynamic color gradient for risk expansion:
    0.0 -> #10b981 (Green)
    0.3 -> #eab308 (Yellow)
    0.6 -> #f97316 (Orange)
    0.85 -> #ef4444 (Red)
    1.0+ -> #7c3aed (Severe Purple)
    """
    if severity_score <= 0.25:
        return "#10b981"  # Emerald Green
    elif severity_score <= 0.50:
        return "#eab308"  # Amber Yellow
    elif severity_score <= 0.75:
        return "#f97316"  # Sunset Orange
    elif severity_score <= 0.90:
        return "#ef4444"  # Alert Red
    else:
        return "#7c3aed"  # Extreme Disaster Violet


def dilate_polygon_geometry(geom_dict: Dict[str, Any], expansion_factor: float) -> Dict[str, Any]:
    """
    Dynamically expands/buffers a GeoJSON polygon based on flood water spread.
    Uses Shapely geodesic buffer approximation in meters converted to degrees.
    """
    if not geom_dict or expansion_factor <= 1.001:
        return geom_dict

    try:
        poly_shape = shape(geom_dict)
        if poly_shape.is_empty or not poly_shape.is_valid:
            return geom_dict

        # expansion_factor 1.0 to 1.6 maps to buffer of ~0.005 to ~0.04 degrees (~0.5km to 4km spread)
        buffer_degrees = (expansion_factor - 1.0) * 0.05
        buffered_shape = poly_shape.buffer(buffer_degrees)
        if buffered_shape.is_empty or not buffered_shape.is_valid:
            return geom_dict

        return mapping(buffered_shape)
    except Exception as e:
        return geom_dict


def project_disaster_scenario(
    base_geo_data: Dict[str, Any],
    forecast_minutes: int = 0,
    force_weather_refresh: bool = False
) -> Dict[str, Any]:
    r"""
    Scenario Intelligence Engine:
    - Integrates real-time weather inputs (rainfall, humidity, temperature, weather conditions).
    - Simulates continuous 0–60 minutes disaster progression timeline ($t \in [0, 60]$).
    - Models physical flood spread (polygon dilation & depth accumulation) based on rainfall thresholds:
        - >50mm: Moderate spread
        - >80mm: Severe inundation
        - >120mm: Flash flood cresting
    - Models dynamic landslide slope failure probability:
        - >50%: Elevated slope hazard
        - >75%: Critical failure warning
        - >90%: Imminent mountain debris flow
    - Predicts safe zone occupancy growth curves over time:
        - Computes estimated time to full capacity (ETA to 100%).
        - Triggers alerts at 30% remaining (70% load) and 10% remaining (90% critical).
    - Multi-zone impact & automated spillover evacuation:
        - When a safe haven reaches >=90% capacity, excess population is dynamically
          rerouted to the top 2 alternative nearest candidate safe havens.
    - Returns structured projections:
        - Updated GeoJSON with expanded hazard polygons & gradient colors.
        - Relocation plan with spillover routes and adjustments.
        - Safe zone load forecast table (0m, 15m, 30m, 45m, 60m).
        - Predictive threshold alerts and emergency directives.
    """
    t_min = max(0, min(int(forecast_minutes), 60))
    t_norm = t_min / 60.0  # normalized timeline factor 0.0 -> 1.0

    # 1. Fetch live meteorological synchronized dataset
    live_geo_data, impact_summary = get_live_zones_with_weather(base_geo_data, force_refresh=force_weather_refresh)

    # 2. Deep copy GeoJSON for simulation modifications
    simulated_geo = copy.deepcopy(live_geo_data)
    features = simulated_geo.get("features", [])

    # Metrics collectors
    total_affected_population = 0
    high_risk_count = 0
    medium_risk_count = 0
    low_risk_count = 0
    total_flooded_expansion_sqkm = 0.0
    critical_landslide_zones = 0
    predictive_alerts: List[Dict[str, Any]] = []

    # Ensure safe zone capacity manager is initialized
    if not safezone_manager.safe_zones:
        safezone_manager.initialize_from_geojson(base_geo_data)

    # Map of safe zone initial loads from SafeZoneManager
    shelter_loads: Dict[str, Dict[str, Any]] = {}
    for name, sz in safezone_manager.safe_zones.items():
        shelter_loads[name] = {
            "name": name,
            "total_capacity": sz["total_capacity"],
            "base_occupancy": sz["current_occupancy"],
            "projected_occupancy": sz["current_occupancy"],
            "incoming_evacuees": 0,
            "inflow_rate_per_min": sz.get("inflow_rate_per_min", 150),
            "centroid_lat": sz["centroid_lat"],
            "centroid_lon": sz["centroid_lon"],
            "fill_percentage": sz["fill_percentage"],
            "estimated_minutes_to_full": None,
            "alert_level": "NORMAL",
            "spillover_displaced": 0,
        }

    # 3. Process Hazard Zones over continuous forecast timeline t_min
    for feat in features:
        props = feat.get("properties", {})
        is_safe = props.get("safe") is True or props.get("location_type") == "relocation_site"

        if is_safe:
            continue

        hazard_type = str(props.get("hazard_type", "flood")).lower()
        base_pop = int(props.get("population", 0))
        rainfall = float(props.get("rainfall", 30.0))
        humidity = int(props.get("humidity", 70))
        base_risk = str(props.get("baseline_risk", props.get("risk", "low"))).lower()
        area_name = props.get("area_name", "Hazard Zone")

        # --- A. Dynamic Flood Spread Simulation ---
        if hazard_type == "flood":
            # Rainfall factor: 0-50mm -> 1.0x, 50-80mm -> 1.25x, 80-120mm -> 1.55x, >120mm -> 1.85x
            rain_factor = max(1.0, 1.0 + (rainfall / 110.0))
            # Flood expansion grows continuously with elapsed minutes
            expansion_factor = round(1.0 + (rain_factor - 1.0) * (0.15 + 0.85 * t_norm), 3)
            flood_depth_m = round(0.4 + (rainfall / 45.0) * (0.2 + 0.8 * t_norm), 2)

            # Severity score [0.0 - 1.0]
            severity_score = min(1.0, (rainfall / 140.0) * 0.6 + t_norm * 0.4)

            # Population surge due to expanding inundation perimeter
            sim_pop = int(base_pop * (1.0 + (expansion_factor - 1.0) * 0.75))

            # Risk escalation threshold
            if rainfall >= 80.0 or (rainfall >= 50.0 and t_min >= 25) or t_min >= 45:
                curr_risk = "high"
                priority = "immediate"
            elif rainfall >= 40.0 or t_min >= 15:
                curr_risk = "medium"
                priority = "short-term"
            else:
                curr_risk = base_risk
                priority = "monitoring"

            # Apply geometry dilation
            geom_json = feat.get("geometry")
            if geom_json and expansion_factor > 1.01:
                feat["geometry"] = dilate_polygon_geometry(geom_json, expansion_factor)

            props["flood_expansion_factor"] = expansion_factor
            props["flood_depth_m"] = flood_depth_m
            props["gradient_color"] = get_risk_gradient_color("flood", severity_score)
            props["projected_spread_pct"] = round((expansion_factor - 1.0) * 100.0, 1)

            if rainfall >= 90.0 and t_min >= 30:
                predictive_alerts.append({
                    "id": f"flood-alert-{area_name}",
                    "type": "FLOOD_EXPANSION",
                    "severity": "CRITICAL",
                    "zone": area_name,
                    "title": f"Flash Inundation Cresting in {area_name}",
                    "message": f"Flood perimeter expanded by +{props['projected_spread_pct']}% with {flood_depth_m}m depth. Immediate evacuation active.",
                    "time_horizon": f"+{t_min} min",
                    "color": "#ef4444",
                })

        # --- B. Dynamic Landslide Probability Model ---
        elif hazard_type == "landslide":
            # Landslide probability curve based on soil saturation & rain threshold
            base_prob = 0.25 if base_risk == "low" else (0.50 if base_risk == "medium" else 0.70)
            saturation_rate = (humidity / 100.0) * (rainfall / 80.0)
            landslide_prob = min(0.98, round(base_prob + saturation_rate * 0.35 * t_norm, 2))

            # Severity score
            severity_score = min(1.0, landslide_prob)

            # Population displacement surges as hillside danger expands
            expansion_factor = round(1.0 + (landslide_prob * 0.45 * t_norm), 3)
            sim_pop = int(base_pop * (1.0 + (expansion_factor - 1.0) * 0.60))

            if landslide_prob >= 0.70 or (rainfall >= 70.0 and t_min >= 20):
                curr_risk = "high"
                priority = "immediate"
                critical_landslide_zones += 1
            elif landslide_prob >= 0.45 or (rainfall >= 40.0 and t_min >= 15):
                curr_risk = "medium"
                priority = "short-term"
            else:
                curr_risk = base_risk
                priority = "monitoring"

            props["landslide_probability"] = landslide_prob
            props["gradient_color"] = get_risk_gradient_color("landslide", severity_score)
            props["projected_spread_pct"] = round((expansion_factor - 1.0) * 100.0, 1)

            if landslide_prob >= 0.75 and t_min >= 15:
                predictive_alerts.append({
                    "id": f"landslide-alert-{area_name}",
                    "type": "LANDSLIDE_WARNING",
                    "severity": "CRITICAL",
                    "zone": area_name,
                    "title": f"High Landslide Probability ({int(landslide_prob*100)}%) in {area_name}",
                    "message": f"Slope saturation reached critical threshold ({rainfall}mm rain). Mountain debris risk severe.",
                    "time_horizon": f"+{t_min} min",
                    "color": "#f97316",
                })

        else:
            # Generic / Cyclone / Storm surge
            severity_score = min(1.0, (rainfall / 100.0) * 0.5 + t_norm * 0.5)
            curr_risk = "high" if t_min >= 30 else ("medium" if t_min >= 15 else base_risk)
            priority = "immediate" if curr_risk == "high" else ("short-term" if curr_risk == "medium" else "monitoring")
            sim_pop = int(base_pop * (1.0 + 0.4 * t_norm))
            props["gradient_color"] = get_risk_gradient_color(hazard_type, severity_score)

        # Update zone properties
        props["risk"] = curr_risk
        props["priority"] = priority
        props["population"] = sim_pop
        props["risk_score"] = 3 if curr_risk == "high" else (2 if curr_risk == "medium" else 1)
        props["priority_score"] = props["risk_score"] * sim_pop
        props["scenario_time_minutes"] = t_min

        feat["properties"] = props

        # Accumulate metrics
        total_affected_population += sim_pop
        if curr_risk == "high":
            high_risk_count += 1
        elif curr_risk == "medium":
            medium_risk_count += 1
        else:
            low_risk_count += 1

    # 4. Generate dynamic relocation plan for the projected disaster state
    base_relocation_plan = generate_relocation_plan(simulated_geo)

    # 5. Predict Safe Zone Occupancy Growth & ETA to Full Saturation
    for plan_item in base_relocation_plan:
        dest_name = plan_item.get("to")
        evacuees = int(plan_item.get("people", 0))
        if dest_name in shelter_loads:
            shelter_loads[dest_name]["incoming_evacuees"] += evacuees

    # Compute continuous occupancy at time t_min
    for name, s_data in shelter_loads.items():
        total_cap = max(1, s_data["total_capacity"])
        base_occ = s_data["base_occupancy"]
        inflow = s_data["incoming_evacuees"]
        inflow_per_min = s_data["inflow_rate_per_min"]

        # Dynamic evacuee influx: arrivals scale over the 60 minute window
        arrival_progress = min(1.0, (t_min / 60.0) * 1.2)
        projected_occ = min(total_cap, int(base_occ + (inflow * 0.55 * arrival_progress) + (inflow_per_min * (t_min / 60.0) * 12)))
        remaining_cap = max(0, total_cap - projected_occ)
        fill_pct = round((projected_occ / total_cap) * 100.0, 1)

        s_data["projected_occupancy"] = projected_occ
        s_data["remaining_capacity"] = remaining_cap
        s_data["fill_percentage"] = fill_pct

        # Estimated minutes to 100% capacity
        if remaining_cap > 0 and inflow_per_min > 0:
            s_data["estimated_minutes_to_full"] = round(remaining_cap / inflow_per_min, 1)
        elif remaining_cap == 0:
            s_data["estimated_minutes_to_full"] = 0
        else:
            s_data["estimated_minutes_to_full"] = None

        # Multi-tier Alert Triggers: 30% remaining (70% load) & 10% remaining (90% load)
        if fill_pct >= 100.0:
            s_data["alert_level"] = "FULL"
            predictive_alerts.append({
                "id": f"shelter-full-{name}",
                "type": "CAPACITY_FULL",
                "severity": "CRITICAL",
                "zone": name,
                "title": f"Safe Zone {name} at 100% Full Capacity",
                "message": f"Shelter is fully saturated ({projected_occ}/{total_cap} beds). Spillover diversion activated.",
                "time_horizon": f"At T+{t_min}m",
                "color": "#ef4444",
            })
        elif fill_pct >= 90.0: # 10% remaining capacity
            s_data["alert_level"] = "CRITICAL"
            mins_left = s_data["estimated_minutes_to_full"] or 5
            predictive_alerts.append({
                "id": f"shelter-crit-{name}",
                "type": "CAPACITY_10PCT_REMAINING",
                "severity": "CRITICAL",
                "zone": name,
                "title": f"⚠️ {name} has only 10% Capacity Remaining ({fill_pct}%)",
                "message": f"Projected to reach saturation in ~{mins_left} min. Automated spillover rerouting recommended.",
                "time_horizon": f"In ~{mins_left} min",
                "color": "#ff6b6b",
            })
        elif fill_pct >= 70.0: # 30% remaining capacity
            s_data["alert_level"] = "WARNING"
            mins_left = s_data["estimated_minutes_to_full"] or 15
            predictive_alerts.append({
                "id": f"shelter-warn-{name}",
                "type": "CAPACITY_30PCT_REMAINING",
                "severity": "WARNING",
                "zone": name,
                "title": f"📢 {name} Reached 30% Remaining Capacity ({fill_pct}%)",
                "message": f"Inflow rate elevated. Estimated {mins_left} minutes until full.",
                "time_horizon": f"In ~{mins_left} min",
                "color": "#f59e0b",
            })
        else:
            s_data["alert_level"] = "NORMAL"

    # 6. Multi-Zone Spillover Evacuation Modeling & Evacuation Adjustments
    # For safe zones that reach >=90% capacity, compute automated spillover to top 2 nearest alternates
    spillover_adjustments: List[Dict[str, Any]] = []
    updated_relocation_plan: List[Dict[str, Any]] = []

    for plan_item in base_relocation_plan:
        dest_name = plan_item.get("to")
        shelter_info = shelter_loads.get(dest_name, {})
        orig_lat = plan_item.get("origin_coords", [20.59, 78.96])[0]
        orig_lon = plan_item.get("origin_coords", [20.59, 78.96])[1]

        # Check if destination shelter is in critical / full saturation (>=90% fill)
        if shelter_info.get("fill_percentage", 0) >= 90.0:
            # Query top 2 nearest candidate shelters with available headroom (<90% fill)
            alternates = safezone_manager.get_alternate_safezones(
                origin_lat=orig_lat,
                origin_lon=orig_lon,
                current_safezone_name=dest_name,
                limit=2
            )

            if alternates:
                alt_primary = alternates[0]
                alt_secondary = alternates[1] if len(alternates) > 1 else None

                # Create adjusted relocation plan entry
                plan_copy = copy.deepcopy(plan_item)
                plan_copy["spillover_active"] = True
                plan_copy["original_dest"] = dest_name
                plan_copy["effectiveDest"] = alt_primary["name"]
                plan_copy["effectiveDestCoords"] = [alt_primary["centroid_lat"], alt_primary["centroid_lon"]]
                plan_copy["travel_time_min"] = alt_primary.get("eta_minutes", plan_item.get("travel_time_min", 45))
                plan_copy["distance_km"] = alt_primary.get("distance_km", plan_item.get("distance_km", 20))
                plan_copy["spillover_note"] = f"Rerouted from {dest_name} ({shelter_info.get('fill_percentage')}% full) -> {alt_primary['name']}"
                updated_relocation_plan.append(plan_copy)

                spillover_adjustments.append({
                    "hazard_origin": plan_item.get("from"),
                    "overloaded_shelter": dest_name,
                    "overloaded_fill_pct": shelter_info.get("fill_percentage"),
                    "displaced_people": plan_item.get("people", 0),
                    "recommended_primary_alt": {
                        "name": alt_primary["name"],
                        "distance_km": alt_primary["distance_km"],
                        "travel_time_min": alt_primary["eta_minutes"],
                        "remaining_capacity": alt_primary["remaining_capacity"],
                        "fill_pct": alt_primary["fill_percentage"],
                        "coords": [alt_primary["centroid_lat"], alt_primary["centroid_lon"]],
                    },
                    "recommended_secondary_alt": {
                        "name": alt_secondary["name"],
                        "distance_km": alt_secondary["distance_km"],
                        "travel_time_min": alt_secondary["eta_minutes"],
                        "remaining_capacity": alt_secondary["remaining_capacity"],
                        "fill_pct": alt_secondary["fill_percentage"],
                        "coords": [alt_secondary["centroid_lat"], alt_secondary["centroid_lon"]],
                    } if alt_secondary else None
                })
            else:
                updated_relocation_plan.append(plan_item)
        else:
            updated_relocation_plan.append(plan_item)

    # 7. Generate Multi-Step Shelter Load Forecast Table (0m, 15m, 30m, 45m, 60m)
    forecast_timeline_steps = [0, 15, 30, 45, 60]
    shelter_load_forecast: List[Dict[str, Any]] = []

    for name, s_data in shelter_loads.items():
        step_occupancies = {}
        for m in forecast_timeline_steps:
            m_norm = m / 60.0
            occ = min(
                s_data["total_capacity"],
                int(s_data["base_occupancy"] + (s_data["incoming_evacuees"] * 0.55 * m_norm) + (s_data["inflow_rate_per_min"] * (m / 60.0) * 12))
            )
            step_occupancies[f"t_{m}m"] = {
                "occupancy": occ,
                "fill_pct": round((occ / s_data["total_capacity"]) * 100.0, 1),
                "remaining": max(0, s_data["total_capacity"] - occ),
            }

        shelter_load_forecast.append({
            "name": name,
            "total_capacity": s_data["total_capacity"],
            "base_occupancy": s_data["base_occupancy"],
            "current_projected_occupancy": s_data["projected_occupancy"],
            "fill_percentage": s_data["fill_percentage"],
            "remaining_capacity": s_data["remaining_capacity"],
            "estimated_minutes_to_full": s_data["estimated_minutes_to_full"],
            "alert_level": s_data["alert_level"],
            "timeline_projections": step_occupancies,
            "centroid_lat": s_data["centroid_lat"],
            "centroid_lon": s_data["centroid_lon"],
        })

    # Sort shelter forecast: most critical first
    shelter_load_forecast.sort(key=lambda s: s["fill_percentage"], reverse=True)

    # Calculate overall total relocated evacuees
    total_relocated = sum(item.get("people", 0) for item in updated_relocation_plan)

    return {
        "scenario_engine_version": "3.0.0",
        "forecast_minutes": t_min,
        "timeline_label": f"T+{t_min} Minutes Forecast",
        "weather_context": {
            "monitored_zones": len(impact_summary),
            "average_rainfall_mm": round(sum(z.get("rainfall_mm", 0) for z in impact_summary) / max(1, len(impact_summary)), 1),
            "live_sync": True,
        },
        "metrics": {
            "forecast_minutes": t_min,
            "total_affected_population": total_affected_population,
            "high_risk_zones_count": high_risk_count,
            "medium_risk_zones_count": medium_risk_count,
            "low_risk_zones_count": low_risk_count,
            "total_relocated_people": total_relocated,
            "active_routes_count": len(updated_relocation_plan),
            "critical_landslide_zones": critical_landslide_zones,
            "active_spillover_redirections": len(spillover_adjustments),
            "shelters_at_capacity": sum(1 for s in shelter_loads.values() if s["fill_percentage"] >= 90.0),
        },
        "predictive_alerts": predictive_alerts,
        "spillover_adjustments": spillover_adjustments,
        "shelter_load_forecast": shelter_load_forecast,
        "geo_data": simulated_geo,
        "relocation_plan": updated_relocation_plan,
    }


def simulate_disaster_state(base_geo_data: Dict[str, Any], time_step: int = 0) -> Dict[str, Any]:
    """
    Backward-compatible wrapper mapping discrete time_steps (0, 1, 2, 3) or raw minutes (0-60)
    to the continuous Scenario Intelligence Engine.
    """
    # If time_step <= 3, map 0->0m, 1->15m, 2->35m, 3->60m
    if time_step <= 3:
        step_to_minutes = {0: 0, 1: 15, 2: 35, 3: 60}
        minutes = step_to_minutes.get(time_step, 0)
    else:
        minutes = min(60, max(0, time_step))

    result = project_disaster_scenario(base_geo_data, forecast_minutes=minutes)
    # Add backward compatible time_step property
    result["time_step"] = time_step
    return result

