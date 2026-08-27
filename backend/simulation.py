import copy
from typing import Dict, Any, Tuple
from pathlib import Path
import json

try:
    from relocation import generate_relocation_plan
except ImportError:
    from .relocation import generate_relocation_plan

SIMULATION_PHASES = {
    0: {
        "title": "Normal State (Baseline Monitoring)",
        "phase_tag": "T=0: Baseline",
        "description": "Normal seasonal conditions with baseline population and standard hazard boundaries.",
        "alert_level": "LOW",
    },
    1: {
        "title": "Phase 1: Medium Risk Expands (Monsoonal Inundation)",
        "phase_tag": "T=1: Moderate Surge",
        "description": "Heavy rainfall causes riverbanks to swell and slope saturation. Low-risk zones escalate to Medium Risk, displacing +35% more residents.",
        "alert_level": "WARNING",
    },
    2: {
        "title": "Phase 2: High Risk Spreads (Severe Multi-Hazard Outbreak)",
        "phase_tag": "T=2: Critical Escalation",
        "description": "Flash floods, dam overflows, and hillside debris flows spread rapidly. Medium-risk zones escalate to High Risk with immediate evacuation mandated.",
        "alert_level": "CRITICAL",
    },
    3: {
        "title": "Phase 3: Peak Emergency (Catastrophic Multi-Zone Overflow)",
        "phase_tag": "T=3: Peak Outbreak",
        "description": "Maximum disaster severity. Widespread simultaneous inundation and landslides trigger multi-shelter capacity splitting across interstate safe havens.",
        "alert_level": "CATASTROPHIC",
    }
}

def simulate_disaster_state(base_geo_data: Dict[str, Any], time_step: int = 0) -> Dict[str, Any]:
    """
    Simulates disaster progression over time (t=0, t=1, t=2, t=3):
    - Dynamically escalates zone risk (Low -> Medium -> High)
    - Modifies affected population over time (flood/landslide displacement surge)
    - Triggers live reallocation across safe shelters
    """
    t = max(0, min(int(time_step), 3))
    phase_info = SIMULATION_PHASES.get(t, SIMULATION_PHASES[0])

    # Deep copy the GeoJSON to avoid mutating the original dataset
    simulated_geo_data = copy.deepcopy(base_geo_data)
    features = simulated_geo_data.get("features", [])

    for f in features:
        props = f.get("properties", {})
        is_safe = props.get("safe") is True or props.get("location_type") == "relocation_site"

        if is_safe:
            # Safe zones maintain or expand emergency contingency capacity slightly in peak emergencies
            continue

        orig_risk = str(props.get("risk", "low")).lower()
        orig_pop = int(props.get("population", 0))

        if t == 0:
            # Baseline unchanged
            pass

        elif t == 1:
            # Medium risk expands
            if orig_risk == "low":
                props["risk"] = "medium"
                props["priority"] = "short-term"
                props["population"] = int(orig_pop * 1.35)
            elif orig_risk == "medium":
                props["population"] = int(orig_pop * 1.30)
                props["priority"] = "short-term"
            elif orig_risk == "high":
                props["population"] = int(orig_pop * 1.25)
                props["priority"] = "immediate"

        elif t == 2:
            # High risk spreads across regions
            if orig_risk == "low":
                props["risk"] = "medium"
                props["priority"] = "short-term"
                props["population"] = int(orig_pop * 1.50)
            elif orig_risk == "medium":
                props["risk"] = "high"
                props["priority"] = "immediate"
                props["population"] = int(orig_pop * 1.65)
            elif orig_risk == "high":
                props["population"] = int(orig_pop * 1.60)
                props["priority"] = "immediate"

        elif t == 3:
            # Peak Emergency: All hazard zones become High Risk with massive surge
            props["risk"] = "high"
            props["priority"] = "immediate"
            props["population"] = int(orig_pop * 1.95)

    # Recompute relocation plan live with the updated disaster dynamics
    new_relocation_plan = generate_relocation_plan(simulated_geo_data)

    # Calculate summary simulation metrics
    total_pop = 0
    high_count = 0
    medium_count = 0
    low_count = 0

    for f in features:
        p = f.get("properties", {})
        if not (p.get("safe") is True or p.get("location_type") == "relocation_site"):
            r = str(p.get("risk", "low")).lower()
            pop = int(p.get("population", 0))
            total_pop += pop
            if r == "high":
                high_count += 1
            elif r == "medium":
                medium_count += 1
            elif r == "low":
                low_count += 1

    total_relocated = sum(item.get("people", 0) for item in new_relocation_plan)

    return {
        "time_step": t,
        "phase_tag": phase_info["phase_tag"],
        "title": phase_info["title"],
        "alert_level": phase_info["alert_level"],
        "description": phase_info["description"],
        "metrics": {
            "total_affected_population": total_pop,
            "high_risk_zones_count": high_count,
            "medium_risk_zones_count": medium_count,
            "low_risk_zones_count": low_count,
            "total_relocated_people": total_relocated,
            "active_routes_count": len(new_relocation_plan)
        },
        "geo_data": simulated_geo_data,
        "relocation_plan": new_relocation_plan
    }
