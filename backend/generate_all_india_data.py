import json
from pathlib import Path

# Helper to create a bounding box polygon around a center [lon, lat]
def make_polygon(center_lon, center_lat, dx=0.25, dy=0.2):
    return [
        [
            [round(center_lon - dx, 6), round(center_lat - dy, 6)],
            [round(center_lon + dx, 6), round(center_lat - dy, 6)],
            [round(center_lon + dx * 1.1, 6), round(center_lat + dy, 6)],
            [round(center_lon - dx * 0.9, 6), round(center_lat + dy * 1.05, 6)],
            [round(center_lon - dx * 1.15, 6), round(center_lat, 6)],
            [round(center_lon - dx, 6), round(center_lat - dy, 6)],
        ]
    ]

# 28 Major Indian Multi-Hazard Zones
hazard_zones_data = [
    # 1. Northern Himalayan Belt
    {
        "area_name": "Chamoli - Joshimath Zone (UK)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 12500,
        "lon": 79.56, "lat": 30.55, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Kedarnath - Rudraprayag Valley (UK)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 9000,
        "lon": 78.98, "lat": 30.48, "dx": 0.20, "dy": 0.16
    },
    {
        "area_name": "Nainital Kumaon Hills (UK)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 8000,
        "lon": 79.45, "lat": 29.38, "dx": 0.18, "dy": 0.15
    },
    {
        "area_name": "Kullu - Manali Beas Basin (HP)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 11000,
        "lon": 77.18, "lat": 31.95, "dx": 0.22, "dy": 0.20
    },
    {
        "area_name": "Shimla Urban Slopes (HP)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 7500,
        "lon": 77.17, "lat": 31.10, "dx": 0.16, "dy": 0.14
    },
    {
        "area_name": "Srinagar Jhelum Basin (J&K)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 15000,
        "lon": 74.80, "lat": 34.08, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Leh Indus Valley Belt (Ladakh)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 5000,
        "lon": 77.58, "lat": 34.15, "dx": 0.25, "dy": 0.18
    },

    # 2. Northeast & Eastern Flood Corridor
    {
        "area_name": "Kaziranga - Golaghat Basin (Assam)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 18000,
        "lon": 93.35, "lat": 26.65, "dx": 0.35, "dy": 0.22
    },
    {
        "area_name": "Majuli Island - Dhemaji (Assam)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 14000,
        "lon": 94.20, "lat": 26.95, "dx": 0.30, "dy": 0.20
    },
    {
        "area_name": "Guwahati Urban Hills (Assam)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 8500,
        "lon": 91.75, "lat": 26.18, "dx": 0.18, "dy": 0.14
    },
    {
        "area_name": "Teesta River Valley (Sikkim)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 8500,
        "lon": 88.52, "lat": 27.33, "dx": 0.18, "dy": 0.16
    },
    {
        "area_name": "Cherrapunji - Khasi Hills (Meghalaya)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 6000,
        "lon": 91.72, "lat": 25.28, "dx": 0.20, "dy": 0.15
    },
    {
        "area_name": "Darjeeling - Kalimpong Slopes (WB)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 10000,
        "lon": 88.26, "lat": 27.04, "dx": 0.18, "dy": 0.16
    },
    {
        "area_name": "Sundarbans Coastal Delta (WB)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 16000,
        "lon": 88.85, "lat": 21.95, "dx": 0.35, "dy": 0.25
    },
    {
        "area_name": "Kosi Inundation Belt - Supaul (Bihar)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 22000,
        "lon": 86.60, "lat": 26.12, "dx": 0.35, "dy": 0.25
    },
    {
        "area_name": "Bagmati Basin - Muzaffarpur (Bihar)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 13000,
        "lon": 85.38, "lat": 26.12, "dx": 0.28, "dy": 0.20
    },

    # 3. Eastern Coastal Corridors
    {
        "area_name": "Mahanadi Delta - Kendrapara (Odisha)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 15000,
        "lon": 86.42, "lat": 20.50, "dx": 0.30, "dy": 0.22
    },
    {
        "area_name": "Puri - Chilika Coastal Surge (Odisha)",
        "hazard_type": "flood",
        "risk": "high",
        "priority": "immediate",
        "population": 12000,
        "lon": 85.50, "lat": 19.80, "dx": 0.30, "dy": 0.22
    },
    {
        "area_name": "Godavari Delta - Konaseema (AP)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 11000,
        "lon": 81.90, "lat": 16.85, "dx": 0.28, "dy": 0.22
    },

    # 4. Western Ghats & Coastal Belt
    {
        "area_name": "Wayanad - Meppadi Hills (Kerala)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 9500,
        "lon": 76.13, "lat": 11.55, "dx": 0.18, "dy": 0.15
    },
    {
        "area_name": "Idukki High Range (Kerala)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 8000,
        "lon": 76.98, "lat": 9.85, "dx": 0.20, "dy": 0.18
    },
    {
        "area_name": "Kuttanad Lowlands (Kerala)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 12000,
        "lon": 76.45, "lat": 9.45, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Mahad - Savitri River Basin (Maharashtra)",
        "hazard_type": "landslide",
        "risk": "high",
        "priority": "immediate",
        "population": 10500,
        "lon": 73.42, "lat": 18.08, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Mumbai Mithi River Basin (Maharashtra)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 16000,
        "lon": 72.88, "lat": 19.06, "dx": 0.18, "dy": 0.15
    },
    {
        "area_name": "Pune Western Ghats Slopes (Maharashtra)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 6000,
        "lon": 73.55, "lat": 18.52, "dx": 0.18, "dy": 0.15
    },
    {
        "area_name": "Kodagu - Coorg Hills (Karnataka)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 7000,
        "lon": 75.74, "lat": 12.42, "dx": 0.20, "dy": 0.16
    },

    # 5. Southern Urban & Hill Corridors
    {
        "area_name": "Nilgiris - Ooty Slopes (Tamil Nadu)",
        "hazard_type": "landslide",
        "risk": "medium",
        "priority": "short-term",
        "population": 6500,
        "lon": 76.70, "lat": 11.41, "dx": 0.18, "dy": 0.15
    },
    {
        "area_name": "Chennai Adyar Basin (Tamil Nadu)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 14000,
        "lon": 80.22, "lat": 13.00, "dx": 0.20, "dy": 0.16
    },

    # 6. Central & Plains Monitoring
    {
        "area_name": "Vadodara Vishwamitri Basin (Gujarat)",
        "hazard_type": "flood",
        "risk": "medium",
        "priority": "short-term",
        "population": 9000,
        "lon": 73.18, "lat": 22.30, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Delhi Yamuna Floodplains (Delhi-NCR)",
        "hazard_type": "flood",
        "risk": "low",
        "priority": "safe",
        "population": 4500,
        "lon": 77.25, "lat": 28.66, "dx": 0.18, "dy": 0.14
    },
    {
        "area_name": "Varanasi Ganga Lowlands (UP)",
        "hazard_type": "flood",
        "risk": "low",
        "priority": "safe",
        "population": 5000,
        "lon": 83.00, "lat": 25.32, "dx": 0.20, "dy": 0.15
    }
]

