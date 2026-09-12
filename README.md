# SafeShift  
### Multi-Hazard Spatial Relocation & Evacuation Intelligence System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0.0-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900.svg?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

SafeShift is an advanced geospatial emergency response system designed to optimize disaster evacuations in real time.

It combines:
- Live weather intelligence  
- Hazard terrain analysis  
- Mathematical optimization  
- Real-time shelter tracking  

The goal is to move people from danger to safety in the fastest and most efficient way possible.

---

## Why SafeShift?

Every year, disasters like floods and landslides displace millions.

Current systems:
- Fragmented across agencies  
- Lack real-time adaptability  
- Do not optimize evacuation routes  

SafeShift solves this by combining real-time data and optimization algorithms into one unified platform.

---

## Preview

(Add your screenshots inside an /assets folder and update paths below)

![Dashboard](./assets/dashboard.png)  
![Map](./assets/map.png)  
![Routes](./assets/routes.png)

---

## Key Features

- Live Meteorological Integration  
  Real-time weather via Open-Meteo API (rainfall, humidity, temperature)

- Dual Risk Modes  
  Live Mode: Dynamic risk based on rainfall thresholds  
  Baseline Mode: Terrain and historical vulnerability analysis  

- Optimization-Based Evacuation  
  Uses Linear Programming (scipy.optimize.linprog) to:
  - Minimize evacuation time  
  - Prevent shelter overload  

- Smart Shelter Management  
  - Live occupancy tracking  
  - Alerts at 70% and 90% capacity  
  - Time-to-full estimation  

- Multi-Route Safe Zone Finder  
  - Primary, secondary, fallback shelters  
  - Automatic rerouting  

- Real Road Routing  
  - OSRM-based highway paths  
  - Curved geometry routing  

- Command Center UI  
  - GIS map and analytics dashboard  
  - Live alerts and evacuation tables  

---

## What Makes It Unique?

- Combines weather, terrain, and optimization  
- Uses mathematical models instead of heuristics  
- Dynamic rerouting when shelters fill  
- Real-world road network routing  
- Designed as a decision-support system for authorities  

---

## Tech Stack

Frontend:
- React 18 (Vite)
- Leaflet (GIS Mapping)
- Recharts (Analytics)

Backend:
- FastAPI
- SciPy (Linear Programming)
- OSRM (Routing Engine)

Data Sources:
- Open-Meteo API
- GeoJSON (Hazard Zones and Shelters)

---

## System Architecture

Open-Meteo API (Weather)
        |
        v
   FastAPI Backend
 (Risk + Optimization)
     |         |
     v         v
 GeoJSON    OSRM Routing
 (Hazards)   (Roads)
     |
     v
 React + Leaflet UI
 (Command Center Dashboard)

---

## How It Works

1. User selects Live or Baseline Mode  
2. System fetches weather and hazard data  
3. Risk levels are calculated  
4. Optimization engine generates evacuation plan  
5. Shelters are monitored in real-time  
6. Alternate routes are triggered if needed  

---

## Mathematical Model

SafeShift models evacuation as a constrained optimization problem:

min Σ (c_ij * x_ij * P_i)

Subject to:
- Capacity constraints  
- Demand fulfillment  
- Non-negativity  

In simple terms:
- Move people from danger to safety  
- Minimize travel time  
- Avoid overcrowding  

---

## Project Structure

SafeShift/
│
├── backend/
│   ├── main.py
│   ├── routing.py
│   ├── safezone_service.py
│   ├── simulation.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/components/
│   ├── src/utils/
│   ├── App.jsx
│   └── vite.config.js
│
├── data/
│   ├── india_hazard_zones.geojson
│   └── relocation_sites.geojson
│
└── README.md

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.10 or higher)
- Git

---

### Backend Setup (FastAPI)

cd backend

python -m venv venv  
.\venv\Scripts\activate   (Windows)  
# source venv/bin/activate   (macOS/Linux)

pip install -r requirements.txt  

uvicorn main:app --reload --port 8000  

Backend runs on: http://127.0.0.1:8000  
Docs: http://127.0.0.1:8000/docs  

---

### Frontend Setup

cd frontend  

npm install  
npm run dev  

Open: http://localhost:5173  

---

## API Endpoints

| Endpoint | Method | Description |
|--------|--------|------------|
| /zones/live | GET | Live hazard zones |
| /relocation-plan | GET | Optimized evacuation |
| /weather-impact | GET | Weather summary |
| /route-geometry | GET | Road routes |
| /safezones/status | GET | Shelter capacity |
| /safezones/multi-routes | GET | Alternate shelters |
| /safezones/update | POST | Update capacity |

---

## Future Scope

- AI-based evacuation prediction  
- IoT and drone integration  
- Mobile application  
- SMS alert system  
- Government API integration  

---

## Deployment

- Frontend: Vercel or Netlify  
- Backend: Render or Railway  
- OSRM: Docker or cloud hosting  

---

## Team

Team Name: (update this)

- Krishna Kaushal  
- Mahi Singhal  
- Saksham Gupta
- Keshav Totla
- Vikas Singh
- Nirmit Singh

---

## License

This project is licensed under the MIT License.

---

## Support

If you find this project useful:
- Star the repository  
- Share it  
- Contribute improvements  

---
