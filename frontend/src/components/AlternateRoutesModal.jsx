import React, { useState } from 'react';

/**
 * Alternate Safe Haven & Multi-Route Selection Modal
 * Displays Primary (🔵), Alternate 1 (🟢), and Alternate 2 (🟡) with Google Maps ETAs and live capacity
 */
export default function AlternateRoutesModal({
  multiRoutesData,
  selectedRouteId = 'primary',
  onSelectRoute,
  onClose,
  theme = 'light',
  onApplyReroute,
}) {
  const [activeChoice, setActiveChoice] = useState(selectedRouteId);

  if (!multiRoutesData) return null;

  const { origin, primary, alternates = [] } = multiRoutesData;
  const allRoutes = [primary, ...alternates].filter(Boolean);

  const handleApply = () => {
    const selected = allRoutes.find((r) => r.id === activeChoice);
    if (onSelectRoute) {
      onSelectRoute(activeChoice, selected);
    }
    if (onApplyReroute && selected) {
      onApplyReroute(selected);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="safeshift-modal-content alt-routes-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-header-icon">🔄</span>
            <div>
              <h3 className="modal-title">Evacuation Corridors & Alternate Safe Havens</h3>
              <p className="modal-subtitle">
                Origin: <strong>{origin?.name || 'Disaster Hazard Zone'}</strong> • Intelligent Traffic Routing
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="alt-routes-body">
          <div className="alt-routes-guidance-banner">
            <span className="guidance-icon">💡</span>
            <span>
              Compare live road distance, Google Maps travel time, and remaining shelter headroom.
              Select an alternative corridor to reroute evacuees instantly.
            </span>
          </div>

          <div className="routes-comparison-grid">
            {allRoutes.map((route, idx) => {
              const isSelected = activeChoice === route.id;
              const isPrimary = route.type === 'primary';
              const fillPct = route.fill_percentage ?? 50;
              const isCritical = fillPct >= 90;
              const isWarning = fillPct >= 70 && fillPct < 90;

              return (
                <div
                  key={route.id || idx}
                  className={`route-choice-card ${isSelected ? 'selected-card' : ''}`}
                  style={{
                    borderColor: isSelected ? route.color : 'transparent',
                  }}
                  onClick={() => setActiveChoice(route.id)}
                >
                  <div className="route-choice-top">
                    <div className="route-type-badge-wrap">
                      <span
                        className="route-type-dot"
                        style={{ backgroundColor: route.color }}
                      />
                      <span
                        className="route-type-label"
                        style={{ color: route.color }}
                      >
                        {isPrimary ? '🔵 PRIMARY CORRIDOR' : idx === 1 ? '🟢 ALTERNATE 1' : '🟡 ALTERNATE 2'}
                      </span>
                    </div>

                    {isSelected && <span className="active-selection-pill">✓ SELECTED</span>}
                  </div>

                  <h4 className="route-dest-name">{route.name}</h4>

                  {/* Metrics Bar */}
                  <div className="route-metrics-grid">
                    <div className="route-metric-box">
                      <span className="m-label">Distance</span>
                      <strong className="m-val">📍 {route.distance_km} km</strong>
                    </div>

                    <div className="route-metric-box">
                      <span className="m-label">Est. Duration</span>
                      <strong className="m-val text-time">⏱️ {route.travel_time_min} mins</strong>
                    </div>

                    <div className="route-metric-box">
                      <span className="m-label">Available Slots</span>
                      <strong
                        className={`m-val ${isCritical ? 'text-danger' : isWarning ? 'text-warning' : 'text-success'}`}
                      >
                        🛡️ {route.remaining_capacity?.toLocaleString()} / {route.total_capacity?.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Capacity Fill Mini Bar */}
                  <div className="route-capacity-bar-wrap">
                    <div className="route-cap-info">
                      <span className="cap-pct-text">Occupancy: {fillPct}%</span>
                      {isCritical && <span className="cap-critical-tag">⚠️ Near Capacity</span>}
                    </div>
                    <div className="cap-track">
                      <div
                        className="cap-fill"
                        style={{
                          width: `${Math.min(100, fillPct)}%`,
                          backgroundColor: isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  <div className="route-source-tag">
                    <span>Engine: {route.source || 'Google Maps Traffic'}</span>
                  </div>

                  <button
                    type="button"
                    className={`btn-select-route ${isSelected ? 'btn-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveChoice(route.id);
                    }}
                  >
                    {isSelected ? 'Current Active Route' : 'Select This Route'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer alt-routes-footer">
          <div className="footer-left-info">
            <span>Routing Engine: Google Maps Directions & Distance Matrix with OSRM fallback</span>
          </div>
          <div className="footer-right-buttons">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-modal-apply" onClick={handleApply}>
              🚀 Confirm & Activate Route
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
