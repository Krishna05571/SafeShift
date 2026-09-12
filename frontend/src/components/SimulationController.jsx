import React, { useState } from 'react';

export default function SimulationController({
  forecastMinutes = 0,
  isSimulating = false,
  onRunProjection,
  onPauseProjection,
  onResetProjection,
  onSeekMinutes,
  simMetrics = null,
  weatherMeta = null,
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Preset time horizons
  const presetMinutes = [0, 15, 30, 45, 60];

  // Dynamic phase and color based on continuous forecast minutes
  const getTimelineStatus = (mins) => {
    if (mins === 0) {
      return {
        label: 'T+0m: Baseline State',
        tag: 'Baseline',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: '#10b981',
        desc: 'Normal monitoring. Live meteorological inputs active.',
      };
    } else if (mins <= 20) {
      return {
        label: `T+${mins}m: Flood Inundation Expanding`,
        tag: 'Inundation Surge',
        color: '#eab308',
        bg: 'rgba(234, 179, 8, 0.18)',
        border: '#eab308',
        desc: 'Rivers swell, slope saturation initiates localized evacuations.',
      };
    } else if (mins <= 40) {
      return {
        label: `T+${mins}m: Multi-Hazard Severe Spread`,
        tag: 'Critical Escalation',
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.20)',
        border: '#f97316',
        desc: 'Flood perimeters dilate, landslide slope instability escalates.',
      };
    } else {
      return {
        label: `T+${mins}m: Peak Scenario Surge`,
        tag: 'Peak Disaster',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.25)',
        border: '#ef4444',
        desc: 'Widespread multi-zone inundation and shelter capacity spillover.',
      };
    }
  };

  const status = getTimelineStatus(forecastMinutes);

  if (isMinimized) {
    return (
      <div className="sim-dock-minimized">
        <button
          type="button"
          className="sim-dock-min-btn"
          onClick={() => setIsMinimized(false)}
          title="Open Scenario Intelligence Engine Dock"
        >
          <span className="sim-pulse-dot" style={{ backgroundColor: status.border }} />
          <span>Scenario Engine: <strong>T+{forecastMinutes}m</strong> ({status.tag})</span>
          <span className="expand-icon">Expand</span>
        </button>
      </div>
    );
  }

  return (
    <div className="sim-dock-container">
      {/* Left: Brand / Title & Status */}
      <div className="sim-dock-header">
        <div className="sim-dock-badge-row">
          <span className="sim-engine-tag">Scenario Intelligence Engine</span>
          {isSimulating && <span className="sim-live-indicator">● LIVE SIMULATION</span>}
        </div>
        <div className="sim-dock-titles">
          <span className="sim-dock-phase" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Primary Action Button: "Run Scenario Projection" / "Pause" */}
      <div className="sim-dock-main-action">
        {!isSimulating ? (
          <button
            type="button"
            className="sim-dock-btn-projection"
            onClick={onRunProjection}
            title="Execute dynamic 0-60 min scenario projection"
          >
            <span className="btn-icon">⚡</span>
            <span>Run Scenario Projection</span>
          </button>
        ) : (
          <button
            type="button"
            className="sim-dock-btn-projection running"
            onClick={onPauseProjection}
            title="Pause continuous scenario projection"
          >
            <span className="btn-icon">⏸</span>
            <span>Pause Projection</span>
          </button>
        )}

        <button
          type="button"
          className="sim-dock-btn-reset-v2"
          onClick={onResetProjection}
          title="Reset scenario timeline back to T+0m (Now)"
        >
          Reset (0m)
        </button>
      </div>

      {/* Center: Interactive Timeline Slider (0 to 60 Minutes) */}
      <div className="sim-timeline-control">
        <div className="sim-timeline-header">
          <span className="timeline-title">Forecast Horizon:</span>
          <strong className="timeline-current-val" style={{ color: status.color }}>
            +{forecastMinutes} Minutes
          </strong>
        </div>

        <div className="sim-slider-wrapper">
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={forecastMinutes}
            onChange={(e) => onSeekMinutes(parseInt(e.target.value, 10))}
            className="sim-timeline-slider"
            style={{
              background: `linear-gradient(to right, ${status.color} 0%, ${status.color} ${(forecastMinutes / 60) * 100}%, rgba(148, 163, 184, 0.3) ${(forecastMinutes / 60) * 100}%, rgba(148, 163, 184, 0.3) 100%)`,
            }}
          />
        </div>

        {/* Preset Marker Buttons */}
        <div className="sim-preset-markers">
          {presetMinutes.map((m) => (
            <button
              key={m}
              type="button"
              className={`sim-marker-btn ${forecastMinutes === m ? 'active' : ''}`}
              onClick={() => onSeekMinutes(m)}
            >
              {m === 0 ? 'Now' : `+${m}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Dynamic Scenario Metrics */}
      {simMetrics && (
        <div className="sim-dock-metrics-v2">
          <div className="metric-pill">
            <span className="mp-label">Evacuees:</span>
            <strong className="mp-val text-red">
              {(simMetrics.total_affected_population || 0).toLocaleString()}
            </strong>
          </div>
          <div className="metric-pill">
            <span className="mp-label">High Risk:</span>
            <strong className="mp-val text-amber">
              {simMetrics.high_risk_zones_count || 0} zones
            </strong>
          </div>
          {simMetrics.active_spillover_redirections > 0 && (
            <div className="metric-pill pill-spillover" title="Evacuees rerouted due to shelter saturation">
              <span className="mp-label">Spillover:</span>
              <strong className="mp-val text-purple">
                {simMetrics.active_spillover_redirections} active
              </strong>
            </div>
          )}
        </div>
      )}

      {/* Minimize Button */}
      <button
        type="button"
        className="sim-dock-close-btn"
        onClick={() => setIsMinimized(true)}
        title="Minimize Dock"
      >
        Minimize
      </button>
    </div>
  );
}

