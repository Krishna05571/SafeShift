import React from 'react';

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

  const rainfall = zone.rainfall !== undefined ? Number(zone.rainfall) : null;
  const humidity = zone.humidity !== undefined ? Number(zone.humidity) : null;
  const temp = zone.temperature !== undefined ? Number(zone.temperature) : null;
  const weather = zone.weather || null;

  // Find destination safe shelter from the relocation plan
  const matchedRoute = relocationPlan.find(
    (r) => r.from === zone.area_name || (r.from && zone.area_name && r.from.includes(zone.area_name))
  );

  const isRouteActive =
    activeDetailedRoute &&
    matchedRoute &&
    (activeDetailedRoute.from === matchedRoute.from || activeDetailedRoute.to === matchedRoute.to);

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
              <span className="weather-live-tag">Open-Meteo</span>
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
        {!isSafe && matchedRoute && (
          <div className="panel-route-card">
            <div className="route-card-title">
              <span>Assigned Safe Haven</span>
            </div>
            <strong className="route-dest-name">{matchedRoute.to}</strong>
            <div className="route-quick-stats">
              <span>{matchedRoute.people?.toLocaleString()} Evacuees</span>
              <span>•</span>
              <span>{matchedRoute.travel_time_min ? `${matchedRoute.travel_time_min} mins` : 'N/A'}</span>
            </div>

            {/* On-Demand Curved Road Route Action */}
            <div className="route-action-buttons">
              {!isRouteActive ? (
                <button
                  type="button"
                  className="btn-trace-route"
                  onClick={() => onTraceRoute && onTraceRoute(matchedRoute)}
                  disabled={loadingRoute}
                >
                  {loadingRoute ? 'Tracing Highway...' : 'Trace Highway Route'}
                </button>
              ) : (
                <div className="active-route-btn-group">
                  <span className="route-active-indicator">Highway Active</span>
                  <button
                    type="button"
                    className="btn-clear-route"
                    onClick={() => onClearRoute && onClearRoute()}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
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
