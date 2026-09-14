# SafeShift
### Multi-Hazard Spatial Relocation & Evacuation Intelligence System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0.0-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900.svg?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![OSRM](https://img.shields.io/badge/OSRM-Highway_Routing-10b981.svg?style=flat&logo=openstreetmap&logoColor=white)](https://project-osrm.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-1.5%20%2F%202.5-4285F4.svg?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

**SafeShift** is an advanced geospatial emergency response and disaster evacuation decision-support system designed to optimize civilian relocations in real time during multi-hazard crises across India.

By bridging live meteorological telemetry, geotechnical risk models, mathematical linear optimization, real-time shelter capacity tracking, **turn-by-turn real-world national highway routing**, and **Google Gemini AI Situational Intelligence**, SafeShift transforms complex spatial data into clear, actionable tactical directives for disaster commanders and first responders.

---

## Live Deployment

- **Production URL**: [https://safe-shift-10-pi.vercel.app/](https://safe-shift-10-pi.vercel.app/)

---

## Core Capabilities

### 1. Dual Risk Intelligence Modes
- **Live Weather Mode**: Continuously ingests real-time precipitation, humidity, and atmospheric data from Open-Meteo. Dynamically computes disaster risk according to official **India Meteorological Department (IMD)** and **Geological Survey of India (GSI)** benchmarks:
  - **Floods**: Red Alert ($\ge 115.6\text{ mm}$), Orange Alert ($64.5 - 115.5\text{ mm}$), Green Alert ($< 64.5\text{ mm}$).
  - **Landslides**: Critical Pore Saturation ($\ge 64.5\text{ mm}$), Moisture Alert ($35.5 - 64.4\text{ mm}$), Equilibrium ($< 35.5\text{ mm}$).
- **Baseline Mode**: Evaluates intrinsic topographical exposure, low-lying river catchments, slope steepness, and historical vulnerability.

### 2. Turn-by-Turn Real-World Highway Navigation & Tracing
- Integrates a hybrid routing architecture combining precomputed high-density OpenStreetMap / OSRM highway coordinates across all 37 disaster evacuation corridors with a direct client-side OSRM routing engine.
- Renders authentic national highway polylines (NH-44, NH-58, NH-7, expressways, bypasses, and mountain passes) with 400–500 precise GPS coordinates per route.
- High-contrast visualizer featuring a solid royal blue navigation polyline (`#2563eb`, weight: 5.5) with outer contrast casing for clear cartographic visibility.
- On-demand instant route tracing via **Trace Highway Route**, **Trace**, and **Alts → Map** actions with $0\text{ ms}$ visual latency.

### 3. Google Gemini AI Situational Intelligence & Tactical Briefings
- Integrates Google Gemini (`gemini-2.5-flash-lite` and `gemini-1.5-flash`) to generate structured executive situational briefings, sector risk justifications, and actionable field directives.
- Features a full-screen, high-contrast Tactical Intelligence Briefing interface adhering strictly to formal National Disaster Management Authority (NDMA) incident command standards (zero informal emojis).
- In-memory caching ($< 1\text{ ms}$) and an instantaneous deterministic expert decision engine fallback ($< 5\text{ ms}$).
- Dynamic operational triage:
  - **Active Emergencies**: Directs immediate NDRF/SDRF convoy dispatch, corridor clearance, and shelter intake preparation.
  - **Normal Weather / Standby**: Directs telemetry monitoring and standby readiness without premature mass evacuation.

### 4. Optimization-Driven Evacuation Engine
- Linear programming formulation minimizes total evacuation transit time while respecting safe haven capacity limits.
- Ranks hazard sectors by priority score ($\text{Priority} = \text{Risk Score} \times \text{Affected Population}$).
- Dynamically splits evacuee flows across secondary safe shelters when primary capacities are exceeded.

### 5. Real-Time Shelter Capacity & Multi-Route Rerouting
- Tracks occupancy, remaining capacity, fill percentages, and time-to-full (ETA) across 18 designated safe havens.
- Multi-tier alert thresholds at **70% (Warning)**, **90% (Critical / 10% Headroom Remaining)**, and **100% (Saturated)**.
- Automated spillover rerouting to the top 2 ranked alternate safe havens with high-resolution road geometry.

### 6. Disaster Progression Simulator (0–60 Minute Continuous Timeline)
- Simulates physical flood spread, polygon buffer dilation, and inundation depth.
- Models hillside soil saturation and dynamic slope failure probability.
- Real-time shelter load growth forecasting and emergency threshold triggers.

---

## System Architecture

```
                       +---------------------------------------+
                       |        Open-Meteo Live Weather        |
                       +-------------------+-------------------+
                                           | (Real-time telemetry)
                                           v
+-----------------------------------------------------------------------------------+
|                           FastAPI Backend (:8005)                                 |
|                                                                                   |
|  +-------------------------+  +--------------------------+  +-------------------+ |
|  | IMD/GSI Risk Engine     |  | Linear Programming       |  | Shelter Capacity  | |
|  | (weather_service.py)    |  | Relocation Engine        |  | Manager & Routing | |
|  |                         |  | (relocation.py)          |  | (safezone_service)| |
|  +------------+------------+  +------------+-------------+  +---------+---------+ |
|               |                            |                          |           |
|               +----------------------------+--------------------------+           |
|                                            |                                      |
|                                            v                                      |
|                 +--------------------------------------+                          |
|                 | Google Gemini AI Explainer &         |                          |
|                 | Fallback Expert Decision Engine      |                          |
|                 | (gemini_explainer.py)                |                          |
|                 +--------------------------------------+                          |
+------------------------------------+----------------------------------------------+
                                     | (REST APIs / JSON)
                                     v
+-----------------------------------------------------------------------------------+
|                        React 18 + Vite Frontend (:3000)                           |
|                                                                                   |
|  - Full-Screen Tactical Intelligence Briefing (AIBriefingModal.jsx)               |
|  - Real-World Turn-by-Turn Highway GIS Map (HazardMap.jsx)                        |
|  - Precomputed National Highway Dataset (initial_highway_routes.json)             |
|  - Real-Time Shelter Capacity & Spillover Rerouting View (SafeZoneCapacityPage)  |
|  - 0-60 Min Disaster Progression Simulator (SimulationController.jsx)            |
|  - Dynamic Smart Alert Notification Stack (CapacityToastStack.jsx)               |
+-----------------------------------------------------------------------------------+
```

---

## Project Structure

```
SafeShift/
│
├── backend/
│   ├── main.py                   # FastAPI application routes and lifecycle
│   ├── weather_service.py        # Open-Meteo live ingestion & IMD/GSI risk engine
│   ├── relocation.py             # Evacuation optimization & priority scoring
│   ├── gemini_explainer.py       # Google Gemini AI situational intelligence & fallback
│   ├── safezone_service.py       # Safe shelter capacity tracking & alternate finder
│   ├── simulation.py             # 0-60 min disaster progression simulation engine
│   ├── routing.py                # Highway curvature & transit duration models
│   ├── precompute.py             # Pre-warming script for spatial caches
│   └── requirements.txt          # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AIBriefingModal.jsx        # Full-screen Gemini tactical briefing modal
│   │   │   ├── AlternateRoutesModal.jsx   # Multi-route alternate shelter view
│   │   │   ├── CapacityToastStack.jsx     # Real-time capacity alert toasts
│   │   │   ├── CommandCenterEntry.jsx     # Landing portal entry interface
│   │   │   ├── DashboardPanel.jsx         # Telemetry & relocation KPI panel
│   │   │   ├── HazardMap.jsx              # Leaflet GIS multi-hazard map & highway renderer
│   │   │   ├── LandingPage.jsx            # Project landing presentation page
│   │   │   ├── Legend.jsx                 # Cartographic severity legend
│   │   │   ├── RelocationTable.jsx        # Evacuation plan dispatch table
│   │   │   ├── SafeZoneCapacityPage.jsx   # Shelter occupancy & spillover dashboard
│   │   │   ├── SimulationController.jsx   # 0-60 min scenario timeline slider
│   │   │   ├── SmartAlertBanner.jsx       # IMD/GSI weather escalation banner
│   │   │   ├── StatsBar.jsx               # Header operational statistics bar
│   │   │   └── ZoneDetailsModal.jsx       # Zone meteorological inspection modal
│   │   ├── data/
│   │   │   └── initial_highway_routes.json # Precomputed turn-by-turn highway coordinates
│   │   ├── utils/
│   │   │   └── geoUtils.js                # GIS calculations, OSRM client fetcher, geometry
│   │   ├── App.jsx                        # Root React application & state manager
│   │   └── main.jsx                       # React entry point
│   ├── vite.config.js                     # Vite configuration
│   └── package.json                       # Node dependencies & scripts
│
├── data/
│   └── hazard_zones.geojson      # Multi-hazard polygons & safe haven shelters
│
├── conditions.txt                # Mathematical models, equations, & AI directive spec
└── README.md                     # System documentation & setup guide
```

---

## Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **Python** (v3.10 or higher)
- **Git**

---

### Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```powershell
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables (Optional for live Gemini AI):
   Create a `.env` file in the `backend/` directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(If omitted or invalid, SafeShift automatically utilizes its sub-5ms deterministic expert decision engine fallback).*

5. Start the backend server on port `8005`:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8005 --reload
   ```

   - **Backend API**: `http://127.0.0.1:8005/`
   - **Interactive API Documentation (Swagger)**: `http://127.0.0.1:8005/docs`

---

### Frontend Setup (React + Vite)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server on port `3000`:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000/
   ```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | System health, version status, and registered endpoint list. |
| `/zones` | `GET` | Multi-hazard baseline GeoJSON FeatureCollection. |
| `/zones/live` | `GET` | Live meteorological hazard polygons with dynamically predicted IMD/GSI risk levels. Supports `?refresh=true`. |
| `/weather-impact` | `GET` | Meteorological summary, zone-by-zone rainfall impacts, and active smart alerts. |
| `/relocation-plan` | `GET` | Optimized evacuation plan with priority scores and road distance/travel time metrics (`?live=true\|false`). |
| `/route-geometry` | `GET` | High-resolution turn-by-turn highway route coordinates and transit duration between origin and destination. |
| `/simulate-disaster` | `GET` / `POST` | 0–60 min disaster progression projection (flood perimeter dilation, landslide shear probability, shelter load). |
| `/ai-explain` | `GET` / `POST` | Google Gemini AI Situational Intelligence briefing, zone priority justifications, and field directives (`?mode=live\|baseline`). |
| `/safezones/status` | `GET` | Real-time shelter occupancy, remaining headroom, fill percentages, and time-to-full ETAs. |
| `/safezones/update` | `POST` | Simulates shelter influx ticks or resets occupancy states (`{ "reset": true }`). |
| `/safezones/alternatives` | `GET` | Top $N$ nearest candidate safe havens with available capacity headroom ($> 10\%$). |
| `/safezones/multi-routes` | `GET` | Primary route and top 2 alternate evacuation routes with capacity stats and real highway geometry. |

---

## Mathematical and Operational Models

For complete mathematical equations, flood polygon dilation models, landslide soil saturation mechanics, real-world turn-by-turn highway physics, and the Gemini AI operational directive evaluation logic, see [`conditions.txt`](./conditions.txt).

---

## Team

- **Krishna Kaushal**
- **Mahi Singhal**
- **Saksham Gupta**
- **Keshav Totla**
- **Vikas Singh**
- **Nirmit Singh**

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
