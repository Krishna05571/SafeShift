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
 * Returns Leaflet path options for a given GeoJSON feature based on riskMode
 * @param {Object} feature - GeoJSON feature
 * @param {string} riskMode - 'baseline' | 'live'
 */
export const getZoneStyle = (feature, riskMode = 'baseline') => {
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

  // Determine active risk based on selected mode ('baseline' or 'live')
  const risk = (
    riskMode === 'baseline'
      ? props.baseline_risk || props.risk || ''
      : props.risk || props.baseline_risk || ''
  ).toLowerCase();

  switch (risk) {
    case 'high':
      return {
        fillColor: RISK_COLORS.high.fill,
        weight: 2.5,
        opacity: 0.95,
        color: RISK_COLORS.high.border,
        fillOpacity: 0.65,
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
export const getHighlightStyle = (feature, riskMode = 'baseline') => {
  const base = getZoneStyle(feature, riskMode);
  return {
    ...base,
    weight: 4,
    color: '#ffffff',
    fillOpacity: 0.8,
  };
};

/**
 * Generate formatted HTML popup content for a GeoJSON feature with Live Meteorological Data
 */
export const createPopupContent = (properties = {}, riskMode = 'baseline') => {
  const isSafe = properties.safe === true || properties.location_type === 'relocation_site';
  const areaName = properties.area_name || 'Unnamed Zone';
  const hazardType = properties.hazard_type || (isSafe ? 'Designated Safe Haven' : 'General Hazard');
  const population = properties.population !== undefined ? properties.population.toLocaleString() : null;
  const capacity = properties.capacity !== undefined ? properties.capacity.toLocaleString() : null;

  // Active risk & priority based on riskMode
  const activeRisk = (
    riskMode === 'baseline'
      ? properties.baseline_risk || properties.risk
      : properties.risk || properties.baseline_risk
  ) || (isSafe ? 'safe' : 'unknown');

  const risk = activeRisk.toUpperCase();

  const priority = (
    riskMode === 'baseline'
      ? (properties.baseline_risk === 'high' ? 'immediate' : properties.baseline_risk === 'medium' ? 'short-term' : 'monitoring')
      : (properties.priority || (isSafe ? 'safe' : 'unassigned'))
  ).toUpperCase();

  const rainfall = properties.rainfall !== undefined ? Number(properties.rainfall) : null;
  const humidity = properties.humidity !== undefined ? Number(properties.humidity) : null;
  const temp = properties.temperature !== undefined ? Number(properties.temperature) : null;
  const weatherDesc = properties.weather || null;

  // Live Capacity properties (if attached to safe zone)
  const currentOcc = properties.current_occupancy !== undefined ? Number(properties.current_occupancy) : null;
  const remainingCap = properties.remaining_capacity !== undefined ? Number(properties.remaining_capacity) : null;
  const fillPct = properties.fill_percentage !== undefined ? Number(properties.fill_percentage) : (
    (currentOcc !== null && capacity) ? Math.round((currentOcc / capacity) * 100) : null
  );
  const estMins = properties.estimated_minutes_to_full !== undefined ? properties.estimated_minutes_to_full : null;

  const capStatusColor = (fillPct !== null && fillPct >= 100)
    ? '#ef4444'
    : (fillPct !== null && fillPct >= 90)
    ? '#ff6b6b'
    : (fillPct !== null && fillPct >= 70)
    ? '#f59e0b'
    : '#10b981';

  const badgeColor = isSafe
    ? capStatusColor
    : risk === 'HIGH'
    ? '#ef4444'
    : risk === 'MEDIUM'
    ? '#f97316'
    : '#eab308';

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px; color: #1e293b; padding: 2px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${badgeColor}; padding-bottom: 6px; margin-bottom: 8px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; max-width: 155px; line-height: 1.2;">${areaName}</h3>
        <span style="background: ${badgeColor}; color: white; padding: 2px 7px; border-radius: 9999px; font-size: 9.5px; font-weight: 700; text-transform: uppercase;">
          ${isSafe ? (fillPct >= 90 ? `${fillPct}% CRITICAL` : `${fillPct ? `${fillPct}% ` : ''}SAFE HAVEN`) : `${risk} RISK (${riskMode === 'live' ? 'LIVE' : 'BASELINE'})`}
        </span>
      </div>

      <div style="font-size: 11.5px; line-height: 1.5;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: #64748b;">Category:</strong>
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
                <strong style="color: #64748b;">Total Capacity:</strong>
                <span style="font-weight: 700; color: #047857;">${capacity.toLocaleString()} beds</span>
              </div>`
            : ''
        }

        ${
          isSafe && fillPct !== null
            ? `
            <div style="margin: 8px 0; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 4px;">
                <strong style="color: #475569;">Live Occupancy:</strong>
                <strong style="color: ${capStatusColor};">${fillPct}% (${currentOcc ? currentOcc.toLocaleString() : '--'} / ${capacity ? capacity.toLocaleString() : '--'})</strong>
              </div>
              <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-bottom: 4px;">
                <div style="width: ${Math.min(100, fillPct)}%; height: 100%; background: ${capStatusColor}; transition: width 0.4s ease;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #64748b;">
                <span>Remaining: <strong>${remainingCap ? remainingCap.toLocaleString() : '--'}</strong></span>
                ${estMins !== null && estMins > 0 ? `<span style="color: #d97706; font-weight: 600;">⏱️ Full in ~${estMins}m</span>` : ''}
              </div>
            </div>`
            : ''
        }

        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: #64748b;">Mode View:</strong>
          <span style="font-weight: 700; color: ${riskMode === 'live' ? '#0284c7' : '#64748b'};">
            ${riskMode === 'live' ? '🌦️ Live Predicted Risk' : '📊 Baseline Terrain Risk'}
          </span>
        </div>

        ${
          rainfall !== null
            ? `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; background: #f8fafc; padding: 6px 8px; border-radius: 6px;">
              <div style="font-weight: 700; font-size: 10.5px; color: #0369a1; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between;">
                <span>🌦️ Live Meteorological Feed</span>
                <span style="font-size: 8.5px; background: #e0f2fe; color: #0284c7; padding: 1px 4px; border-radius: 4px;">Open-Meteo</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10.5px;">
                <div>🌧️ <strong>${rainfall} mm</strong></div>
                <div>💧 <strong>${humidity ?? '--'}%</strong> hum</div>
                <div>🌡️ <strong>${temp ?? '--'}°C</strong></div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569;" title="${weatherDesc || 'Live'}">⛅ ${weatherDesc || 'Rain'}</div>
              </div>
            </div>`
            : ''
        }
      </div>
    </div>
  `;
};

