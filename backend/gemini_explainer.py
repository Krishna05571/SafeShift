import os
import json
import time
import requests
from typing import List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
]

# Fast in-memory cache for instant (<1ms) briefing responses
_briefing_cache: Dict[str, Any] = {}
_briefing_cache_ttl = 300  # 5 minutes

def explain_relocation_plan(relocation_plan: List[Dict[str, Any]], mode: str = "baseline") -> Dict[str, Any]:
    """
    Uses Google Gemini AI to analyze the relocation plan and generate
    human-readable disaster response explanations, priority justifications,
    and actionable recommendations for emergency officials.
    Dynamically tailors output based on 'baseline' (historical) vs 'live' (meteorological) risk modes.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_live_mode = str(mode).lower() == "live"

    if not relocation_plan:
        return {
            "summary": "No active evacuation routes found in the current relocation plan.",
            "mode": mode,
            "critical_zones": [],
            "recommendations": [
                "Verify multi-hazard GIS sensor layers.",
                "Ensure safe shelter capacities are populated in the database."
            ]
        }

    total_people = sum(item.get("people", 0) for item in relocation_plan)
    high_risk_count = sum(1 for item in relocation_plan if item.get("risk") == "high")
    top_routes = relocation_plan[:10]

    cache_key = f"{mode}_{total_people}_{high_risk_count}"
    now = time.time()
    if cache_key in _briefing_cache:
        entry = _briefing_cache[cache_key]
        if now - entry["timestamp"] < _briefing_cache_ttl:
            return entry["data"]

    mode_description = (
        "LIVE REAL-TIME METEOROLOGICAL DISASTER SCENARIO (Driven by Open-Meteo live rainfall, IMD Red/Orange storm alerts, and active slope saturation)"
        if is_live_mode
        else "BASELINE STRUCTURAL & HISTORICAL VULNERABILITY SCENARIO (Driven by permanent terrain slope, river catchment geography, and historical vulnerability metrics)"
    )

    prompt = f"""You are a disaster response expert with the National Disaster Management Authority (NDMA).
Explain this emergency evacuation and relocation plan in crisp, professional terms for disaster response commanders.

Evaluation Mode: {mode_description}

Disaster Overview:
- Evaluation Mode: {'Live Weather Telemetry' if is_live_mode else 'Baseline Vulnerability'}
- Total Dispatched Evacuees: {total_people:,}
- High-Risk Zones Requiring Immediate Evacuation: {high_risk_count}
- Top Evacuation Corridors:
{json.dumps(top_routes, indent=2)}

STRICT REQUIREMENT: Do NOT include any emojis anywhere in your JSON response. Use clean, formal, professional language only.

