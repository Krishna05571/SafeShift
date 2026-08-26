import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
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
  stats,
  selectedFilter = 'all',
  onSelectZone,
  theme = 'dark',
}) {
  const geoJsonRef = useRef(null);

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
      : `⚠️ ${props.area_name} (${(props.risk || '').toUpperCase()} RISK)`;
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
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filteredData && (
          <GeoJSON
            key={`${selectedFilter}-${filteredData.features.length}-${theme}`}
            ref={geoJsonRef}
            data={filteredData}
            style={getZoneStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {filteredData && <MapBoundsController data={filteredData} />}
      </MapContainer>

      {/* Floating Legend Component */}
      <Legend stats={stats} theme={theme} />
    </div>
  );
}
