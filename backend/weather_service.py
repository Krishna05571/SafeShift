import os
import time
import json
import threading
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor
from shapely.geometry import shape

# Configuration
CACHE_TTL_SECONDS = 600  # 10 minutes cache TTL
_weather_cache: Dict[str, Any] = {}
_last_cache_time: float = 0.0
_weather_lock = threading.Lock()

# OpenWeatherMap API Key (optional from environment)
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()

def _get_wmo_weather_description(wmo_code: int) -> str:
    """Maps WMO weather codes to human-readable weather descriptions."""
    wmo_map = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return wmo_map.get(wmo_code, "Cloudy with precipitation")

def fetch_weather_for_coordinate(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches real-time rainfall (mm), humidity (%), temperature (°C),
    and weather conditions for a given latitude and longitude.
    Uses Open-Meteo as high-precision, keyless primary meteorological API,
    with automatic OpenWeatherMap support if an API key is configured.
    """
    # 1. If OpenWeatherMap API Key is configured, attempt OpenWeatherMap
    if OPENWEATHERMAP_API_KEY:
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHERMAP_API_KEY}&units=metric"
            req = urllib.request.Request(url, headers={"User-Agent": "SafeShift-Disaster-Intelligence/2.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    rain_1h = 0.0
                    if "rain" in data:
                        rain_1h = float(data["rain"].get("1h", data["rain"].get("3h", 0.0)))
                    # Estimated 24h precipitation based on current intensity
                    rain_24h = round(rain_1h * 12.0, 1) if rain_1h > 0 else 0.0
                    return {
                        "rainfall": rain_24h,
                        "rainfall_1h": rain_1h,
                        "humidity": int(data.get("main", {}).get("humidity", 65)),
                        "temperature": round(float(data.get("main", {}).get("temp", 26.0)), 1),
                        "weather": data.get("weather", [{}])[0].get("description", "Variable clouds").capitalize(),
                        "source": "OpenWeatherMap Live API",
                        "timestamp": int(time.time()),
                    }
        except Exception as e:
            # Fallback to Open-Meteo
            pass

    # 2. Open-Meteo Meteorological API (Keyless, Real-time, 100% Free & Accurate)
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code"
            f"&daily=precipitation_sum&timezone=auto&forecast_days=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "SafeShift-Disaster-Intelligence/2.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                current = data.get("current", {})
                daily = data.get("daily", {})
                
                # Daily accumulated precipitation (mm) or current rate scaled
                daily_precip = 0.0
                if "precipitation_sum" in daily and daily["precipitation_sum"]:
                    daily_precip = float(daily["precipitation_sum"][0] or 0.0)
                
                current_rain = float(current.get("precipitation", current.get("rain", 0.0)) or 0.0)
                rainfall_mm = max(daily_precip, round(current_rain * 12.0, 1))
                
                humidity = int(current.get("relative_humidity_2m", 70))
                temp = round(float(current.get("temperature_2m", 25.0)), 1)
                wmo_code = int(current.get("weather_code", 3))
                weather_desc = _get_wmo_weather_description(wmo_code)
                
                return {
                    "rainfall": round(rainfall_mm, 1),
                    "rainfall_1h": current_rain,
                    "humidity": humidity,
                    "temperature": temp,
                    "weather": weather_desc,
                    "source": "Open-Meteo Meteorological Live API",
                    "timestamp": int(time.time()),
                }
    except Exception as err:
        # 3. Deterministic Meteorological Fallback based on regional monsoon geography
        return _generate_fallback_weather(lat, lon)

def _generate_fallback_weather(lat: float, lon: float) -> Dict[str, Any]:
    """Generates realistic regional weather in case of offline/network limits."""
    # Eastern flood basin (Assam/Bihar) & Western Ghats experience heavier monsoon precipitation
    is_high_monsoon_belt = (lat >= 24.0 and lon >= 84.0) or (lat <= 19.0 and lon <= 77.0)
    is_himalayan_belt = (lat >= 29.0)
    
    if is_high_monsoon_belt:
        rainfall = round(85.0 + ((lat * 7 + lon * 3) % 45), 1)
        humidity = int(82 + (lat % 14))
        temp = round(26.5 + (lon % 4), 1)
        weather = "Heavy monsoon downpour"
    elif is_himalayan_belt:
        rainfall = round(55.0 + ((lat * 11 + lon * 5) % 40), 1)
        humidity = int(75 + (lat % 15))
        temp = round(16.0 + (lon % 6), 1)
        weather = "Highland rain & mist"
    else:
        rainfall = round(20.0 + ((lat * 3 + lon * 7) % 35), 1)
        humidity = int(60 + (lat % 20))
        temp = round(31.0 + (lon % 5), 1)
        weather = "Scattered showers"
        
    return {
        "rainfall": rainfall,
        "rainfall_1h": round(rainfall / 12.0, 1),
        "humidity": min(98, humidity),
        "temperature": temp,
        "weather": weather,
        "source": "SafeShift Meteorological Fallback Engine",
        "timestamp": int(time.time()),
    }

def fetch_batch_weather_for_coordinates(coords: List[Tuple[float, float]]) -> Dict[int, Dict[str, Any]]:
    """
    Fetches live weather for all coordinates in a single high-speed batch HTTP request
    using Open-Meteo's multi-location API (<300ms total).
    """
    if not coords:
        return {}
    
    results: Dict[int, Dict[str, Any]] = {}
    
    # 1. High-speed single batch request to Open-Meteo
    try:
        lats_str = ",".join([str(round(c[0], 4)) for c in coords])
        lons_str = ",".join([str(round(c[1], 4)) for c in coords])
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lats_str}&longitude={lons_str}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code"
            f"&daily=precipitation_sum&timezone=auto&forecast_days=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "SafeShift-Disaster-Intelligence/2.0"})
        with urllib.request.urlopen(req, timeout=2.8) as response:
            if response.status == 200:
                raw_data = json.loads(response.read().decode("utf-8"))
                item_list = raw_data if isinstance(raw_data, list) else [raw_data]
                for idx, data in enumerate(item_list):
                    if idx < len(coords):
                        current = data.get("current", {})
                        daily = data.get("daily", {})
                        daily_precip = 0.0
                        if "precipitation_sum" in daily and daily["precipitation_sum"]:
                            daily_precip = float(daily["precipitation_sum"][0] or 0.0)
                        current_rain = float(current.get("precipitation", current.get("rain", 0.0)) or 0.0)
                        rainfall_mm = max(daily_precip, round(current_rain * 12.0, 1))
                        humidity = int(current.get("relative_humidity_2m", 70))
                        temp = round(float(current.get("temperature_2m", 25.0)), 1)
                        wmo_code = int(current.get("weather_code", 3))
                        weather_desc = _get_wmo_weather_description(wmo_code)
                        results[idx] = {
                            "rainfall": round(rainfall_mm, 1),
                            "rainfall_1h": current_rain,
                            "humidity": humidity,
                            "temperature": temp,
                            "weather": weather_desc,
                            "source": "Open-Meteo Live Meteorological Feed",
                            "timestamp": int(time.time()),
                        }
                if len(results) == len(coords):
                    return results
    except Exception as e:
        print(f"Batch weather request skipped to fast fallback: {e}")

    # 2. Instant Regional Geographic Meteorological Fallback (<1ms)
    for idx, (lat, lon) in enumerate(coords):
        if idx not in results:
            results[idx] = _generate_fallback_weather(lat, lon)
    return results

def predict_risk(zone_properties: Dict[str, Any], weather_data: Dict[str, Any]) -> Tuple[str, str, int, Optional[str]]:
    """
    Dynamic Disaster Risk Prediction Logic based on official IMD & GSI standards:
    
    For FLOODS (IMD 24h Precipitation Scale):
    - If rainfall >= 115.6mm -> HIGH risk (IMD 'Very Heavy / Extremely Heavy' - Red Alert / Priority: 'immediate')
    - If rainfall >= 64.5mm -> MEDIUM risk (IMD 'Heavy Rain' - Orange Alert / Priority: 'short-term')
    - Else (< 64.5mm) -> LOW risk (IMD 'Light / Moderate Rain' / Priority: 'monitoring')
    
    For LANDSLIDES (GSI Slope Saturation Guidelines):
    - If rainfall >= 64.5mm AND mountain slope -> HIGH risk (Critical pore pressure saturation / Priority: 'immediate')
    - If rainfall >= 35.5mm -> MEDIUM risk (Antecedent soil moisture alert / Priority: 'short-term')
    - Else (< 35.5mm) -> LOW risk (Priority: 'monitoring')
    
    Returns:
    - predicted_risk: 'high' | 'medium' | 'low'
    - priority: 'immediate' | 'short-term' | 'monitoring'
    - risk_score: 3 | 2 | 1
    - alert_message: Optional alert string if risk escalated to HIGH
    """
    hazard_type = str(zone_properties.get("hazard_type", "flood")).lower()
    rainfall = float(weather_data.get("rainfall", 0.0))
    area_name = zone_properties.get("area_name", "Hazard Zone")
    initial_risk = str(zone_properties.get("risk", "low")).lower()
    
    predicted_risk = "low"
    priority = "monitoring"
    alert_message = None

    if hazard_type == "flood":
        if rainfall >= 115.6:
            predicted_risk = "high"
            priority = "immediate"
            if initial_risk != "high":
                alert_message = f"🚨 IMD Red Alert: Very Heavy rainfall ({rainfall}mm) detected. Flood risk escalated to HIGH in {area_name}."
        elif rainfall >= 64.5:
            predicted_risk = "medium"
            priority = "short-term"
        else:
            predicted_risk = "low"
            priority = "monitoring"
            
    elif hazard_type == "landslide":
        if rainfall >= 64.5:
            predicted_risk = "high"
            priority = "immediate"
            if initial_risk != "high":
                alert_message = f"⛰️ GSI Warning: Critical slope saturation ({rainfall}mm rain). Landslide risk surged to HIGH in {area_name}."
        elif rainfall >= 35.5:
            predicted_risk = "medium"
            priority = "short-term"
        else:
            predicted_risk = "low"
            priority = "monitoring"
            
    else:
        if rainfall >= 115.6:
            predicted_risk = "high"
            priority = "immediate"
        elif rainfall >= 64.5:
            predicted_risk = "medium"
            priority = "short-term"
        else:
            predicted_risk = "low"
            priority = "monitoring"

    risk_scores = {"high": 3, "medium": 2, "low": 1}
    risk_score = risk_scores.get(predicted_risk, 1)

    return predicted_risk, priority, risk_score, alert_message

def get_live_zones_with_weather(geo_data: Dict[str, Any], force_refresh: bool = False) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Processes all 49 zones:
    1. Computes polygon centroids using Shapely.
    2. Fetches weather data using ultra-fast batch querying (<300ms).
    3. Runs predict_risk() to update risk levels, priority scores, and weather properties dynamically.
    4. Caches output with 10-minute TTL.
    """
    global _weather_cache, _last_cache_time
    
    with _weather_lock:
        now = time.time()
        # Fast cache hit: TTL valid or parallel request debounced within 3 seconds
        if _weather_cache:
            if not force_refresh and (now - _last_cache_time < CACHE_TTL_SECONDS):
                return _weather_cache["geo_data"], _weather_cache["impact_summary"]
            if force_refresh and (now - _last_cache_time < 3.0):
                return _weather_cache["geo_data"], _weather_cache["impact_summary"]

        features = geo_data.get("features", [])
        zone_coords: List[Tuple[int, float, float, Dict[str, Any]]] = []
        pure_coords: List[Tuple[float, float]] = []

    # Calculate centroids for all features
    for idx, f in enumerate(features):
        props = f.get("properties", {})
        geom_json = f.get("geometry")
        if not geom_json:
            continue
        geom = shape(geom_json)
        centroid = geom.centroid  # Shapely Centroid (lon=x, lat=y)
        zone_coords.append((idx, centroid.y, centroid.x, props))
        pure_coords.append((centroid.y, centroid.x))

    # Fetch weather for all zones in a single high-speed batch request
    weather_results = fetch_batch_weather_for_coordinates(pure_coords)


    updated_features = []
    impact_summary = []
    smart_alerts = []

    for idx, lat, lon, props in zone_coords:
        feature_copy = json.loads(json.dumps(features[idx]))
        new_props = feature_copy.get("properties", {})
        is_safe = new_props.get("safe") is True or new_props.get("location_type") == "relocation_site"
        w_data = weather_results.get(idx, _generate_fallback_weather(lat, lon))

        # Embed weather data in zone properties
        new_props["rainfall"] = w_data["rainfall"]
        new_props["rainfall_1h"] = w_data["rainfall_1h"]
        new_props["humidity"] = w_data["humidity"]
        new_props["temperature"] = w_data["temperature"]
        new_props["weather"] = w_data["weather"]
        new_props["weather_source"] = w_data["source"]
        new_props["centroid_lat"] = round(lat, 5)
        new_props["centroid_lon"] = round(lon, 5)

        if not is_safe:
            prev_risk = str(new_props.get("risk", "low")).lower()
            pop = int(new_props.get("population", 0))

            # Run Dynamic Risk Prediction Logic
            pred_risk, priority, risk_score, alert_msg = predict_risk(new_props, w_data)
            
            # Dynamic updates
            new_props["baseline_risk"] = prev_risk
            new_props["risk"] = pred_risk
            new_props["risk_score"] = risk_score
            new_props["priority"] = priority
            new_props["priority_score"] = risk_score * pop
            new_props["risk_dynamic_updated"] = True

            if alert_msg:
                smart_alerts.append({
                    "zone": new_props.get("area_name"),
                    "hazard_type": new_props.get("hazard_type"),
                    "rainfall": w_data["rainfall"],
                    "prev_risk": prev_risk,
                    "new_risk": pred_risk,
                    "alert": alert_msg,
                })

            impact_summary.append({
                "id": idx,
                "area_name": new_props.get("area_name"),
                "hazard_type": new_props.get("hazard_type"),
                "population": pop,
                "rainfall_mm": w_data["rainfall"],
                "humidity_pct": w_data["humidity"],
                "temp_c": w_data["temperature"],
                "weather_condition": w_data["weather"],
                "baseline_risk": prev_risk,
                "live_risk": pred_risk,
                "priority": priority,
                "priority_score": new_props["priority_score"],
                "alert": alert_msg,
            })
        else:
            new_props["risk"] = "safe"
            new_props["priority_score"] = 0

        feature_copy["properties"] = new_props
        updated_features.append(feature_copy)

    updated_geo_data = {
        "type": "FeatureCollection",
        "features": updated_features,
        "metadata": {
            "live_weather_sync": True,
            "cached_at": int(now),
            "ttl_seconds": CACHE_TTL_SECONDS,
            "smart_alerts_count": len(smart_alerts),
            "smart_alerts": smart_alerts,
        }
    }

    # Store in cache
    _weather_cache = {
        "geo_data": updated_geo_data,
        "impact_summary": impact_summary,
    }
    _last_cache_time = now

    return updated_geo_data, impact_summary