Provide a structured, highly actionable briefing.
You MUST reply with ONLY valid JSON matching this exact schema:
{{
  "summary": "Concise executive briefing focusing specifically on {'live storm and precipitation surges triggering immediate relocation' if is_live_mode else 'baseline multi-hazard terrain exposure and structural triage'}",
  "mode": "{'live' if is_live_mode else 'baseline'}",
  "critical_zones": [
    {{
      "zone_name": "Name of hazard area",
      "risk_level": "HIGH / MEDIUM / LOW",
      "priority_reason": "Specific justification ({'e.g. IMD heavy rainfall surge, sudden slope saturation' if is_live_mode else 'e.g. baseline low-lying flood basin, steep slope vulnerability'})",
      "assigned_shelter": "Destination safe shelter name",
      "evacuees": 12000,
      "estimated_travel_time": "Estimated transit duration e.g. 45 mins"
    }}
  ],
  "recommendations": [
    "Actionable operational instruction for field teams",
    "Actionable operational instruction for transport convoys",
    "Actionable operational instruction for safe haven shelter intake"
  ]
}}"""

    # Fast check: Valid Google AI Studio keys begin with 'AIzaSy'
    is_valid_google_key = bool(api_key and (api_key.startswith("AIzaSy") or len(api_key) >= 35 and not api_key.startswith("your_") and not api_key.startswith("AQ.")))

    if is_valid_google_key:
        for model in GEMINI_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "response_mime_type": "application/json",
                        "temperature": 0.2,
                    }
                }

                response = requests.post(url, json=payload, headers=headers, timeout=1.8)

                if response.status_code == 200:
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0]["content"]["parts"][0]["text"]
                        parsed = json.loads(raw_text)
                        
                        if "summary" in parsed and "critical_zones" in parsed and "recommendations" in parsed:
                            parsed["ai_engine"] = f"Google Gemini ({model})"
                            parsed["mode"] = "live" if is_live_mode else "baseline"
                            parsed["total_people"] = total_people
                            parsed["high_risk_count"] = high_risk_count
                            parsed["total_routes"] = len(relocation_plan)
                            _briefing_cache[cache_key] = {"timestamp": now, "data": parsed}
                            return parsed
                elif response.status_code in (400, 401, 403, 404):
                    # Key is invalid or permission denied; break immediately instead of wasting time
                    break
            except Exception:
                break

    # Instantaneous deterministic expert decision engine fallback (<5ms)
    fallback_res = _generate_expert_fallback(relocation_plan, total_people, high_risk_count, is_live_mode)
    fallback_res["total_people"] = total_people
    fallback_res["high_risk_count"] = high_risk_count
    fallback_res["total_routes"] = len(relocation_plan)
    _briefing_cache[cache_key] = {"timestamp": now, "data": fallback_res}
    return fallback_res

def _generate_expert_fallback(
    relocation_plan: List[Dict[str, Any]],
    total_people: int,
    high_risk_count: int,
    is_live_mode: bool = False
) -> Dict[str, Any]:
    """
    Deterministic rule-based expert briefing fallback tailored for baseline vs live modes,
    accurately reflecting High, Medium, and Low risk operational statuses.
    """
    critical_zones = []
    for item in relocation_plan[:6]:
        risk = (item.get("risk") or "low").upper()
        hazard = item.get("hazard_type", "hazard")
        people = item.get("people", 0)
        dist = item.get("distance_km", 0)
        time_min = item.get("travel_time_min", 0)
        priority_score = item.get("priority_score", 0)
        
        time_str = f"{time_min} mins" if time_min else (f"{round(dist/50.0, 1)} hrs" if dist else "Immediate local transit")

        if is_live_mode:
            if risk == "HIGH":
                reason = (
                    f"Live meteorological telemetry escalated this zone to HIGH risk ({hazard.capitalize()}) "
                    f"due to severe precipitation exceeding IMD disaster thresholds. Critical priority score {priority_score:,} mandates immediate emergency convoy routing."
                )
            elif risk == "MEDIUM":
                reason = (
                    f"Zone is at MEDIUM risk ({hazard.capitalize()}) with heightened rainfall and soil moisture. "
                    f"Precautionary watch active with {people:,} residents triaged for standby evacuation readiness."
                )
            else:
                reason = (
                    f"Zone is currently at LOW risk ({hazard.capitalize()}) with normal precipitation. "
                    f"Routine monitoring active; no immediate evacuation required. Evacuation corridor to {item.get('to', 'Safe Shelter')} remains pre-allocated for contingency."
                )
        else:
            if risk == "HIGH":
                reason = (
                    f"Historical baseline vulnerability index designates this zone as HIGH risk ({hazard.capitalize()}) "
                    f"due to low-lying elevation and high exposure, requiring prioritized emergency clearance."
                )
            elif risk == "MEDIUM":
                reason = (
                    f"Historical baseline vulnerability index designates this zone as MEDIUM risk ({hazard.capitalize()}). "
                    f"{people:,} residents are pre-mapped for secondary evacuation staging."
                )
            else:
                reason = (
                    f"Historical baseline vulnerability index designates this zone as LOW risk ({hazard.capitalize()}). "
                    f"Standard monitoring active with contingency safe shelter routing mapped."
                )

        critical_zones.append({
            "zone_name": item.get("from", "Hazard Zone"),
            "risk_level": risk,
            "priority_reason": reason,
            "assigned_shelter": item.get("to", "Safe Shelter"),
            "evacuees": people,
            "estimated_travel_time": time_str
        })

    if is_live_mode:
        if high_risk_count > 0:
            summary = (
                f"LIVE WEATHER DISASTER BRIEFING: SafeShift Real-Time Intelligence has identified {high_risk_count} critical zones requiring immediate emergency evacuation "
                f"due to active rainfall exceeding IMD disaster thresholds. {total_people:,} citizens across {len(relocation_plan)} corridors are prioritized for safe haven dispatch."
            )
            recommendations = [
                "Deploy immediate NDRF/SDRF evacuation convoys to active High-Risk zones before road inundation worsens.",
                "Monitor live Open-Meteo precipitation feeds for rainfall exceeding IMD Red Alert (115.6mm) thresholds.",
                "Enforce green corridors along national highways to ensure convoy travel times stay within estimated windows.",
                "Alert receiving safe havens to prepare medical triage, drinking water, and high-protein ration reserves."
            ]
        else:
            summary = (
                f"LIVE WEATHER DISASTER BRIEFING: SafeShift Real-Time Intelligence indicates all monitored sectors are currently within manageable thresholds with 0 active High-Risk emergencies. "
                f"Routine meteorological monitoring and standby shelter allocations remain active for {total_people:,} residents across {len(relocation_plan)} pre-mapped corridors."
            )
            recommendations = [
                "Maintain continuous meteorological telemetry monitoring across low-lying floodplains and steep mountain slopes.",
                "Keep designated emergency transport convoys and safe shelter intake personnel on standby readiness.",
                "Verify drainage channel clearances and slope telemetry before precipitation intensifies.",
                "Ensure emergency communication relays between district emergency operating centers (DEOC) remain active."
            ]
    else:
        summary = (
            f"BASELINE VULNERABILITY BRIEFING: SafeShift Strategic Planning has synthesized a demographic relocation baseline for {total_people:,} residents "
            f"across {len(relocation_plan)} pre-mapped corridors. {high_risk_count} historically vulnerable sectors are triaged for priority safe haven allocation "
            f"based on topographical risk exposure and nearest road distances."
        )
        recommendations = [
            "Pre-position disaster response vehicles and emergency shelters in proximity to high-vulnerability sectors.",
            "Review structural flood defenses and slope reinforcement assets across baseline high-risk corridors.",
            "Verify safe haven bed capacity readiness (maintaining >10% emergency reserve headroom).",
            "Switch to 'Live Weather Mode' to incorporate real-time precipitation and dynamic risk surges."
        ]

    return {
        "summary": summary,
        "mode": "live" if is_live_mode else "baseline",
        "critical_zones": critical_zones,
        "recommendations": recommendations,
        "ai_engine": "SafeShift Expert Decision Engine (Rule-Based Fallback)"
    }
