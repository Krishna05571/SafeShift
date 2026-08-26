import React, { useState } from 'react';
import { RISK_COLORS } from '../utils/styles';

export default function Legend({ stats = {} }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="legend-container">
      <div className="legend-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="legend-title">
          <span className="legend-icon">🧭</span>
          <span>Risk & Safety Legend</span>
        </div>
        <button
          type="button"
          className="legend-toggle-btn"
          aria-label="Toggle Legend"
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="legend-body">
          <div className="legend-item">
            <span
              className="legend-color-box"
              style={{
                backgroundColor: RISK_COLORS.high.fill,
                borderColor: RISK_COLORS.high.border,
              }}
            />
            <div className="legend-text">
              <strong>High Risk</strong>
              <span>Immediate evacuation ({stats.highRiskCount || 0})</span>
            </div>
          </div>

          <div className="legend-item">
            <span
              className="legend-color-box"
              style={{
                backgroundColor: RISK_COLORS.medium.fill,
                borderColor: RISK_COLORS.medium.border,
              }}
            />
            <div className="legend-text">
              <strong>Medium Risk</strong>
              <span>Short-term action ({stats.mediumRiskCount || 0})</span>
            </div>
          </div>

          <div className="legend-item">
            <span
              className="legend-color-box"
              style={{
                backgroundColor: RISK_COLORS.low.fill,
                borderColor: RISK_COLORS.low.border,
              }}
            />
            <div className="legend-text">
              <strong>Low Risk</strong>
              <span>Active monitoring ({stats.lowRiskCount || 0})</span>
            </div>
          </div>

          <div className="legend-divider" />

          <div className="legend-item">
            <span
              className="legend-color-box"
              style={{
                backgroundColor: RISK_COLORS.safe.fill,
                borderColor: RISK_COLORS.safe.border,
              }}
            />
            <div className="legend-text">
              <strong>Safe Zone</strong>
              <span>Designated shelter ({stats.safeZoneCount || 0})</span>
            </div>
          </div>

          <div className="legend-tip">
            💡 <em>Click any polygon on the map for live evacuation metrics</em>
          </div>
        </div>
      )}
    </div>
  );
}
