// Risk and Safe Zone color definitions
export const RISK_COLORS = {
  high: {
    fill: '#ef4444',
    border: '#b91c1c',
    label: 'High Risk (Immediate Evacuation)',
  },
  medium: {
    fill: '#f97316',
    border: '#c2410c',
    label: 'Medium Risk (Short-Term Action)',
  },
  low: {
    fill: '#eab308',
    border: '#a16207',
    label: 'Low Risk (Monitoring)',
  },
  safe: {
    fill: '#10b981',
    border: '#047857',
    label: 'Safe Zone (Relocation Site)',
  },
};

/**
 * Returns Leaflet path options for a given GeoJSON feature
 */
export const getZoneStyle = (feature) => {
  const props = feature?.properties || {};

  // Check if it's a Safe Zone
  if (props.safe === true || props.location_type === 'relocation_site') {
    return {
      fillColor: RISK_COLORS.safe.fill,
      weight: 2,
      opacity: 0.9,
      color: RISK_COLORS.safe.border,
      fillOpacity: 0.55,
      dashArray: '',
    };
  }

  // Hazard zones styling based on risk
  const risk = (props.risk || '').toLowerCase();
  switch (risk) {
    case 'high':
      return {
        fillColor: RISK_COLORS.high.fill,
        weight: 2.5,
        opacity: 0.95,
        color: RISK_COLORS.high.border,
        fillOpacity: 0.6,
        dashArray: '',
      };
    case 'medium':
      return {
        fillColor: RISK_COLORS.medium.fill,
        weight: 2,
        opacity: 0.9,
        color: RISK_COLORS.medium.border,
        fillOpacity: 0.55,
        dashArray: '',
      };
    case 'low':
      return {
        fillColor: RISK_COLORS.low.fill,
        weight: 2,
        opacity: 0.85,
        color: RISK_COLORS.low.border,
        fillOpacity: 0.5,
        dashArray: '',
      };
    default:
      return {
        fillColor: '#94a3b8',
        weight: 1.5,
        opacity: 0.8,
        color: '#475569',
        fillOpacity: 0.45,
        dashArray: '3',
      };
  }
};

/**
 * Hover highlight style
 */
export const getHighlightStyle = (feature) => {
  const base = getZoneStyle(feature);
  return {
    ...base,
    weight: 4,
    color: '#ffffff',
    fillOpacity: 0.8,
  };
};

/**
 * Generate formatted HTML popup content for a GeoJSON feature
 */
export const createPopupContent = (properties = {}) => {
  const isSafe = properties.safe === true || properties.location_type === 'relocation_site';
  const areaName = properties.area_name || 'Unnamed Zone';
  const hazardType = properties.hazard_type || (isSafe ? 'Designated Safe Haven' : 'General Hazard');
  const population = properties.population !== undefined ? properties.population.toLocaleString() : null;
  const capacity = properties.capacity !== undefined ? properties.capacity.toLocaleString() : null;
  const priority = (properties.priority || (isSafe ? 'safe' : 'unassigned')).toUpperCase();
  const risk = (properties.risk || (isSafe ? 'safe' : 'unknown')).toUpperCase();

  const badgeColor = isSafe
    ? '#10b981'
    : risk === 'HIGH'
    ? '#ef4444'
    : risk === 'MEDIUM'
    ? '#f97316'
    : '#eab308';

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; color: #1e293b; padding: 2px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${badgeColor}; padding-bottom: 6px; margin-bottom: 8px;">
        <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">${areaName}</h3>
        <span style="background: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase;">
          ${isSafe ? 'SAFE ZONE' : `${risk} RISK`}
        </span>
      </div>

      <div style="font-size: 12px; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: #64748b;">Type:</strong>
          <span style="text-transform: capitalize; font-weight: 600; color: #334155;">
            ${isSafe ? '🛡️ Relocation Site' : `⚠️ ${hazardType}`}
          </span>
        </div>

        ${
          population !== null
            ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: #64748b;">Population Affected:</strong>
                <span style="font-weight: 700; color: #b91c1c;">${population}</span>
              </div>`
            : ''
        }

        ${
          capacity !== null
            ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: #64748b;">Relocation Capacity:</strong>
                <span style="font-weight: 700; color: #047857;">${capacity} people</span>
              </div>`
            : ''
        }

        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: #64748b;">Priority Level:</strong>
          <span style="font-weight: 700; color: ${
            priority === 'IMMEDIATE' ? '#dc2626' : priority === 'SHORT-TERM' ? '#d97706' : '#15803d'
          };">
            ${priority}
          </span>
        </div>
      </div>
    </div>
  `;
};
