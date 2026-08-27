import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import HazardMap from './components/HazardMap';
import StatsBar from './components/StatsBar';
import ZoneDetailsModal from './components/ZoneDetailsModal';
import DashboardPanel from './components/DashboardPanel';
import SimulationController from './components/SimulationController';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function App() {
  const [geoData, setGeoData] = useState(null);
  const [relocationPlan, setRelocationPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'map' | 'split'
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedZone, setSelectedZone] = useState(null);
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  // Disaster Simulation State
  const [simTimeStep, setSimTimeStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMetrics, setSimMetrics] = useState(null);
  const simIntervalRef = useRef(null);

  // Fetch both /zones and /relocation-plan from FastAPI backend
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [zonesRes, planRes] = await Promise.all([
        fetch(`${API_BASE_URL}/zones`),
        fetch(`${API_BASE_URL}/relocation-plan`),
      ]);

      if (!zonesRes.ok) {
        throw new Error(`Failed to fetch /zones (Status ${zonesRes.status})`);
      }
      if (!planRes.ok) {
        throw new Error(`Failed to fetch /relocation-plan (Status ${planRes.status})`);
      }

      const zonesData = await zonesRes.json();
      const planData = await planRes.json();

      setGeoData(zonesData);
      setRelocationPlan(planData);
    } catch (err) {
      console.error('Error fetching backend APIs:', err);
      setError(
        `Unable to connect to FastAPI backend at ${API_BASE_URL}. Ensure uvicorn is running.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch simulated disaster state for a specific time step t
  const handleSimulateStep = useCallback(async (step) => {
    try {
      const res = await fetch(`${API_BASE_URL}/simulate-disaster?t=${step}`);
      if (!res.ok) {
        throw new Error(`Simulation request failed: ${res.status}`);
      }
      const data = await res.json();
      setSimTimeStep(data.time_step);
      setGeoData(data.geo_data);
      setRelocationPlan(data.relocation_plan);
      setSimMetrics(data.metrics);
    } catch (err) {
      console.error('Error executing disaster simulation:', err);
    }
  }, []);

  // Handle Play, Pause, Reset simulation controls
  const handleStartSimulation = () => {
    setIsSimulating(true);
  };

  const handlePauseSimulation = () => {
    setIsSimulating(false);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }
  };

  const handleResetSimulation = () => {
    handlePauseSimulation();
    setSimTimeStep(0);
    handleSimulateStep(0);
  };

  // Automated step progression when simulation is playing
  useEffect(() => {
    if (isSimulating) {
      simIntervalRef.current = setInterval(() => {
        setSimTimeStep((prevStep) => {
          const nextStep = prevStep < 3 ? prevStep + 1 : 0;
          handleSimulateStep(nextStep);
          return nextStep;
        });
      }, 3500);
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    }

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, [isSimulating, handleSimulateStep]);

  // Compute live dataset analytics for quick stats and map legend
  const stats = useMemo(() => {
    if (!geoData || !geoData.features) {
      return {
        totalZones: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        safeZoneCount: 0,
        landslideCount: 0,
        floodCount: 0,
        totalPopulation: 0,
        totalCapacity: 0,
      };
    }

    const features = geoData.features;
    let high = 0;
    let medium = 0;
    let low = 0;
    let safe = 0;
    let landslides = 0;
    let floods = 0;
    let population = 0;
    let capacity = 0;

    features.forEach((f) => {
      const props = f.properties || {};
      if (props.safe) {
        safe += 1;
        capacity += Number(props.capacity) || 0;
      } else {
        const r = (props.risk || '').toLowerCase();
        if (r === 'high') high += 1;
        else if (r === 'medium') medium += 1;
        else if (r === 'low') low += 1;

        if (props.hazard_type === 'landslide') landslides += 1;
        if (props.hazard_type === 'flood') floods += 1;

        population += Number(props.population) || 0;
      }
    });

    return {
      totalZones: features.length,
      highRiskCount: high,
      mediumRiskCount: medium,
      lowRiskCount: low,
      safeZoneCount: safe,
      landslideCount: landslides,
      floodCount: floods,
      totalPopulation: population,
      totalCapacity: capacity,
    };
  }, [geoData]);

  return (
    <div className={`safeshift-app ${theme === 'light' ? 'light-theme' : 'dark-theme'}`}>
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="nav-brand">
          <div className="brand-icon">🛡️</div>
          <div>
            <div className="brand-title-wrap">
              <h1 className="brand-title">SafeShift</h1>
            </div>
            <p className="brand-subtitle">
              Multi-Hazard Spatial Relocation & Evacuation Intelligence
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="nav-view-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Analytics & Relocation
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            🗺️ GIS Map View
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'split' ? 'active' : ''}`}
            onClick={() => setActiveTab('split')}
          >
            ⚡ Split Command View
          </button>
        </div>

        {/* Theme Toggle & Status */}
        <div className="nav-status">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={
              theme === 'dark'
                ? 'Switch to Light Mode (Map becomes dark)'
                : 'Switch to Dark Mode'
            }
          >
            {theme === 'dark' ? '☀️ Light UI' : '🌙 Dark UI'}
          </button>

          <div className={`status-indicator ${error ? 'offline' : 'online'}`}>
            <span className="status-dot" />
            <span>{error ? 'API Offline' : 'FastAPI Connected'}</span>
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={fetchAllData}
            title="Sync Live GIS & Relocation Data"
          >
            🔄 Sync Data
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main">
        {loading && (
          <div className="map-loading-overlay">
            <div className="spinner" />
            <p>Loading multi-hazard spatial data & relocation routes...</p>
          </div>
        )}

        {error && !geoData && (
          <div className="map-error-banner">
            <div className="error-icon">⚠️</div>
            <div className="error-text">
              <h3>Backend Connection Notice</h3>
              <p>{error}</p>
              <button type="button" className="retry-btn" onClick={fetchAllData}>
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* 1. Dashboard Only View */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-scrollable-view">
            <DashboardPanel
              geoData={geoData}
              relocationPlan={relocationPlan}
              theme={theme}
            />
          </div>
        )}

        {/* 2. Map Only View */}
        {activeTab === 'map' && (
          <div className="map-full-view">
            <StatsBar
              stats={stats}
              selectedFilter={selectedFilter}
              onSelectFilter={setSelectedFilter}
              theme={theme}
            />
            <div className="map-view-container">
              <HazardMap
                geoData={geoData}
                relocationPlan={relocationPlan}
                stats={stats}
                selectedFilter={selectedFilter}
                onSelectZone={(zone) => setSelectedZone(zone)}
                theme={theme}
                simTimeStep={simTimeStep}
              />
              {selectedZone && (
                <ZoneDetailsModal
                  zone={selectedZone}
                  onClose={() => setSelectedZone(null)}
                  theme={theme}
                />
              )}
            </div>
          </div>
        )}

        {/* 3. Split Command Center View */}
        {activeTab === 'split' && (
          <div className="split-view-container">
            <div className="split-left-pane">
              <StatsBar
                stats={stats}
                selectedFilter={selectedFilter}
                onSelectFilter={setSelectedFilter}
                theme={theme}
              />
              <div className="map-view-container">
                <HazardMap
                  geoData={geoData}
                  relocationPlan={relocationPlan}
                  stats={stats}
                  selectedFilter={selectedFilter}
                  onSelectZone={(zone) => setSelectedZone(zone)}
                  theme={theme}
                  simTimeStep={simTimeStep}
                />
                {selectedZone && (
                  <ZoneDetailsModal
                    zone={selectedZone}
                    onClose={() => setSelectedZone(null)}
                    theme={theme}
                  />
                )}
              </div>
            </div>

            <div className="split-right-pane">
              <DashboardPanel
                geoData={geoData}
                relocationPlan={relocationPlan}
                theme={theme}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Disaster Simulation Dock */}
      <SimulationController
        timeStep={simTimeStep}
        isSimulating={isSimulating}
        onStartSimulation={handleStartSimulation}
        onPauseSimulation={handlePauseSimulation}
        onResetSimulation={handleResetSimulation}
        onSelectStep={(step) => {
          setIsSimulating(false);
          handleSimulateStep(step);
        }}
        simMetrics={simMetrics}
      />
    </div>
  );
}

export default App;
