import React, { useState } from 'react';

/**
 * Floating Stacked Toast Notifications for Live Safe Zone Capacity Thresholds (70%, 90%, 100%)
 */
export default function CapacityToastStack({
  alerts = [],
  onViewAlternateRoutes,
  onLocateZone,
  theme = 'light',
}) {
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id || a.zone_name));

  if (visibleAlerts.length === 0) return null;

  const handleDismiss = (id, e) => {
    e.stopPropagation();
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  return (
    <aside className="capacity-toast-stack-container" aria-label="Live Capacity Warning Stack">
      <div className="toast-stack-header">
        <div className="toast-header-info">
          <span className="live-pulse-dot" />
          <span className="toast-header-title">
            Shelter Capacity Alerts ({visibleAlerts.length})
          </span>
        </div>
        <button
          type="button"
          className="toast-collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand alerts' : 'Collapse stack'}
        >
          {collapsed ? '▲ Expand' : '▼ Minimize'}
        </button>
      </div>

      {!collapsed && (
        <div className="toast-cards-list">
          {visibleAlerts.slice(0, 4).map((alert) => {
            const isFull = alert.alert_level === 'FULL';
            const isCritical = alert.alert_level === 'CRITICAL';
            const badgeColor = isFull ? '#ef4444' : isCritical ? '#ff6b6b' : '#f59e0b';

            return (
              <div
                key={alert.id || alert.zone_name}
                className={`capacity-toast-card ${isFull ? 'toast-full' : isCritical ? 'toast-critical' : 'toast-warning'}`}
                style={{ borderLeftColor: badgeColor }}
              >
                <div className="toast-card-top">
                  <div className="toast-zone-group">
                    <span className="toast-status-icon">
                      {isFull ? '⛔' : isCritical ? '🚨' : '⚠️'}
                    </span>
                    <strong className="toast-zone-name">{alert.zone_name}</strong>
                  </div>

                  <span
                    className="toast-fill-badge"
                    style={{
                      backgroundColor: `${badgeColor}18`,
                      color: badgeColor,
                      borderColor: `${badgeColor}40`,
                    }}
                  >
                    {alert.fill_percentage}% FULL
                  </span>

                  <button
                    type="button"
                    className="toast-dismiss-btn"
                    onClick={(e) => handleDismiss(alert.id || alert.zone_name, e)}
                    title="Dismiss alert"
                  >
                    ✕
                  </button>
                </div>

                <p className="toast-message">{alert.message}</p>

                <div className="toast-meta-row">
                  <span className="toast-remaining">
                    Remaining: <strong>{alert.remaining_capacity?.toLocaleString()}</strong> slots
                  </span>
                  {alert.estimated_minutes_to_full !== null && alert.estimated_minutes_to_full > 0 && (
                    <span className="toast-eta">
                      ⏱️ Full in ~{alert.estimated_minutes_to_full} mins
                    </span>
                  )}
                </div>

                {/* Progress Mini-Bar */}
                <div className="toast-progress-track">
                  <div
                    className="toast-progress-bar"
                    style={{
                      width: `${Math.min(100, alert.fill_percentage)}%`,
                      backgroundColor: badgeColor,
                    }}
                  />
                </div>

                <div className="toast-actions-row">
                  <button
                    type="button"
                    className="btn-toast-alt-routes"
                    onClick={() => {
                      if (onViewAlternateRoutes) {
                        onViewAlternateRoutes({
                          name: alert.zone_name,
                          lat: alert.centroid_lat,
                          lon: alert.centroid_lon,
                          remaining_capacity: alert.remaining_capacity,
                          fill_percentage: alert.fill_percentage,
                        });
                      }
                    }}
                  >
                    🔄 View Alternate Routes
                  </button>

                  <button
                    type="button"
                    className="btn-toast-locate"
                    onClick={() => {
                      if (onLocateZone) {
                        onLocateZone({
                          area_name: alert.zone_name,
                          centroid_lat: alert.centroid_lat,
                          centroid_lon: alert.centroid_lon,
                          safe: true,
                        });
                      }
                    }}
                  >
                    📍 Locate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
