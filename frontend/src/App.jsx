import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import HazardMap from './components/HazardMap';
import StatsBar from './components/StatsBar';
import ZoneDetailsModal from './components/ZoneDetailsModal';
import DashboardPanel from './components/DashboardPanel';
import CommandCenterEntry from './components/CommandCenterEntry';
import SafeShiftLogo from './components/SafeShiftLogo';
import SmartAlertBanner from './components/SmartAlertBanner';
import CapacityToastStack from './components/CapacityToastStack';
import AlternateRoutesModal from './components/AlternateRoutesModal';
import SafeZoneCapacityPage from './components/SafeZoneCapacityPage';
import LandingPage from './components/LandingPage';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8005';

function App() {
  // Application View Mode: 'landing' (flagship landing page) | 'setup' (config screen) | 'command' (live operations center)
  const [appMode, setAppMode] = useState('landing');

  const [geoData, setGeoData] = useState(null);
  const [relocationPlan, setRelocationPlan] = useState([]);
  const [weatherMeta, setWeatherMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('split'); // 'split' (default command landing view) | 'dashboard' | 'capacity' | 'map'
  const [selectedFilters, setSelectedFilters] = useState(['all']); // Multi-select filter layer

  const [selectedZone, setSelectedZone] = useState(null);
  const [locateTarget, setLocateTarget] = useState(null);
  const [theme, setTheme] = useState('light'); // 'light' (default bright) | 'dark'
  const [riskMode, setRiskMode] = useState('baseline'); // 'baseline' (historical vulnerability) | 'live' (weather predicted)
  const [dismissedAlerts, setDismissedAlerts] = useState(false);

  // Safe Zone Live Capacity & Alternate Routing State
  const [safeZoneStatus, setSafeZoneStatus] = useState(null);
  const [autoRerouteEnabled, setAutoRerouteEnabled] = useState(true);
  const [activeMultiRoutes, setActiveMultiRoutes] = useState(null);
  const [selectedMultiRouteChoice, setSelectedMultiRouteChoice] = useState('primary');
  const [showAltRoutesModal, setShowAltRoutesModal] = useState(false);

  // Detailed Highway Routing State (On-Demand Curved Polyline)
  const [activeDetailedRoute, setActiveDetailedRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const routeAbortControllerRef = useRef(null);
  const routeGeometryCacheRef = useRef({});

  // Explicit Zone Location Action (Zooms on map when Locate on Map / Inspect Zone is clicked)
  const handleLocateZone = (zoneProps) => {
    if (!zoneProps) return;
    setSelectedZone(zoneProps);
    setLocateTarget({
      zone: zoneProps,
      timestamp: Date.now(),
    });
    if (activeTab === 'dashboard') {
      setActiveTab('map');
    }
  };

  // Fetch Safe Zone Real-Time Status & Influx Simulation
  const fetchSafeZoneStatus = useCallback(async (autoTick = true) => {
    try {
      const res = await fetch(`${API_BASE_URL}/safezones/status?auto_tick=${autoTick}`);
      if (res.ok) {
        const data = await res.json();
        setSafeZoneStatus(data);
      }
    } catch (err) {
      console.warn('Could not sync safe zone capacity:', err);
    }
  }, []);

  // Reset Capacity Simulation
  const handleResetCapacitySimulation = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/safezones/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSafeZoneStatus(data);
      }
    } catch (err) {
      console.warn('Could not reset safe zone capacities:', err);
    }
  };

  // Trigger Multi-Route Alternate Finder
  const handleViewAlternateRoutes = async (targetInfo) => {
    if (!targetInfo) return;

    // Find origin hazard zone or match
    let originZone = null;
    let matchedPlan = relocationPlan.find((p) => p.to === targetInfo.name);

    if (matchedPlan) {
      originZone = {
        name: matchedPlan.from,
        lat: matchedPlan.origin_coords ? matchedPlan.origin_coords[0] : targetInfo.lat,
        lon: matchedPlan.origin_coords ? matchedPlan.origin_coords[1] : targetInfo.lon,
      };
    } else if (geoData?.features) {
      const hazardFeat = geoData.features.find((f) => !f.properties?.safe);
      if (hazardFeat && hazardFeat.geometry) {
        const p = hazardFeat.properties || {};
        originZone = {
          name: p.area_name || 'Active Hazard Zone',
          lat: p.centroid_lat || 20.59,
          lon: p.centroid_lon || 78.96,
        };
      }
    }

    const oLat = originZone?.lat || 28.61;
    const oLon = originZone?.lon || 77.20;
    const oName = originZone?.name || 'Hazard Origin';
    const dLat = targetInfo.lat || 28.70;
    const dLon = targetInfo.lon || 77.10;
    const dName = targetInfo.name || 'Safe Haven';

    try {
      setLoadingRoute(true);
      const url = `${API_BASE_URL}/safezones/multi-routes?origin_lat=${oLat}&origin_lon=${oLon}&origin_name=${encodeURIComponent(oName)}&dest_lat=${dLat}&dest_lon=${dLon}&dest_name=${encodeURIComponent(dName)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActiveMultiRoutes(data);
        setSelectedMultiRouteChoice('primary');
        setShowAltRoutesModal(true);
        if (activeTab === 'dashboard') {
          setActiveTab('map');
        }
      }
    } catch (err) {
      console.error('Error fetching multi-routes:', err);
    } finally {
      setLoadingRoute(false);
    }
  };

  // Switch Active Corridor
  const handleSelectMultiRouteChoice = (choiceId, routeObj) => {
    setSelectedMultiRouteChoice(choiceId);
    if (routeObj) {
      setActiveDetailedRoute({
        coordinates: routeObj.coordinates,
        distance_km: routeObj.distance_km,
        travel_time_min: routeObj.travel_time_min,
        from: activeMultiRoutes?.origin?.name || 'Hazard Origin',
        to: routeObj.name,
      });
    }
  };

  // Apply Alternative Safe Zone Rerouting
  const handleApplyReroute = (selectedChoice) => {
    if (!selectedChoice) return;
    const origHaven = activeMultiRoutes?.primary?.name;
    const newHaven = selectedChoice.name;

    setRelocationPlan((prevPlan) =>
      prevPlan.map((item) => {
        if (item.to === origHaven) {
          return {
            ...item,
            effectiveDest: newHaven,
            effectiveDestCoords: selectedChoice.dest_coords,
            distance_km: selectedChoice.distance_km,
            travel_time_min: selectedChoice.travel_time_min,
            rerouted: true,
          };
        }
        return item;
      })
    );
    setShowAltRoutesModal(false);
  };

  // Fetch all core datasets
  const fetchAllData = async (forceRefreshWeather = false) => {
    try {
      setLoading(true);
      if (forceRefreshWeather) setIsRefreshingWeather(true);
      setError(null);

      const [zonesRes, impactRes] = await Promise.all([
        fetch(`${API_BASE_URL}/zones/live?refresh=${forceRefreshWeather}`),
        fetch(`${API_BASE_URL}/weather-impact?refresh=${forceRefreshWeather}`),
      ]);

      if (!zonesRes.ok) throw new Error(`Zones API error: ${zonesRes.status}`);
      if (!impactRes.ok) throw new Error(`Weather Impact API error: ${impactRes.status}`);

      const zonesData = await zonesRes.json();
      const impactData = await impactRes.json();

      setGeoData(zonesData);
      setWeatherMeta(impactData);

      const isLive = riskMode === 'live';
      const planRes = await fetch(`${API_BASE_URL}/relocation-plan?live=${isLive}`);
      if (planRes.ok) {
        const planData = await planRes.json();
        setRelocationPlan(planData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load disaster data');
    } finally {
      setLoading(false);
      setIsRefreshingWeather(false);
    }
  };

  // Sync Relocation Plan when Risk Mode is toggled
  useEffect(() => {
    const syncPlanForMode = async () => {
      try {
        const isLive = riskMode === 'live';
        const res = await fetch(`${API_BASE_URL}/relocation-plan?live=${isLive}`);
        if (res.ok) {
          const planData = await res.json();
          setRelocationPlan(planData);
        }
      } catch (err) {
        console.warn('Could not sync relocation plan for riskMode:', riskMode, err);
      }
    };
    syncPlanForMode();
  }, [riskMode]);

  useEffect(() => {
    fetchAllData(false);
    fetchSafeZoneStatus(false);

    // Live capacity tick polling every 4 seconds (4000 ms)
    const capacityTimer = setInterval(() => {
      fetchSafeZoneStatus(true);
    }, 4000);

    // Auto-refresh live meteorological data every 10 minutes (600,000 ms)
    const autoRefreshTimer = setInterval(() => {
      fetchAllData(false);
    }, 600000);

    return () => {
      clearInterval(capacityTimer);
      clearInterval(autoRefreshTimer);
    };
  }, [fetchSafeZoneStatus]);



  // On-Demand Highway Route Tracing handler with Instant Preview, Caching, and In-Flight Request Cancellation
  const handleTraceRoute = async (routeItem) => {
    if (!routeItem) return;

    let originCoords = routeItem.origin_coords;
    let destCoords = routeItem.effectiveDestCoords || routeItem.dest_coords;

    // Fallback: Resolve origin coordinates from geoData features if missing
    if (!originCoords && geoData?.features && routeItem.from) {
      const origFeat = geoData.features.find((f) => f.properties?.area_name === routeItem.from);
      if (origFeat) {
        originCoords = [origFeat.properties?.centroid_lat, origFeat.properties?.centroid_lon];
      }
    }

    // Fallback: Resolve destination coordinates from geoData features if missing
    if (!destCoords && geoData?.features && (routeItem.effectiveDest || routeItem.to)) {
      const targetName = routeItem.effectiveDest || routeItem.to;
      const destFeat = geoData.features.find((f) => f.properties?.area_name === targetName);
      if (destFeat) {
        destCoords = [destFeat.properties?.centroid_lat, destFeat.properties?.centroid_lon];
      }
    }

    if (!originCoords || !destCoords || !originCoords[0] || !destCoords[0]) {
      console.warn('Could not determine valid coordinates for route tracing:', routeItem);
      return;
    }

    // 1. Immediately cancel any previous in-flight route fetch to eliminate buffering and race conditions
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    routeAbortControllerRef.current = abortController;

    const [origin_lat, origin_lon] = originCoords;
    const [dest_lat, dest_lon] = destCoords;
    const cacheKey = `${origin_lat.toFixed(4)}_${origin_lon.toFixed(4)}_${dest_lat.toFixed(4)}_${dest_lon.toFixed(4)}`;
    const fromName = routeItem.from;
    const toName = routeItem.effectiveDest || routeItem.to;

    // 2. Check client-side memory cache for instantaneous zero-latency render
    if (routeGeometryCacheRef.current[cacheKey]) {
      const cached = routeGeometryCacheRef.current[cacheKey];
      setActiveDetailedRoute({
        ...cached,
        from: fromName,
        to: toName,
      });
      setLoadingRoute(false);
      if (activeTab === 'dashboard' || activeTab === 'capacity') {
        setActiveTab('split');
      }
      return;
    }

    // 3. Switch to split view if currently in standalone dashboard/capacity
    if (activeTab === 'dashboard' || activeTab === 'capacity') {
      setActiveTab('split');
    }

    setLoadingRoute(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/route-geometry?origin_lat=${origin_lat}&origin_lon=${origin_lon}&dest_lat=${dest_lat}&dest_lon=${dest_lon}`,
        { signal: abortController.signal }
      );
      if (!res.ok) throw new Error(`Failed to fetch route geometry (${res.status})`);
      const data = await res.json();

      // Only apply update if this specific request is still the active one
      if (!abortController.signal.aborted) {
        routeGeometryCacheRef.current[cacheKey] = data;
        setActiveDetailedRoute({
          ...data,
          from: fromName,
          to: toName,
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching highway route geometry:', err);
        // Fallback on hard network error
        setActiveDetailedRoute({
          coordinates: [
            [origin_lat, origin_lon],
            [dest_lat, dest_lon],
          ],
          distance_km: routeItem.distance_km || Math.round(Math.hypot(dest_lat - origin_lat, dest_lon - origin_lon) * 111),
          travel_time_min: routeItem.travel_time_min || Math.round(((routeItem.distance_km || 100) / 50) * 60),
          from: fromName,
          to: toName,
          source: 'Direct Evacuation Corridor',
        });
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoadingRoute(false);
      }
    }
  };

  const handleClearDetailedRoute = () => {
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }
    setActiveDetailedRoute(null);
    setLoadingRoute(false);
  };

  // Multi-Selection Filter Toggle Logic
  const handleToggleFilter = (filterId) => {
    if (filterId === 'all') {
      // If All Zones is clicked, deselect all other filters
      setSelectedFilters(['all']);
      return;
    }

    setSelectedFilters((prev) => {
      // Remove 'all' when a specific filter is clicked
      let updated = prev.filter((f) => f !== 'all');

      if (updated.includes(filterId)) {
        // Toggle off if already selected
        updated = updated.filter((f) => f !== filterId);
      } else {
        // Toggle on if not selected
        updated = [...updated, filterId];
      }

      // If all specific filters are toggled off, default back to 'all'
      if (updated.length === 0) {
        return ['all'];
      }
      return updated;
    });
  };

  // Transition from Entry/Setup Screen to Split Command Center with selected initial configuration
  const handleEnterCommandCenter = ({ scenario, region, riskMode: initialMode }) => {
    if (scenario) {
      setSelectedFilters(scenario === 'all' ? ['all'] : [scenario]);
    }
    if (initialMode) {
      setRiskMode(initialMode);
    }
    setActiveTab('split'); // <--- Set landing page to Split Command View
    setAppMode('command');
  };

  // Compute live dataset analytics for quick stats and map legend based on active riskMode
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
        // Select risk according to active riskMode
        const r = (
          riskMode === 'baseline'
            ? (props.baseline_risk || props.risk || '')
            : (props.risk || props.baseline_risk || '')
        ).toLowerCase();

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
  }, [geoData, riskMode]);

  // 1. Render Flagship Landing Page
  if (appMode === 'landing') {
    return (
      <LandingPage
        onLaunchCommandCenter={() => {
          setActiveTab('split');
          setAppMode('command');
        }}
        onOpenSetup={() => setAppMode('setup')}
        isApiOnline={!error && Boolean(geoData)}
      />
    );
  }

  // 2. Render Mission Configuration / Setup Screen
  if (appMode === 'setup') {
    return (
      <CommandCenterEntry
        onEnterCommandCenter={handleEnterCommandCenter}
        onBackToHome={() => setAppMode('landing')}
        initialScenario={selectedFilters.includes('all') ? 'all' : selectedFilters[0]}
        initialRiskMode={riskMode}
        isApiOnline={!error && Boolean(geoData)}
      />
    );
  }

  const smartAlerts = weatherMeta?.smart_alerts || [];
  const hasActiveSmartAlerts = smartAlerts.length > 0 && !dismissedAlerts;

  return (
    <div className={`safeshift-app ${theme === 'light' ? 'light-theme' : 'dark-theme'}`}>
      {/* Top Navbar */}
      <header className="app-navbar">
        <div
          className="nav-brand"
          onClick={() => setAppMode('landing')}
          style={{ cursor: 'pointer' }}
          title="Return to SafeShift Homepage"
        >
          <SafeShiftLogo iconOnly size={34} />
          <div>
            <div className="brand-title-wrap">
              <h1 className="brand-title">
                <span className="brand-title-navy">Safe</span>
                <span className="brand-title-green">Shift</span>
              </h1>
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
            Analytics & Relocation
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'capacity' ? 'active' : ''}`}
            onClick={() => setActiveTab('capacity')}
          >
            Shelter Capacities
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            GIS Map View
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'split' ? 'active' : ''}`}
            onClick={() => setActiveTab('split')}
          >
            Split Command View
          </button>
        </div>

        {/* Theme Toggle, Status & Exit to Config */}
        <div className="nav-status">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={
              theme === 'dark'
                ? 'Switch to Light Mode'
                : 'Switch to Dark Mode'
            }
          >
            {theme === 'dark' ? 'Light UI' : 'Dark UI'}
          </button>

          <div className={`status-indicator ${error ? 'offline' : 'online'}`}>
            <span className="status-dot" />
            <span>{error ? 'API Offline' : 'FastAPI Live'}</span>
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={() => fetchAllData(true)}
            disabled={isRefreshingWeather}
            title="Sync live Open-Meteo weather & recompute risks"
          >
            {isRefreshingWeather ? 'Syncing...' : 'Sync Weather'}
          </button>

          <button
            type="button"
            className="config-exit-btn"
            onClick={() => setAppMode('setup')}
            title="Configure Region & Risk Mode Setup"
          >
            Setup
          </button>

          <button
            type="button"
            className="config-exit-btn"
            onClick={() => setAppMode('landing')}
            title="Return to SafeShift Landing Page"
            style={{
              background: theme === 'dark' ? '#334155' : '#f1f5f9',
              color: theme === 'dark' ? '#f8fafc' : '#1e293b',
              borderColor: theme === 'dark' ? '#475569' : '#cbd5e1',
            }}
          >
            Landing
          </button>
        </div>
      </header>

      {/* Modern Smart Alert Notification System */}
      <SmartAlertBanner
        geoData={geoData}
        weatherMeta={weatherMeta}
        onLocateZone={handleLocateZone}
        onSelectZone={handleLocateZone}
        onViewAlternateRoutes={handleViewAlternateRoutes}
        riskMode={riskMode}
      />

      {/* Main Container */}
      <main className="app-main">
        {loading && !geoData && (
          <div className="map-loading-overlay">
            <div className="spinner" />
            <p>Loading multi-hazard spatial data & real-time weather predictions...</p>
          </div>
        )}

        {error && !geoData && (
          <div className="map-error-banner">
            <div className="error-icon">!</div>
            <div className="error-text">
              <h3>Backend Connection Notice</h3>
              <p>{error}</p>
              <button type="button" className="retry-btn" onClick={() => fetchAllData(true)}>
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* 1. Analytics & Relocation Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-scrollable-view">
            <DashboardPanel
              geoData={geoData}
              relocationPlan={relocationPlan}
              theme={theme}
              riskMode={riskMode}
              onTraceRoute={handleTraceRoute}
              onLocateZone={handleLocateZone}
            />
          </div>
        )}

        {/* 2. Dedicated Safe Zone Capacity & Rerouting Operations Page */}
        {activeTab === 'capacity' && (
          <div className="dashboard-scrollable-view">
            <SafeZoneCapacityPage
              safeZoneStatus={safeZoneStatus}
              geoData={geoData}
              relocationPlan={relocationPlan}
              riskMode={riskMode}
              onViewAlternateRoutes={handleViewAlternateRoutes}
              onLocateZone={handleLocateZone}
              onTraceRoute={handleTraceRoute}
              onApplyReroute={handleApplyReroute}
              autoRerouteEnabled={autoRerouteEnabled}
              onToggleAutoReroute={() => setAutoRerouteEnabled(!autoRerouteEnabled)}
              onResetCapacitySimulation={handleResetCapacitySimulation}
              theme={theme}
            />
          </div>
        )}

        {/* 3. Map Only View */}
        {activeTab === 'map' && (
          <div className="map-full-view">
            <StatsBar
              stats={stats}
              selectedFilters={selectedFilters}
              onToggleFilter={handleToggleFilter}
              theme={theme}
              weatherMeta={weatherMeta}
              onRefreshWeather={fetchAllData}
              isRefreshingWeather={isRefreshingWeather}
              riskMode={riskMode}
              onToggleRiskMode={setRiskMode}
            />
            <div className="map-view-container">
              <HazardMap
                geoData={geoData}
                relocationPlan={relocationPlan}
                stats={stats}
                selectedFilters={selectedFilters}
                onSelectZone={(zone) => setSelectedZone(zone)}
                theme={theme}
                activeDetailedRoute={activeDetailedRoute}
                onClearDetailedRoute={handleClearDetailedRoute}
                riskMode={riskMode}
                selectedZone={selectedZone}
                locateTarget={locateTarget}
                safeZoneStatus={safeZoneStatus}
                activeMultiRoutes={activeMultiRoutes}
                selectedRouteId={selectedMultiRouteChoice}
                onSelectMultiRouteChoice={handleSelectMultiRouteChoice}
                onClearMultiRoutes={() => setActiveMultiRoutes(null)}
              />
              {selectedZone && (
                <ZoneDetailsModal
                  zone={selectedZone}
                  onClose={() => setSelectedZone(null)}
                  relocationPlan={relocationPlan}
                  onTraceRoute={handleTraceRoute}
                  activeDetailedRoute={activeDetailedRoute}
                  onClearRoute={handleClearDetailedRoute}
                  loadingRoute={loadingRoute}
                  theme={theme}
                  riskMode={riskMode}
                />
              )}
            </div>
          </div>
        )}

        {/* 4. Split Command Center View */}
        {activeTab === 'split' && (
          <div className="split-view-container">
            <div className="split-left-pane">
              <StatsBar
                stats={stats}
                selectedFilters={selectedFilters}
                onToggleFilter={handleToggleFilter}
                theme={theme}
                weatherMeta={weatherMeta}
                onRefreshWeather={fetchAllData}
                isRefreshingWeather={isRefreshingWeather}
                riskMode={riskMode}
                onToggleRiskMode={setRiskMode}
              />
              <div className="map-view-container">
                <HazardMap
                  geoData={geoData}
                  relocationPlan={relocationPlan}
                  stats={stats}
                  selectedFilters={selectedFilters}
                  onSelectZone={(zone) => setSelectedZone(zone)}
                  theme={theme}
                  activeDetailedRoute={activeDetailedRoute}
                  onClearDetailedRoute={handleClearDetailedRoute}
                  riskMode={riskMode}
                  selectedZone={selectedZone}
                  locateTarget={locateTarget}
                  safeZoneStatus={safeZoneStatus}
                  activeMultiRoutes={activeMultiRoutes}
                  selectedRouteId={selectedMultiRouteChoice}
                  onSelectMultiRouteChoice={handleSelectMultiRouteChoice}
                  onClearMultiRoutes={() => setActiveMultiRoutes(null)}
                />
                {selectedZone && (
                  <ZoneDetailsModal
                    zone={selectedZone}
                    onClose={() => setSelectedZone(null)}
                    relocationPlan={relocationPlan}
                    onTraceRoute={handleTraceRoute}
                    activeDetailedRoute={activeDetailedRoute}
                    onClearRoute={handleClearDetailedRoute}
                    loadingRoute={loadingRoute}
                    theme={theme}
                    riskMode={riskMode}
                  />
                )}
              </div>
            </div>

            <div className="split-right-pane">
              <DashboardPanel
                geoData={geoData}
                relocationPlan={relocationPlan}
                theme={theme}
                riskMode={riskMode}
                safeZoneStatus={safeZoneStatus}
                onTraceRoute={handleTraceRoute}
                onLocateZone={handleLocateZone}
                onViewAlternateRoutes={handleViewAlternateRoutes}
                autoRerouteEnabled={autoRerouteEnabled}
                onToggleAutoReroute={() => setAutoRerouteEnabled(!autoRerouteEnabled)}
                onResetCapacitySimulation={handleResetCapacitySimulation}
              />
            </div>
          </div>
        )}
      </main>

      {/* Stacked Live Shelter Capacity Warnings */}
      <CapacityToastStack
        alerts={safeZoneStatus?.capacity_alerts || []}
        onViewAlternateRoutes={handleViewAlternateRoutes}
        onLocateZone={handleLocateZone}
        theme={theme}
      />

      {/* Multi-Route Alternate Safe Haven Modal */}
      {showAltRoutesModal && activeMultiRoutes && (
        <AlternateRoutesModal
          multiRoutesData={activeMultiRoutes}
          selectedRouteId={selectedMultiRouteChoice}
          onSelectRoute={handleSelectMultiRouteChoice}
          onApplyReroute={handleApplyReroute}
          onClose={() => setShowAltRoutesModal(false)}
          theme={theme}
        />
      )}
    </div>
  );
}

export default App;

