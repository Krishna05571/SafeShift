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

// Component to auto-fit map bounds dynamically
function MapBoundsController({ data, activeDetailedRoute }) {
  const map = useMap();

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
          return;
        }
      } catch (err) {
        console.warn('Could not fit bounds to detailed route:', err);
      }
    }

    if (!data || !data.features || data.features.length === 0) return;
    try {
      const geoJsonLayer = L.geoJSON(data);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10, animate: true });
      }
    } catch (err) {
      console.warn('Could not fit bounds to GeoJSON data:', err);
    }
  }, [data, activeDetailedRoute, map]);

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
}) {
  const geoJsonRef = useRef(null);
  const [showCorridors, setShowCorridors] = useState(true);

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
      const risk = (props.risk || '').toLowerCase();
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
  }, [geoData, filters]);

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
    const props = feature.properties || {};

    // Bind custom HTML popup
    const popupHtml = createPopupContent(props);
    layer.bindPopup(popupHtml, {
      maxWidth: 320,
      className: 'safeshift-popup',
    });

    // Tooltip for instant hover feedback
    const tooltipText = props.safe
      ? `🛡️ ${props.area_name} (Cap: ${props.capacity?.toLocaleString() || 'N/A'})`
      : `⚠️ ${props.area_name} (${(props.risk || '').toUpperCase()} RISK | Pop: ${(props.population || 0).toLocaleString()})`;
    layer.bindTooltip(tooltipText, {
      sticky: true,
      direction: 'top',
      className: 'safeshift-tooltip',
    });

    layer.on({
      mouseover: (e) => {
        const currentLayer = e.target;
        currentLayer.setStyle(getHighlightStyle(feature));
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
            key={`${filtersKey}-${filteredData.features.length}-${theme}-t${simTimeStep}`}
            ref={geoJsonRef}
            data={filteredData}
            style={getZoneStyle}
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
              {/* Outer Glow Line */}
              <Polyline
                positions={activeDetailedRoute.coordinates}
                pathOptions={{
                  color: '#0284c7',
                  weight: 8,
                  opacity: 0.45,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />

              {/* High-Precision Highway Polyline */}
              <Polyline
                positions={activeDetailedRoute.coordinates}
                pathOptions={{
                  color: '#38bdf8',
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

        {filteredData && (
          <MapBoundsController
            data={filteredData}
            activeDetailedRoute={activeDetailedRoute}
          />
        )}
      </MapContainer>

      {/* Floating Active Route Banner or Corridor Toggle */}
      <div className="map-floating-toggles">
        {activeDetailedRoute ? (
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
