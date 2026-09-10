import React, { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  Tooltip,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getZoneStyle, getHighlightStyle, createPopupContent } from '../utils/styles';
import Legend from './Legend';

// Fix default Leaflet marker icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to auto-fit map bounds dynamically with smooth flyTo on zone selection
function MapBoundsController({ data, activeDetailedRoute, locateTarget, geoData }) {
  const map = useMap();
  const hasFittedInitialRef = useRef(false);
  const lastLocateTimeRef = useRef(0);

  // 1. Invalidate size whenever tab or map container renders and observe dynamic container resizes
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    map.invalidateSize({ pan: false });

    let resizeTimer = null;
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize({ pan: false });
      }, 200);
    });

    observer.observe(container);
    if (container.parentElement) {
      observer.observe(container.parentElement);
    }

    const handleWindowResize = () => {
      map.invalidateSize({ pan: false });
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      observer.disconnect();
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [map]);

  // 2. Initial Pan-India whole map bounding box (runs once on load)
  useEffect(() => {
    if (hasFittedInitialRef.current) return;
    if (!data || !data.features || data.features.length === 0) return;

    try {
      const geoJsonLayer = L.geoJSON(data);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10, animate: false });
        hasFittedInitialRef.current = true;
      }
    } catch (err) {
      console.warn('Could not fit initial bounds to GeoJSON data:', err);
    }
  }, [data, map]);

  // 3. Zoom / flyTo ONLY when explicit locateTarget is triggered (Inspect Zone / Locate on Map button)
  useEffect(() => {
    if (!locateTarget || !locateTarget.zone || !locateTarget.timestamp) return;
    if (locateTarget.timestamp === lastLocateTimeRef.current) return;
    lastLocateTimeRef.current = locateTarget.timestamp;

    const targetZone = locateTarget.zone;

    const timer = setTimeout(() => {
      map.invalidateSize();

      // Find full GeoJSON polygon feature for precise bounding box zoom
      if (geoData && geoData.features) {
        const feat = geoData.features.find(
          (f) => f.properties?.area_name === targetZone.area_name
        );
        if (feat && feat.geometry) {
          try {
            const layer = L.geoJSON(feat);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              map.flyToBounds(bounds, {
                padding: [60, 60],
                maxZoom: 11,
                duration: 1.2,
                easeLinearity: 0.25,
              });
              return;
            }
          } catch (err) {
            console.warn('Could not zoom to polygon bounds:', err);
          }
        }
      }

      // Centroid coordinate fallback
      if (targetZone.centroid_lat && targetZone.centroid_lon) {
        map.flyTo([targetZone.centroid_lat, targetZone.centroid_lon], 11, {
          duration: 1.2,
          easeLinearity: 0.25,
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [locateTarget, geoData, map]);

  // 4. If detailed highway route is active, fit to route bounds
  useEffect(() => {
    if (
      activeDetailedRoute &&
      activeDetailedRoute.coordinates &&
      activeDetailedRoute.coordinates.length > 0
    ) {
      try {
        const bounds = L.latLngBounds(activeDetailedRoute.coordinates);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true });
        }
      } catch (err) {
        console.warn('Could not fit bounds to detailed route:', err);
      }
    }
  }, [activeDetailedRoute, map]);

  return null;
}

export default function HazardMap({
  geoData,
  relocationPlan = [],
  stats,
  selectedFilters = ['all'],
  selectedFilter = 'all', // backward compatibility fallback
  onSelectZone,
  theme = 'light',
  simTimeStep = 0,
  activeDetailedRoute = null,
  onClearDetailedRoute = null,
  riskMode = 'baseline',
  selectedZone = null,
  locateTarget = null,
  safeZoneStatus = null,
  activeMultiRoutes = null,
  selectedRouteId = 'primary',
  onSelectMultiRouteChoice = null,
  onClearMultiRoutes = null,
}) {
  const geoJsonRef = useRef(null);
  const [showCorridors, setShowCorridors] = useState(true);

  // Map of safe zone name -> live capacity object
  const safeZoneCapacityMap = React.useMemo(() => {
    const map = {};
    if (safeZoneStatus?.safe_zones) {
      safeZoneStatus.safe_zones.forEach((sz) => {
        map[sz.name] = sz;
      });
    }
    return map;
  }, [safeZoneStatus]);

  // Normalize selected filters into an array
  const filters = React.useMemo(() => {
    if (Array.isArray(selectedFilters) && selectedFilters.length > 0) {
      return selectedFilters;
    }
    return [selectedFilter || 'all'];
  }, [selectedFilters, selectedFilter]);


  // Multi-Select Feature Filter
  const filteredData = React.useMemo(() => {
    if (!geoData || !geoData.features) return null;
    if (filters.includes('all')) return geoData;

    const hasSafeFilter = filters.includes('safe');
    const riskFilters = filters.filter((f) => ['high', 'medium', 'low'].includes(f));
    const hazardFilters = filters.filter((f) => ['flood', 'landslide'].includes(f));

    const filteredFeatures = geoData.features.filter((f) => {
      const props = f.properties || {};
      const isSafe = props.safe === true || props.location_type === 'relocation_site';
      const risk = (
        riskMode === 'baseline'
          ? (props.baseline_risk || props.risk || '')
          : (props.risk || props.baseline_risk || '')
      ).toLowerCase();
      const hazard = (props.hazard_type || '').toLowerCase();

      // If this feature is a safe zone
      if (isSafe) {
        return hasSafeFilter;
      }

      // If user selected ONLY safe zones, don't show hazard zones
      if (hasSafeFilter && riskFilters.length === 0 && hazardFilters.length === 0) {
        return false;
      }

      const matchesRisk = riskFilters.length === 0 || riskFilters.includes(risk);
      const matchesHazard = hazardFilters.length === 0 || hazardFilters.includes(hazard);

      return matchesRisk && matchesHazard;
    });

    return {
      ...geoData,
      features: filteredFeatures,
    };
  }, [geoData, filters, riskMode]);

  // Multi-Select Relocation Routes Filter
  const filteredRoutes = React.useMemo(() => {
    if (!relocationPlan || relocationPlan.length === 0) return [];
    if (filters.includes('all')) return relocationPlan;

    const riskFilters = filters.filter((f) => ['high', 'medium', 'low'].includes(f));
    const hazardFilters = filters.filter((f) => ['flood', 'landslide'].includes(f));

    // If only safe zone filter is active, show all corresponding routes
    if (filters.includes('safe') && riskFilters.length === 0 && hazardFilters.length === 0) {
      return relocationPlan;
    }

    return relocationPlan.filter((r) => {
      const risk = (r.risk || '').toLowerCase();
      const hazard = (r.hazard_type || '').toLowerCase();

      const matchesRisk = riskFilters.length === 0 || riskFilters.includes(risk);
      const matchesHazard = hazardFilters.length === 0 || hazardFilters.includes(hazard);

      return matchesRisk && matchesHazard;
    });
  }, [relocationPlan, filters]);

  // Handle polygon hover, mouseout, and click behaviors
  const onEachFeature = (feature, layer) => {
    let props = feature.properties || {};
    if (props.safe && safeZoneCapacityMap[props.area_name]) {
      props = { ...props, ...safeZoneCapacityMap[props.area_name] };
    }

    // Bind custom HTML popup
    const popupHtml = createPopupContent(props, riskMode);
    layer.bindPopup(popupHtml, {
      maxWidth: 320,
      className: 'safeshift-popup',
    });

    // Tooltip for instant hover feedback with meteorological metrics
    const currentRisk = (
      riskMode === 'baseline'
        ? (props.baseline_risk || props.risk || '')
        : (props.risk || props.baseline_risk || '')
    ).toUpperCase();

    const tooltipText = props.safe
      ? `🛡️ ${props.area_name} (${props.fill_percentage !== undefined ? `${props.fill_percentage}% Occupied` : `Cap: ${props.capacity?.toLocaleString() || 'N/A'}`})`
      : `⚠️ ${props.area_name} (${currentRisk} RISK | 🌧️ ${props.rainfall ?? 0}mm | Pop: ${(props.population || 0).toLocaleString()})`;
    layer.bindTooltip(tooltipText, {
      sticky: true,
      direction: 'top',
      className: 'safeshift-tooltip',
    });


    layer.on({
      mouseover: (e) => {
        const currentLayer = e.target;
        currentLayer.setStyle(getHighlightStyle(feature, riskMode));
        currentLayer.bringToFront();
      },
      mouseout: (e) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target);
        }
      },
      click: () => {
        if (onSelectZone) {
          onSelectZone(props);
        }
      },
    });
  };

  const defaultCenter = [22.9734, 78.6569];
  const defaultZoom = 5;

  const filtersKey = filters.sort().join('_');
  const cacheKey = filteredData?.metadata?.cached_at || 0;

  return (
    <div className="map-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="leaflet-map-container"
      >
        {/* Strictly preserved standard OpenStreetMap TileLayer without watermarks */}
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Hazard & Safe Polygons */}
        {filteredData && (
          <GeoJSON
            key={`${filtersKey}-${filteredData.features.length}-${theme}-${riskMode}-t${simTimeStep}-${cacheKey}`}
            ref={geoJsonRef}
            data={filteredData}
            style={(feat) => getZoneStyle(feat, riskMode)}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Tier 1: Macro Evacuation Corridors (Straight Lines) */}
        {showCorridors &&
          !activeDetailedRoute &&
          filteredRoutes.map((route, idx) => {
            if (!route.origin_coords || !route.dest_coords) return null;

            const risk = (route.risk || 'medium').toLowerCase();
            const isHigh = risk === 'high';
            const isLow = risk === 'low';
            const routeColor = isHigh ? '#ef4444' : isLow ? '#10b981' : '#eab308';

            return (
              <Polyline
                key={`route-${idx}-${route.from}-${route.to}-t${simTimeStep}`}
                positions={[route.origin_coords, route.dest_coords]}
                pathOptions={{
                  color: routeColor,
                  weight: isHigh ? 3.5 : 2.5,
                  opacity: 0.85,
                  dashArray: isHigh ? '6, 8' : '5, 6',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              >
                <Tooltip sticky direction="top" className="safeshift-route-tooltip">
                  <div className="route-tooltip-container">
                    <div className="route-tooltip-header">
                      <span className="route-tooltip-tag">🛣️ Evacuation Corridor</span>
                      <span
                        className={`route-risk-pill ${
                          isHigh ? 'pill-high' : isLow ? 'pill-low' : 'pill-medium'
                        }`}
                      >
                        {risk.toUpperCase()}
                      </span>
                    </div>

                    <div className="route-tooltip-path">
                      <span className="origin-text">{route.from}</span>
                      <span className="route-arrow">➔</span>
                      <span className="dest-text">{route.to}</span>
                    </div>

                    <div className="route-tooltip-grid">
                      <div className="route-stat-item">
                        <span className="stat-label">Evacuees:</span>
                        <strong className="stat-val text-people">
                          👥 {(route.people || 0).toLocaleString()}
                        </strong>
                      </div>

                      <div className="route-stat-item">
                        <span className="stat-label">Travel Time:</span>
                        <strong className="stat-val text-time">
                          ⏱️ {route.travel_time_min ? `${route.travel_time_min} min` : 'N/A'}
                        </strong>
                      </div>

                      <div className="route-stat-item">
                        <span className="stat-label">Road Distance:</span>
                        <strong className="stat-val text-dist">
                          📍 {route.distance_km ? `${route.distance_km} km` : 'N/A'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </Tooltip>
              </Polyline>
            );
          })}

        {/* Tier 2: Micro Detailed Curved Highway Route (On Demand) */}
        {activeDetailedRoute &&
          activeDetailedRoute.coordinates &&
          activeDetailedRoute.coordinates.length > 0 && (
            <>
              {/* Outer Casing Line for Contrast against Map Features */}
              <Polyline
                positions={activeDetailedRoute.coordinates}
                pathOptions={{
                  color: theme === 'light' ? '#ffffff' : '#000000',
                  weight: 8,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />

              {/* High-Precision Highway Polyline: Black in Light Mode, White in Dark/Night Mode */}
              <Polyline
                positions={activeDetailedRoute.coordinates}
                pathOptions={{
                  color: theme === 'light' ? '#000000' : '#ffffff',
                  weight: 4.5,
                  opacity: 1.0,
                  dashArray: '8, 6',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              >
                <Tooltip sticky direction="top" className="safeshift-route-tooltip">
                  <div className="route-tooltip-container">
                    <div className="route-tooltip-header">
                      <span className="route-tooltip-tag">🗺️ Real Highway Navigation</span>
                      <span className="route-risk-pill pill-high">ACTIVE ROUTE</span>
                    </div>
                    <div className="route-tooltip-path">
                      <span className="origin-text">{activeDetailedRoute.from}</span>
                      <span className="route-arrow">➔</span>
                      <span className="dest-text">{activeDetailedRoute.to}</span>
                    </div>
                    <div className="route-tooltip-grid">
                      <div className="route-stat-item">
                        <span className="stat-label">Total Distance:</span>
                        <strong className="stat-val text-dist">
                          📍 {activeDetailedRoute.distance_km} km
                        </strong>
                      </div>
                      <div className="route-stat-item">
                        <span className="stat-label">Driving Duration:</span>
                        <strong className="stat-val text-time">
                          ⏱️ {activeDetailedRoute.travel_time_min} mins
                        </strong>
                      </div>
                      <div className="route-stat-item">
                        <span className="stat-label">Routing Engine:</span>
                        <strong className="stat-val text-people">
                          {activeDetailedRoute.source}
                        </strong>
                      </div>
                    </div>
                  </div>
                </Tooltip>
              </Polyline>

              {/* Start & End Pin Markers */}
              <CircleMarker
                center={activeDetailedRoute.coordinates[0]}
                radius={8}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" className="safeshift-tooltip">
                  ⚠️ Origin: {activeDetailedRoute.from}
                </Tooltip>
              </CircleMarker>

              <CircleMarker
                center={
                  activeDetailedRoute.coordinates[
                    activeDetailedRoute.coordinates.length - 1
                  ]
                }
                radius={9}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" className="safeshift-tooltip">
                  🛡️ Safe Haven: {activeDetailedRoute.to}
                </Tooltip>
              </CircleMarker>
            </>
          )}

        {/* Pulsing Radar Markers on Critical Safe Havens (Occupancy >= 90%) */}
        {safeZoneStatus?.safe_zones?.map((sz) => {
          if ((sz.fill_percentage ?? 0) < 90) return null;
          const isFull = (sz.fill_percentage ?? 0) >= 100;
          return (
            <React.Fragment key={`pulse-${sz.name}`}>
              {/* Outer Pulsing Halo */}
              <CircleMarker
                center={[sz.centroid_lat, sz.centroid_lon]}
                radius={16}
                pathOptions={{
                  color: isFull ? '#ef4444' : '#ff6b6b',
                  fillColor: isFull ? '#ef4444' : '#ff6b6b',
                  fillOpacity: 0.25,
                  weight: 2,
                  className: 'radar-pulsing-marker',
                }}
              />
              <CircleMarker
                center={[sz.centroid_lat, sz.centroid_lon]}
                radius={8}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: isFull ? '#ef4444' : '#ff6b6b',
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="bottom" className="safeshift-critical-shelter-tooltip">
                  {isFull ? '⛔ FULL' : '🚨 90%+ CRITICAL'}: {sz.name}
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* Multi-Route Alternative Corridors (Primary 🔵, Alt 1 🟢, Alt 2 🟡) */}
        {activeMultiRoutes && (
          <>
            {/* Primary Route */}
            {activeMultiRoutes.primary?.coordinates?.length > 0 && (
              <Polyline
                positions={activeMultiRoutes.primary.coordinates}
                pathOptions={{
                  color: selectedRouteId === 'primary' ? '#2563eb' : '#3b82f6',
                  weight: selectedRouteId === 'primary' ? 6 : 4,
                  opacity: selectedRouteId === 'primary' ? 1.0 : 0.65,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  click: () => onSelectMultiRouteChoice && onSelectMultiRouteChoice('primary', activeMultiRoutes.primary),
                }}
              >
                <Tooltip sticky direction="top" className="safeshift-route-tooltip">
                  🔵 PRIMARY ROUTE: {activeMultiRoutes.primary.name} • {activeMultiRoutes.primary.distance_km} km • {activeMultiRoutes.primary.travel_time_min} mins
                </Tooltip>
              </Polyline>
            )}

            {/* Alternates */}
            {activeMultiRoutes.alternates?.map((alt, aIdx) => {
              if (!alt.coordinates || alt.coordinates.length === 0) return null;
              const isSelected = selectedRouteId === alt.id;
              const altColor = aIdx === 0 ? '#10b981' : '#f59e0b';
              const label = aIdx === 0 ? '🟢 ALTERNATE 1' : '🟡 ALTERNATE 2';

              return (
                <Polyline
                  key={alt.id || aIdx}
                  positions={alt.coordinates}
                  pathOptions={{
                    color: altColor,
                    weight: isSelected ? 5.5 : 3.5,
                    opacity: isSelected ? 1.0 : 0.7,
                    dashArray: isSelected ? '0' : '6, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{
                    click: () => onSelectMultiRouteChoice && onSelectMultiRouteChoice(alt.id, alt),
                  }}
                >
                  <Tooltip sticky direction="top" className="safeshift-route-tooltip">
                    {label}: {alt.name} • {alt.distance_km} km • {alt.travel_time_min} mins • Available: {alt.remaining_capacity?.toLocaleString()}
                  </Tooltip>
                </Polyline>
              );
            })}
          </>
        )}

        {filteredData && (
          <MapBoundsController
            data={filteredData}
            activeDetailedRoute={activeDetailedRoute || activeMultiRoutes?.primary}
            locateTarget={locateTarget}
            geoData={geoData}
          />
        )}
      </MapContainer>

      {/* Floating Active Route Banner or Corridor Toggle */}
      <div className="map-floating-toggles">
        {activeMultiRoutes ? (
          <div className="active-multi-routes-bar">
            <span className="multi-routes-origin-tag">
              🔄 Multi-Corridors: <strong>{activeMultiRoutes.origin?.name}</strong>
            </span>
            <div className="multi-routes-selector-chips">
              <button
                type="button"
                className={`route-chip chip-primary ${selectedRouteId === 'primary' ? 'chip-active' : ''}`}
                onClick={() => onSelectMultiRouteChoice && onSelectMultiRouteChoice('primary', activeMultiRoutes.primary)}
              >
                🔵 Primary ({activeMultiRoutes.primary?.distance_km} km)
              </button>
              {activeMultiRoutes.alternates?.map((alt, idx) => (
                <button
                  key={alt.id || idx}
                  type="button"
                  className={`route-chip ${idx === 0 ? 'chip-alt1' : 'chip-alt2'} ${selectedRouteId === alt.id ? 'chip-active' : ''}`}
                  onClick={() => onSelectMultiRouteChoice && onSelectMultiRouteChoice(alt.id, alt)}
                >
                  {idx === 0 ? '🟢 Alt 1' : '🟡 Alt 2'} ({alt.distance_km} km | {alt.travel_time_min}m)
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-clear-active-route"
              onClick={onClearMultiRoutes}
              title="Close Multi-Route View"
            >
              ✕ Close
            </button>
          </div>
        ) : activeDetailedRoute ? (
          <div className="active-route-banner">
            <span className="active-route-tag">
              🛣️ Highway: <strong>{activeDetailedRoute.from}</strong> ➔{' '}
              <strong>{activeDetailedRoute.to}</strong> ({activeDetailedRoute.distance_km} km |{' '}
              {activeDetailedRoute.travel_time_min} min)
            </span>
            <button
              type="button"
              className="btn-clear-active-route"
              onClick={onClearDetailedRoute}
              title="Return to National Corridor View"
            >
              ✕ Clear Route
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`map-toggle-btn ${showCorridors ? 'active' : ''}`}
            onClick={() => setShowCorridors(!showCorridors)}
            title="Toggle Evacuation Corridors on/off"
          >
            {showCorridors ? '🛣️ Corridors Visible' : '🛣️ Corridors Hidden'}
          </button>
        )}
      </div>

      {/* Floating Legend Component */}
      <Legend stats={stats} theme={theme} />

    </div>
  );
}
