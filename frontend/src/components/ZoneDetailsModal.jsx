import React, { useState, useEffect } from 'react';
import {
  getZoneFallbackWeather,
  fetchLiveOpenMeteoWeather,
  getEffectiveZoneRisk,
  getEffectiveZonePriority,
  calculateClientDynamicDemographics,
  getActiveZonePopulation,
} from '../utils/geoUtils';

export default function ZoneDetailsModal({
  zone,
  onClose,
  relocationPlan = [],
  onTraceRoute,
  activeDetailedRoute,
  onClearRoute,
  loadingRoute = false,
  riskMode = 'baseline',
  onUpdateZoneWeather,
}) {
  if (!zone) return null;

  const isSafe = zone.safe === true || zone.location_type === 'relocation_site';
  const hasLiveProps = zone.rainfall !== undefined && zone.rainfall !== null;

  // Initial immediate fallback weather (0ms latency guarantee)
  const initialFallback = getZoneFallbackWeather(zone) || {
    rainfall: 65.0,
    humidity: 78,
    temperature: 24.5,
    weather: 'Variable cloudiness',
  };

  const [liveWeather, setLiveWeather] = useState({
    rainfall: hasLiveProps ? Number(zone.rainfall) : initialFallback.rainfall,
    humidity: zone.humidity !== undefined ? Number(zone.humidity) : initialFallback.humidity,
    temperature: zone.temperature !== undefined ? Number(zone.temperature) : initialFallback.temperature,
    weather: zone.weather || initialFallback.weather,
    source: hasLiveProps ? 'Open-Meteo Live API' : 'IMD Telemetry Forecast',
  });

  // Keep liveWeather in sync with selected zone
  useEffect(() => {
    let isMounted = true;
    const hasProps = zone.rainfall !== undefined && zone.rainfall !== null;

    if (hasProps) {
      // Zone already has official telemetry from /zones/live
      setLiveWeather({
        rainfall: Number(zone.rainfall),
        humidity: Number(zone.humidity ?? 75),
        temperature: Number(zone.temperature ?? 26),
        weather: zone.weather || 'Normal',
        source: 'Open-Meteo Live API',
      });
      return;
    }

    const fallback = getZoneFallbackWeather(zone);
    if (fallback) {
      setLiveWeather({
        ...fallback,
        source: 'IMD Telemetry Forecast',
      });
    }

    // Only fetch from client Open-Meteo if zone properties had no live rainfall
    const lat = zone.centroid_lat || zone.lat;
    const lon = zone.centroid_lon || zone.lon;
    if (lat && lon) {
      fetchLiveOpenMeteoWeather(lat, lon)
        .then((data) => {
          if (isMounted && data) {
            setLiveWeather(data);
            if (onUpdateZoneWeather && zone.area_name) {
              onUpdateZoneWeather(zone.area_name, data);
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [zone, onUpdateZoneWeather]);

  const rainfall = liveWeather.rainfall !== undefined ? Number(liveWeather.rainfall) : (zone.rainfall !== undefined ? Number(zone.rainfall) : initialFallback.rainfall);
  const humidity = liveWeather.humidity !== undefined ? Number(liveWeather.humidity) : (zone.humidity !== undefined ? Number(zone.humidity) : initialFallback.humidity);
  const temp = liveWeather.temperature !== undefined ? Number(liveWeather.temperature) : (zone.temperature !== undefined ? Number(zone.temperature) : initialFallback.temperature);
  const weather = liveWeather.weather || zone.weather || initialFallback.weather;
  const weatherSource = liveWeather.source || (hasLiveProps ? 'Open-Meteo Live API' : 'IMD Telemetry Forecast');

  // Dynamic Demographics & Tourist Telemetry
  const calculatedDemographics = calculateClientDynamicDemographics(zone);
  const demographics = zone.demographics || calculatedDemographics.demographics || {};
  const totalPop = getActiveZonePopulation({ ...zone, demographics }, calculatedDemographics.population) ?? 7500;
  const basePop = demographics.base_resident_population ?? Math.max(0, totalPop - (demographics.current_floating_tourists ?? 0));
  const touristsPop = demographics.current_floating_tourists ?? Math.max(0, totalPop - basePop);
  const surgeFactor = demographics.tourist_surge_factor ?? (basePop > 0 ? (totalPop / basePop).toFixed(2) : 1.0);
  const seasonStatus = demographics.season_status || 'Standard Influx';
  const osmHotels = demographics.live_osm_accommodations_count || demographics.hotels_count || 0;

  // Dynamic Risk & Priority Evaluation:
  // Synchronized 1:1 with Map polygon colors and Dashboard stats
  const dynamicRisk = React.useMemo(() => {
    if (isSafe) {
      return { risk: 'safe', priority: 'optimal' };
    }

    const effectiveProps = {
      ...zone,
      rainfall,
      humidity,
      temperature: temp,
      weather,
    };

    const effRisk = getEffectiveZoneRisk(effectiveProps, riskMode);
    const effPriority = getEffectiveZonePriority(effectiveProps, riskMode);

    return { risk: effRisk, priority: effPriority };
  }, [isSafe, riskMode, zone, rainfall, humidity, temp, weather]);

  const risk = dynamicRisk.risk;
  const priority = dynamicRisk.priority;

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

        {!isSafe && (
          <div className="detail-stat-row">
            <span className="detail-label">Total Population at Risk</span>
            <span className="detail-value font-mono" style={{ fontWeight: '700', color: '#b91c1c' }}>
              {totalPop.toLocaleString()} people
            </span>
          </div>
        )}

        {isSafe && zone.capacity !== undefined && (
          <div className="detail-stat-row">
            <span className="detail-label">Total Shelter Capacity</span>
            <span className="detail-value font-mono text-green" style={{ fontWeight: '700' }}>
              {zone.capacity.toLocaleString()} beds (Sphere standard)
            </span>
          </div>
        )}

        {zone.hazard_type && (
          <div className="detail-stat-row">
            <span className="detail-label">Primary Hazard Type</span>
            <span className="detail-value highlight-priority" style={{ color: '#0f172a' }}>
              {zone.hazard_type.toUpperCase()}
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
                {rainfall >= 115.6
                  ? 'Extreme precipitation (>=115.6mm) triggering IMD Red Alert & immediate evacuation'
                  : rainfall >= 64.5 && zone.hazard_type === 'landslide'
                  ? 'Critical pore pressure saturation (>=64.5mm rain) triggering GSI High Landslide warning'
                  : rainfall >= 64.5
                  ? 'Heavy rainfall (>=64.5mm) triggering IMD Orange Alert'
                  : rainfall >= 35.5 && zone.hazard_type === 'landslide'
                  ? 'Antecedent slope moisture (>=35.5mm) triggering Medium Alert'
                  : 'Precipitation within baseline safe range; low risk / monitoring'}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Demographics & Live Tourist Telemetry Card */}
        {!isSafe && (
          <div className="panel-weather-card" style={{ marginTop: '12px' }}>
            <div className="weather-card-header">
              <div className="weather-card-title">
                <span>Dynamic Demographics & Floating Influx</span>
              </div>
              <span className="weather-live-tag" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                {demographics.telemetry_source ? 'OSM + NASA Grids' : 'Live Spatial Telemetry'}
              </span>
            </div>

            <div className="weather-grid">
              <div className="weather-stat-box">
                <span className="weather-stat-label">Permanent Residents</span>
                <strong className="weather-stat-val font-mono" style={{ color: '#0f172a' }}>
                  {basePop.toLocaleString()}
                </strong>
              </div>
              <div className="weather-stat-box">
                <span className="weather-stat-label">Floating Influx / Tourists</span>
                <strong className="weather-stat-val font-mono" style={{ color: '#d97706' }}>
                  +{touristsPop.toLocaleString()}
                </strong>
              </div>
              <div className="weather-stat-box">
                <span className="weather-stat-label">OSM Lodgings Detected</span>
                <strong className="weather-stat-val text-temp">
                  {osmHotels > 0 ? `${osmHotels} mapped` : 'Active sector'}
                </strong>
              </div>
              <div className="weather-stat-box">
                <span className="weather-stat-label">Total At-Risk</span>
                <strong className="weather-stat-val font-mono" style={{ color: '#b91c1c' }}>
                  {totalPop.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="weather-impact-alert" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
              <span className="impact-dot" style={{ background: '#d97706' }} />
              <span style={{ color: '#92400e' }}>
                <strong>{seasonStatus}</strong>: Floating influx multiplier of <strong>{surgeFactor}x</strong> active above baseline census.
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
