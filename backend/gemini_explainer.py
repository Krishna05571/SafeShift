import os
import json
import requests
from typing import List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-flash",
]

def explain_relocation_plan(relocation_plan: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Uses Google Gemini AI to analyze the relocation plan and generate
    human-readable disaster response explanations, priority justifications,
    and actionable recommendations for emergency officials.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not relocation_plan:
        return {
            "summary": "No active evacuation routes found in the current relocation plan.",
            "critical_zones": [],
            "recommendations": [
                "Verify multi-hazard GIS sensor layers.",
                "Ensure safe shelter capacities are populated in the database."
            ]
        }

    total_people = sum(item.get("people", 0) for item in relocation_plan)
    high_risk_count = sum(1 for item in relocation_plan if item.get("risk") == "high")
    top_routes = relocation_plan[:10]

    prompt = f"""You are a disaster response expert. Explain this relocation plan in simple terms for emergency officials.

Disaster Overview:
- Total Dispatched Evacuees: {total_people:,}
- High-Risk Zones Active: {high_risk_count}
- Sample Evacuation Routes:
{json.dumps(top_routes, indent=2)}

Provide a structured, clear explanation for emergency response teams.
You MUST reply with ONLY valid JSON matching this exact schema:
{{
  "summary": "Concise executive briefing of the relocation plan",
  "critical_zones": [
    {{
      "zone_name": "Name of hazard area",
      "risk_level": "HIGH / MEDIUM / LOW",
      "priority_reason": "Why this zone was prioritized first",
      "assigned_shelter": "Destination safe shelter name",
      "evacuees": 12000,
      "estimated_travel_time": "Estimated transit duration e.g. 2.5 hours"
    }}
  ],
  "recommendations": [
    "First actionable instruction for emergency teams",
    "Second actionable instruction",
    "Third actionable instruction"
  ]
}}"""

    if api_key and not api_key.startswith("your_"):
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

                response = requests.post(url, json=payload, headers=headers, timeout=4)

                if response.status_code == 200:
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0]["content"]["parts"][0]["text"]
                        parsed = json.loads(raw_text)
                        
                        if "summary" in parsed and "critical_zones" in parsed and "recommendations" in parsed:
                            parsed["ai_engine"] = f"Google Gemini ({model})"
                            return parsed
            except Exception:
                continue

    # Deterministic rule-based expert briefing fallback ensuring zero downtime
    return _generate_expert_fallback(relocation_plan, total_people, high_risk_count)

def _generate_expert_fallback(
    relocation_plan: List[Dict[str, Any]],
    total_people: int,
    high_risk_count: int
) -> Dict[str, Any]:
    """
    Deterministic rule-based expert briefing fallback.
    """
    critical_zones = []
    for item in relocation_plan[:6]:
        risk = (item.get("risk") or "medium").upper()
        hazard = item.get("hazard_type", "hazard")
        people = item.get("people", 0)
        dist = item.get("distance_km", 0)
        time_min = item.get("travel_time_min", 0)
        
        time_str = f"{time_min} mins" if time_min else (f"{round(dist/50.0, 1)} hrs" if dist else "Immediate local transit")

        reason = (
            f"Categorized as {risk} risk ({hazard.capitalize()}) with {people:,} vulnerable citizens. "
            f"Triage priority score {item.get('priority_score', 0):,} mandates emergency corridor clearance."
        )

        critical_zones.append({
            "zone_name": item.get("from", "Hazard Zone"),
            "risk_level": risk,
            "priority_reason": reason,
            "assigned_shelter": item.get("to", "Safe Shelter"),
            "evacuees": people,
            "estimated_travel_time": time_str
        })

    return {
        "summary": (
            f"SafeShift Decision Support System has synthesized an emergency relocation plan for {total_people:,} evacuees "
            f"across {len(relocation_plan)} active routes. {high_risk_count} critical zones have been prioritized for "
            f"immediate transit to elevated shelters based on multi-hazard vulnerability indices and shortest road corridors."
        ),
        "critical_zones": critical_zones,
        "recommendations": [
            "Deploy NDRF and SDRF logistics convoys along primary arterial routes identified for High-Risk zones.",
            "Pre-position medical supplies, mobile water purifiers, and emergency bedding at high-capacity regional shelters.",
            "Establish real-time traffic corridor priority (green corridors) to ensure travel times remain within estimated windows.",
            "Implement digital head-count verification upon arrival at destination safe havens to verify 100% capacity matching."
        ],
        "ai_engine": "SafeShift Expert Decision Engine (Rule-Based Fallback)"
    }