# 17 Strategic Safe Relocation Centers (Elevated grounds, stadiums, university campuses)
safe_zones_data = [
    {
        "area_name": "Safe Zone North-1 (Dehradun FRI & Cantt Grounds)",
        "capacity": 25000,
        "lon": 77.99, "lat": 30.34, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Safe Zone North-2 (Chandigarh Sports Complex)",
        "capacity": 30000,
        "lon": 76.78, "lat": 30.73, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Safe Zone North-3 (Srinagar Elevated Airport Plateau)",
        "capacity": 20000,
        "lon": 74.77, "lat": 33.98, "dx": 0.20, "dy": 0.16
    },
    {
        "area_name": "Safe Zone North-4 (Greater Noida High-Ground Center)",
        "capacity": 35000,
        "lon": 77.50, "lat": 28.47, "dx": 0.30, "dy": 0.22
    },
    {
        "area_name": "Safe Zone East-1 (Guwahati Sarusajai & IIT Campus)",
        "capacity": 35000,
        "lon": 91.68, "lat": 26.12, "dx": 0.28, "dy": 0.22
    },
    {
        "area_name": "Safe Zone East-2 (Siliguri University Safe Campus)",
        "capacity": 20000,
        "lon": 88.38, "lat": 26.71, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Safe Zone East-3 (Patna AIIMS & Bihta Highland Center)",
        "capacity": 40000,
        "lon": 85.04, "lat": 25.56, "dx": 0.30, "dy": 0.22
    },
    {
        "area_name": "Safe Zone East-4 (Bhubaneswar Kalinga Sports Shelter)",
        "capacity": 30000,
        "lon": 85.82, "lat": 20.30, "dx": 0.28, "dy": 0.22
    },
    {
        "area_name": "Safe Zone East-5 (Kolkata Salt Lake Stadium High-Ground)",
        "capacity": 25000,
        "lon": 88.40, "lat": 22.57, "dx": 0.24, "dy": 0.18
    },
    {
        "area_name": "Safe Zone West-1 (Navi Mumbai Kharghar Elevated Complex)",
        "capacity": 30000,
        "lon": 73.06, "lat": 19.03, "dx": 0.24, "dy": 0.18
    },
    {
        "area_name": "Safe Zone West-2 (Pune Pimpri Elevated Shelter Grounds)",
        "capacity": 25000,
        "lon": 73.80, "lat": 18.62, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Safe Zone West-3 (Ahmedabad Sardar Patel Elevated Shelter)",
        "capacity": 20000,
        "lon": 72.60, "lat": 23.09, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Safe Zone South-1 (Kozhikode Regional Elevated Sports Complex)",
        "capacity": 20000,
        "lon": 75.79, "lat": 11.26, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Safe Zone South-2 (Kochi Infopark Elevated Convention Grounds)",
        "capacity": 25000,
        "lon": 76.36, "lat": 10.01, "dx": 0.22, "dy": 0.18
    },
    {
        "area_name": "Safe Zone South-3 (Bengaluru Yelahanka Elevated Center)",
        "capacity": 35000,
        "lon": 77.60, "lat": 13.10, "dx": 0.28, "dy": 0.22
    },
    {
        "area_name": "Safe Zone South-4 (Chennai Tambaram Airforce Elevated Grounds)",
        "capacity": 25000,
        "lon": 80.12, "lat": 12.92, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Safe Zone South-5 (Vijayawada Gunadala Elevated Shelter)",
        "capacity": 20000,
        "lon": 80.67, "lat": 16.52, "dx": 0.25, "dy": 0.20
    },
    {
        "area_name": "Safe Zone Central-1 (Nagpur Divisional Sports Complex)",
        "capacity": 20000,
        "lon": 79.08, "lat": 21.15, "dx": 0.28, "dy": 0.22
    }
]

features = []

# Add Hazard Features
for h in hazard_zones_data:
    poly = make_polygon(h["lon"], h["lat"], h["dx"], h["dy"])
    feat = {
        "type": "Feature",
        "properties": {
            "risk": h["risk"],
            "hazard_type": h["hazard_type"],
            "population": h["population"],
            "area_name": h["area_name"],
            "priority": h["priority"]
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": poly
        }
    }
    features.append(feat)

# Add Safe Features
for s in safe_zones_data:
    poly = make_polygon(s["lon"], s["lat"], s["dx"], s["dy"])
    feat = {
        "type": "Feature",
        "properties": {
            "safe": True,
            "capacity": s["capacity"],
            "area_name": s["area_name"],
            "location_type": "relocation_site"
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": poly
        }
    }
    features.append(feat)

geojson_result = {
    "type": "FeatureCollection",
    "features": features
}

output_path = Path("c:/Users/Krishna Kaushal/Desktop/SafeShift/data/hazard_zones.geojson")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(geojson_result, f, indent=2)

print(f"Generated Pan-India dataset with {len(features)} total features ({len(hazard_zones_data)} hazard zones, {len(safe_zones_data)} safe zones).")
