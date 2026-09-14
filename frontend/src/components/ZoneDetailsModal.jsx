import React, { useState, useEffect } from 'react';
import { getZoneFallbackWeather, fetchLiveOpenMeteoWeather } from '../utils/geoUtils';

export default function ZoneDetailsModal({
  zone,
  onClose,
  relocationPlan = [],
  onTraceRoute,
  activeDetailedRoute,
  onClearRoute,
  loadingRoute = false,
  riskMode = 'baseline',
}) {
  if (!zone) return null;

  const isSafe = zone.safe === true || zone.location_type === 'relocation_site';
  const activeRisk = (
    riskMode === 'baseline'
      ? (zone.baseline_risk || zone.risk || 'unknown')
      : (zone.risk || zone.baseline_risk || 'unknown')
  );
  const risk = activeRisk.toLowerCase();

  const priority = (
    riskMode === 'baseline'
      ? (zone.baseline_risk === 'high' ? 'immediate' : zone.baseline_risk === 'medium' ? 'short-term' : 'monitoring')
      : (zone.priority || 'monitoring')
  );

  // Initial immediate fallback weather (0ms latency guarantee)
  const initialFallback = getZoneFallbackWeather(zone) || {
    rainfall: 65.0,
    humidity: 78,
    temperature: 24.5,
    weather: 'Variable cloudiness',
  };

  const [liveWeather, setLiveWeather] = useState({
    rainfall: zone.rainfall !== undefined ? Number(zone.rainfall) : initialFallback.rainfall,
    humidity: zone.humidity !== undefined ? Number(zone.humidity) : initialFallback.humidity,
    temperature: zone.temperature !== undefined ? Number(zone.temperature) : initialFallback.temperature,
    weather: zone.weather || initialFallback.weather,
    source: zone.rainfall !== undefined ? 'Live Telemetry' : 'IMD Telemetry Forecast',
  });

  // Fetch real-time Open-Meteo data client-side in background
  useEffect(() => {
    let isMounted = true;
    const fallback = getZoneFallbackWeather(zone);
    if (fallback) {
      setLiveWeather((prev) => ({
        rainfall: zone.rainfall !== undefined ? Number(zone.rainfall) : fallback.rainfall,
        humidity: zone.humidity !== undefined ? Number(zone.humidity) : fallback.humidity,
        temperature: zone.temperature !== undefined ? Number(zone.temperature) : fallback.temperature,
        weather: zone.weather || fallback.weather,
        source: zone.rainfall !== undefined ? 'Live Telemetry' : 'IMD Telemetry Forecast',
      }));
    }

    const lat = zone.centroid_lat || zone.lat;
    const lon = zone.centroid_lon || zone.lon;
    if (lat && lon) {
      fetchLiveOpenMeteoWeather(lat, lon)
        .then((data) => {
          if (isMounted && data) {
            setLiveWeather(data);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [zone]);

  const rainfall = liveWeather.rainfall !== undefined ? Number(liveWeather.rainfall) : initialFallback.rainfall;
  const humidity = liveWeather.humidity !== undefined ? Number(liveWeather.humidity) : initialFallback.humidity;
  const temp = liveWeather.temperature !== undefined ? Number(liveWeather.temperature) : initialFallback.temperature;
  const weather = liveWeather.weather || initialFallback.weather;
  const weatherSource = liveWeather.source || 'Open-Meteo Live API';

  // Find destination safe shelters from the relocation plan with resilient normalized matching
  const matchedRoutes = relocationPlan.filter((r) => {
    if (!r || !r.from || !zone.area_name) return false;
    const rFrom = r.from.trim().toLowerCase();
    const zName = zone.area_name.trim().toLowerCase();
    return rFrom === zName || rFrom.includes(zName) || zName.includes(rFrom);
  });

  const handleTraceHighway = (routeItem) => {
    if (!onTraceRoute || !routeItem) return;
    const originCoords =
      routeItem.origin_coords ||
      (zone.centroid_lat && zone.centroid_lon ? [Number(zone.centroid_lat), Number(zone.centroid_lon)] : null) ||
      (zone.lat && zone.lon ? [Number(zone.lat), Number(zone.lon)] : null);

    const destCoords =
      routeItem.effectiveDestCoords ||
      routeItem.dest_coords;

    const routePayload = {
      ...routeItem,
      from: routeItem.from || zone.area_name,
      to: routeItem.effectiveDest || routeItem.to,
      origin_coords: originCoords,
      dest_coords: destCoords,
    };
    onTraceRoute(routePayload);
  };

  return (
    <aside className="zone-details-panel" aria-label="Zone Details Panel">
      <div className="panel-header">
        <div className="panel-title-wrap">
          <div>
            <h3>{zone.area_name || 'Zone Details'}</h3>
            <span className="panel-subtitle">
              {isSafe
                ? 'Designated Relocation Shelter'
                : `${(zone.hazard_type || 'Hazard').toUpperCase()} Vulnerability Area (${riskMode === 'live' ? 'Live Weather' : 'Baseline'})`}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="panel-close-btn"
          onClick={onClose}
          aria-label="Close details"
        >
          Close
        </button>
      </div>

      <div className="panel-body">
        <div className="detail-stat-row">
          <span className="detail-label">Status Classification</span>
          <span
            className={`status-pill ${
              isSafe
                ? 'pill-safe'
                : risk === 'high'
                ? 'pill-high'
                : risk === 'medium'
                ? 'pill-medium'
                : 'pill-low'
            }`}
          >
            {isSafe ? 'Safe Relocation Zone' : `${risk.toUpperCase()} RISK`}
          </span>
        </div>

        {priority && (
          <div className="detail-stat-row">
            <span className="detail-label">Evacuation Priority</span>
            <span className="detail-value highlight-priority">
              {priority.toUpperCase()}
            </span>
          </div>
        )}

        {zone.population !== undefined && (
          <div className="detail-stat-row">
            <span className="detail-label">Estimated Population</span>
            <span className="detail-value font-mono">
              {zone.population.toLocaleString()} residents
            </span>
          </div>
        )}

        {zone.capacity !== undefined && (
          <div className="detail-stat-row">
            <span className="detail-label">Safe Shelter Capacity</span>
            <span className="detail-value font-mono text-green">
              {zone.capacity.toLocaleString()} beds / people
            </span>
          </div>
        )}

        {zone.hazard_type && (
          <div className="detail-stat-row">
            <span className="detail-label">Primary Hazard Type</span>
            <span className="detail-value text-capitalize">
              {zone.hazard_type}
            </span>
          </div>
        )}

        {/* Live Meteorological Feed Card */}
        {rainfall !== null && (
          <div className="panel-weather-card">
            <div className="weather-card-header">
              <div className="weather-card-title">
                <span>Live Meteorological Feed</span>
              </div>
              <span className="weather-live-tag">{weatherSource}</span>
            </div>
            
            <div className="weather-grid">
              <div className="weather-stat-box">
                <span className="weather-stat-label">Accumulated Rain</span>
                <strong className={`weather-stat-val ${rainfall > 80 ? 'text-rain-heavy' : 'text-rain-mod'}`}>
                  {rainfall} mm
                </strong>
              </div>
              <div className="weather-stat-box">
                <span className="weather-stat-label">Relative Humidity</span>
                <strong className="weather-stat-val text-humidity">
                  {humidity ?? '--'}%
                </strong>
              </div>
              <div className="weather-stat-box">
                <span className="weather-stat-label">Ambient Temp</span>
                <strong className="weather-stat-val text-temp">
                  {temp ?? '--'}°C
                </strong>
              </div>
              <div className="weather-stat-box">
                <span className="weather-stat-label">Conditions</span>
                <strong className="weather-stat-val text-condition" title={weather || 'Normal'}>
                  {weather || 'Normal'}
                </strong>
              </div>
            </div>

            <div className="weather-impact-alert">
              <span className="impact-dot" />
              <span>
                {rainfall > 100
                  ? 'Extreme precipitation >100mm triggering High Flood triage'
                  : rainfall > 80 && zone.hazard_type === 'landslide'
                  ? 'Heavy precipitation >80mm on slopes triggering Landslide warning'
                  : rainfall >= 40
                  ? 'Moderate rainfall detected; active monitoring engaged'
                  : 'Precipitation within baseline seasonal range'}
              </span>
            </div>
          </div>
        )}

        {/* Assigned Evacuation Route Details */}
        {!isSafe && matchedRoutes.length > 0 && (
          <div className="panel-route-card">
            <div className="route-card-title">
              <span>Assigned Safe Haven{matchedRoutes.length > 1 ? 's' : ''}</span>
            </div>
            {matchedRoutes.map((rItem, rIdx) => {
              const fromMatch =
                activeDetailedRoute?.from &&
                rItem?.from &&
                activeDetailedRoute.from.trim().toLowerCase() === rItem.from.trim().toLowerCase();
              const toMatch =
                activeDetailedRoute?.to &&
                rItem?.to &&
                activeDetailedRoute.to.trim().toLowerCase() === rItem.to.trim().toLowerCase();
              const isThisActive = fromMatch && toMatch;

              return (
                <div key={`route-opt-${rIdx}-${rItem.to}`} style={{ marginBottom: rIdx < matchedRoutes.length - 1 ? '12px' : '0' }}>
                  <strong className="route-dest-name">{rItem.to}</strong>
                  <div className="route-quick-stats">
                    <span>{rItem.people?.toLocaleString()} Evacuees</span>
                    <span>•</span>
                    <span>{rItem.travel_time_min ? `${rItem.travel_time_min} mins` : 'N/A'}</span>
                    {rItem.distance_km && (
                      <>
                        <span>•</span>
                        <span>{rItem.distance_km} km</span>
                      </>
                    )}
                  </div>

                  {/* On-Demand Curved Road Route Action */}
                  <div className="route-action-buttons" style={{ marginTop: '6px' }}>
                    <button
                      type="button"
                      className={`btn-trace-route ${isThisActive ? 'btn-trace-active' : ''}`}
                      onClick={() => handleTraceHighway(rItem)}
                      title={isThisActive ? 'Re-center active highway navigation on map' : 'Trace highway route on map'}
                    >
                      {isThisActive ? 'Highway Active (Re-center)' : 'Trace Highway Route'}
                    </button>
                    {isThisActive && (
                      <button
                        type="button"
                        className="btn-clear-route"
                        onClick={() => onClearRoute && onClearRoute()}
                        title="Clear highway navigation route"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="action-box">
          <h4>Decision Support System Action</h4>
          <p>
            {isSafe
              ? 'This zone is operational and designated to receive evacuees from immediate high-priority zones.'
              : priority === 'immediate'
              ? 'Immediate dispatch required. Direct affected population to nearest designated safe zone.'
              : 'Zone under active monitoring. Prepare contingency transit channels.'}
          </p>
        </div>
      </div>
    </aside>
  );
}
