import React, { useState } from 'react';

export default function SimulationController({
  timeStep,
  isSimulating,
  onStartSimulation,
  onPauseSimulation,
  onResetSimulation,
  onSelectStep,
  simMetrics,
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  const steps = [
    { t: 0, label: 'T=0', title: 'Normal' },
    { t: 1, label: 'T=1', title: 'Medium Expands' },
    { t: 2, label: 'T=2', title: 'High Spreads' },
    { t: 3, label: 'T=3', title: 'Peak Emergency' },
  ];

  const phaseColors = {
    0: { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399', border: '#10b981', label: 'T=0: Baseline' },
    1: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c', border: '#f97316', label: 'T=1: Inundation (+35%)' },
    2: { bg: 'rgba(239, 68, 68, 0.25)', text: '#f87171', border: '#ef4444', label: 'T=2: Critical (+65%)' },
    3: { bg: 'rgba(168, 85, 247, 0.25)', text: '#c084fc', border: '#a855f7', label: 'T=3: Peak Emergency' },
  };

  const currentPhase = phaseColors[timeStep] || phaseColors[0];

  if (isMinimized) {
    return (
      <div className="sim-dock-minimized">
        <button
          type="button"
          className="sim-dock-min-btn"
          onClick={() => setIsMinimized(false)}
          title="Open Disaster Simulation Dock"
        >
          <span className="sim-pulse-dot" style={{ backgroundColor: currentPhase.border }} />
          <span>⚡ Simulator: {currentPhase.label}</span>
          <span className="expand-icon">▲</span>
        </button>
      </div>
    );
  }

  return (
    <div className="sim-dock-container">
      {/* Left: Brand / Title */}
      <div className="sim-dock-header">
        <span className="sim-dock-icon">⚡</span>
        <div className="sim-dock-titles">
          <span className="sim-dock-title">Disaster Simulator</span>
          <span className="sim-dock-phase" style={{ color: currentPhase.text }}>
            {currentPhase.label}
          </span>
        </div>
      </div>

      {/* Center: Play/Pause & Reset Controls */}
      <div className="sim-dock-actions">
        {!isSimulating ? (
          <button
            type="button"
            className="sim-dock-btn sim-dock-btn-play"
            onClick={onStartSimulation}
            title="Start automated dynamic disaster simulation"
          >
            ▶ Play
          </button>
        ) : (
          <button
            type="button"
            className="sim-dock-btn sim-dock-btn-pause"
            onClick={onPauseSimulation}
            title="Pause simulation"
          >
            ⏸ Pause
          </button>
        )}

        <button
          type="button"
          className="sim-dock-btn sim-dock-btn-reset"
          onClick={onResetSimulation}
          title="Reset to baseline"
        >
          🔄
        </button>
      </div>

      {/* Step Selector Buttons */}
      <div className="sim-dock-steps">
        {steps.map((s) => (
          <button
            key={s.t}
            type="button"
            className={`sim-dock-step-btn ${timeStep === s.t ? 'active' : ''}`}
            onClick={() => onSelectStep(s.t)}
          >
            <strong>{s.label}</strong>
            <span className="step-sub">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Affected Metrics Badge */}
      {simMetrics && (
        <div className="sim-dock-metrics">
          <span className="metrics-label">Evacuees:</span>
          <strong className="metrics-val">
            {(simMetrics.total_affected_population || 0).toLocaleString()}
          </strong>
        </div>
      )}

      {/* Minimize Button */}
      <button
        type="button"
        className="sim-dock-close-btn"
        onClick={() => setIsMinimized(true)}
        title="Minimize Dock"
      >
        ▼
      </button>
    </div>
  );
}
