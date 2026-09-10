import React, { useState, useMemo } from 'react';

/**
 * Modern Smart Alert System UI for SafeShift Disaster Management Dashboard
 * 
 * Features:
 * - Top horizontal banner with rounded edges & soft light styling
 * - Primary high-risk alert displayed prominently (Zone name, soft red #ff6b6b badge, rainfall/slope trigger)
 * - "+X more alerts" badge & "View All Alerts" dropdown trigger
 * - Smooth slide-down / expansion drawer with color-coded cards (Red #ff6b6b, Orange #f59e0b, Yellow #eab308)
 * - 1-Click "Inspect Zone" action to focus the zone on the map
 */
export default function SmartAlertBanner({
  geoData,
  weatherMeta,
  onSelectZone,
  onLocateZone,
  riskMode = 'baseline',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Extract and aggregate alerts from both live weather triggers and critical high-risk zones
  const alerts = useMemo(() => {
    if (!geoData || !geoData.features) return [];

    const list = [];
    const liveAlerts = weatherMeta?.smart_alerts || [];
    const seenZones = new Set();

    // 1. Live weather surge alerts (Highest priority)
    liveAlerts.forEach((la) => {
      seenZones.add(la.zone);
      list.push({
        id: `live-${la.zone}`,
        zone: la.zone,
        hazardType: la.hazard_type || 'flood',
        riskLevel: 'HIGH',
        riskColor: '#ff6b6b', // Soft modern red
        trigger: `Heavy precipitation (${la.rainfall ?? 115} mm/24h) exceeding hazard threshold`,
        rainfall: la.rainfall ?? 115,
        action: 'Immediate evacuation dispatch required',
        priority: 'immediate',
        isPinned: true,
        source: 'Real-Time Meteorological Trigger',
      });
    });

    // 2. High-priority and active vulnerability zones
    geoData.features.forEach((f) => {
      const p = f.properties || {};
      if (p.safe) return;
      if (seenZones.has(p.area_name)) return;

      const activeRisk = (
        riskMode === 'baseline'
          ? (p.baseline_risk || p.risk || '')
          : (p.risk || p.baseline_risk || '')
      ).toLowerCase();

      const rain = p.rainfall !== undefined ? Number(p.rainfall) : 0;
      const hazard = (p.hazard_type || 'flood').toLowerCase();

      if (activeRisk === 'high' || p.priority === 'immediate') {
        list.push({
          id: `zone-${p.area_name}`,
          zone: p.area_name,
          hazardType: hazard,
          riskLevel: 'HIGH',
          riskColor: '#ff6b6b',
          trigger: hazard === 'landslide'
            ? `Critical slope shear instability & saturated mountain terrain (${rain > 0 ? `${rain}mm rain` : 'Seismic/Rain risk'})`
            : `Severe river basin inundation surge & flood plain exposure (${rain > 0 ? `${rain}mm rain` : 'Catchment discharge'})`,
          rainfall: rain,
          action: 'Immediate evacuation dispatch required',
          priority: 'immediate',
          isPinned: true,
          properties: p,
          source: riskMode === 'live' ? 'Dynamic Forecast Alert' : 'Baseline Vulnerability Alert',
        });
        seenZones.add(p.area_name);
      } else if (activeRisk === 'medium') {
        list.push({
          id: `zone-${p.area_name}`,
          zone: p.area_name,
          hazardType: hazard,
          riskLevel: 'MEDIUM',
          riskColor: '#f59e0b',
          trigger: `Moderate rainfall accumulation (${rain} mm) with potential runoff escalation`,
          rainfall: rain,
          action: 'Prepare contingency evacuation corridors & stage transport',
          priority: 'short-term',
          isPinned: false,
          properties: p,
          source: riskMode === 'live' ? 'Dynamic Forecast Alert' : 'Baseline Vulnerability Alert',
        });
        seenZones.add(p.area_name);
      }
    });

    // Sort: Pinned High Risk first, then Medium Risk
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.rainfall || 0) - (a.rainfall || 0);
    });
  }, [geoData, weatherMeta, riskMode]);

  if (dismissed || alerts.length === 0) {
    return null;
  }

  const primaryAlert = alerts[0];
  const remainingAlertsCount = alerts.length - 1;

  const handleInspectZone = (alertItem) => {
    let targetProps = alertItem.properties;
    if (!targetProps && geoData?.features) {
      const found = geoData.features.find((f) => f.properties?.area_name === alertItem.zone);
      if (found) targetProps = found.properties;
    }
    if (!targetProps) {
      targetProps = { area_name: alertItem.zone, hazard_type: alertItem.hazardType, risk: alertItem.riskLevel };
    }

    if (onLocateZone) {
      onLocateZone(targetProps);
    } else if (onSelectZone) {
      onSelectZone(targetProps);
    }
  };

  return (
    <section className="smart-alert-system-wrapper" aria-label="Smart Disaster Alert Notification Bar">
      {/* Top Rounded Alert Banner */}
      <div className="smart-alert-banner-card">
        {/* Left: Pulse Icon & Primary Alert Info */}
        <div className="smart-alert-primary-content">
          <div className="alert-pulse-badge" title="Live Warning Active">
            <span className="alert-pulse-ring" />
            <span className="alert-pulse-core">🚨</span>
          </div>

          <div className="alert-main-details">
            <span
              className="alert-risk-chip"
              style={{ backgroundColor: `${primaryAlert.riskColor}18`, color: primaryAlert.riskColor, borderColor: `${primaryAlert.riskColor}40` }}
            >
              {primaryAlert.riskLevel}
            </span>

            <span className="alert-zone-title">{primaryAlert.zone}</span>
            <span className="alert-divider-dot">•</span>
            <span className="alert-trigger-snippet" title={primaryAlert.trigger}>
              [{primaryAlert.hazardType?.toUpperCase() || 'HAZARD'}] {primaryAlert.trigger}
            </span>
          </div>

          {remainingAlertsCount > 0 && (
            <span className="alert-more-pill" onClick={() => setIsExpanded(!isExpanded)}>
              +{remainingAlertsCount} more alert{remainingAlertsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="smart-alert-actions">
          <button
            type="button"
            className="btn-inspect-primary"
            onClick={() => handleInspectZone(primaryAlert)}
            title="Inspect this hazard zone on the map"
          >
            Inspect Zone
          </button>

          <button
            type="button"
            className={`btn-toggle-all-alerts ${isExpanded ? 'active' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            title="Expand to view all active multi-hazard alerts"
          >
            <span>{isExpanded ? 'Collapse' : 'View All Alerts'}</span>
            <span className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}>▼</span>
          </button>

          <button
            type="button"
            className="btn-dismiss-smart-banner"
            onClick={() => setDismissed(true)}
            title="Dismiss alert notification"
            aria-label="Dismiss alert"
          >
            x
          </button>
        </div>
      </div>

      {/* Expandable Slide-Down Alerts Drawer */}
      {isExpanded && (
        <div className="smart-alerts-expanded-drawer">
          <div className="alerts-drawer-header">
            <div className="drawer-title-group">
              <h4>Active Disaster Risk Alerts ({alerts.length})</h4>
              <span className="drawer-subtitle">
                Sorted by priority & precipitation triggers • Pinned critical areas
              </span>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setIsExpanded(false)}
            >
              Close
            </button>
          </div>

          <div className="alerts-cards-grid">
            {alerts.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`alert-item-card ${item.isPinned ? 'pinned-card' : ''}`}
                style={{ borderLeftColor: item.riskColor }}
              >
                <div className="card-top-row">
                  <div className="card-zone-heading">
                    {item.isPinned && <span className="pin-icon" title="Pinned High-Priority">[PINNED]</span>}
                    <strong className="card-zone-name">{item.zone}</strong>
                  </div>
                  <span
                    className="card-risk-badge"
                    style={{
                      backgroundColor: `${item.riskColor}15`,
                      color: item.riskColor,
                      borderColor: `${item.riskColor}40`,
                    }}
                  >
                    {item.riskLevel} RISK
                  </span>
                </div>

                <div className="card-trigger-row">
                  <span className="card-metric-label">Trigger:</span>
                  <span className="card-metric-val">{item.trigger}</span>
                </div>

                <div className="card-action-row">
                  <div className="action-text-wrap">
                    <span className="action-bullet">Action:</span>
                    <span className="action-text">{item.action}</span>
                  </div>

                  <button
                    type="button"
                    className="btn-card-inspect"
                    onClick={() => handleInspectZone(item)}
                  >
                    Locate on Map
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
