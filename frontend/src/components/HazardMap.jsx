import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polyline, Tooltip, useMap } from 'react-leaflet';
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

// Component to auto-fit map bounds when GeoJSON data changes
function MapBoundsController({ data }) {
  const map = useMap();

  useEffect(() => {
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
  }, [data, map]);

  return null;
}

export default function HazardMap({
  geoData,
  relocationPlan = [],
  stats,
  selectedFilter = 'all',
  onSelectZone,
  theme = 'dark',
  simTimeStep = 0,
}) {
  const geoJsonRef = useRef(null);
  const [showRoutes, setShowRoutes] = useState(true);

  // Filter features based on active user filter
  const filteredData = React.useMemo(() => {
    if (!geoData || !geoData.features) return null;
    if (selectedFilter === 'all') return geoData;

    const filteredFeatures = geoData.features.filter((f) => {
      const props = f.properties || {};
      if (selectedFilter === 'safe') return props.safe === true;
      if (selectedFilter === 'high') return props.risk === 'high';
      if (selectedFilter === 'medium') return props.risk === 'medium';
      if (selectedFilter === 'low') return props.risk === 'low';
      if (selectedFilter === 'landslide') return props.hazard_type === 'landslide';
      if (selectedFilter === 'flood') return props.hazard_type === 'flood';
      return true;
    });

    return {
      ...geoData,
      features: filteredFeatures,
    };
  }, [geoData, selectedFilter]);

  // Filter relocation routes based on the active risk filter
  const filteredRoutes = React.useMemo(() => {
    if (!relocationPlan || relocationPlan.length === 0) return [];
    if (selectedFilter === 'all' || selectedFilter === 'safe') return relocationPlan;

    return relocationPlan.filter((r) => {
      if (selectedFilter === 'high') return r.risk === 'high';
      if (selectedFilter === 'medium') return r.risk === 'medium';
      if (selectedFilter === 'low') return r.risk === 'low';
      if (selectedFilter === 'landslide') return r.hazard_type === 'landslide';
      if (selectedFilter === 'flood') return r.hazard_type === 'flood';
      return true;
    });
  }, [relocationPlan, selectedFilter]);

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

  // Default India center coordinates
  const defaultCenter = [22.9734, 78.6569];
  const defaultZoom = 5;

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
            key={`${selectedFilter}-${filteredData.features.length}-${theme}-t${simTimeStep}`}
            ref={geoJsonRef}
            data={filteredData}
            style={getZoneStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Evacuation Route Polylines: Hazard Zone -> Safe Zone */}
        {showRoutes &&
          filteredRoutes.map((route, idx) => {
            if (!route.origin_coords || !route.dest_coords) return null;

            const risk = (route.risk || 'medium').toLowerCase();
            const isHigh = risk === 'high';
            const isLow = risk === 'low';

            // Route color by priority: Red = High, Yellow = Medium, Green = Low
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

        {filteredData && <MapBoundsController data={filteredData} />}
      </MapContainer>

      {/* Floating Map Route Toggle Control */}
      <div className="map-floating-toggles">
        <button
          type="button"
          className={`map-toggle-btn ${showRoutes ? 'active' : ''}`}
          onClick={() => setShowRoutes(!showRoutes)}
          title="Toggle Evacuation Corridors on/off"
        >
          {showRoutes ? '🛣️ Corridors Visible' : '🛣️ Corridors Hidden'}
        </button>
      </div>

      {/* Floating Legend Component */}
      <Legend stats={stats} theme={theme} />
    </div>
  );
}
