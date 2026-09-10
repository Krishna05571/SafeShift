import React, { useState, useMemo } from 'react';

/**
 * Dedicated Operations Dashboard for Live Safe Zone Capacity Tracking,
 * Influx Simulation, Predictive Fill Countdown, and Autonomous Evacuation Relocation Dispatch
 */
export default function SafeZoneCapacityPage({
  safeZoneStatus = null,
  geoData = null,
  relocationPlan = [],
  onViewAlternateRoutes = null,
  onLocateZone = null,
  onTraceRoute = null,
  autoRerouteEnabled = true,
  onToggleAutoReroute = null,
  onResetCapacitySimulation = null,
  theme = 'light',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'safe' | 'warning' | 'critical' | 'full'
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'shelters' | 'relocations'

  // 1. Resilient Safe Zones List (Live API or GeoJSON Fallback)
  const safeZonesList = useMemo(() => {
    if (safeZoneStatus?.safe_zones && safeZoneStatus.safe_zones.length > 0) {
      return safeZoneStatus.safe_zones;
    }
    if (geoData?.features) {
      return geoData.features
        .filter((f) => f.properties?.safe || f.properties?.location_type === 'relocation_site')
        .map((f, idx) => {
          const p = f.properties || {};
          const cap = p.capacity || 20000;
          const initialPct = 55 + ((idx % 4) * 11);
          const occ = Math.round((cap * initialPct) / 100);
          const rem = Math.max(0, cap - occ);
          const inflow = 150 + ((idx * 30) % 120);
          const mins = inflow > 0 && rem > 0 ? Math.round(rem / inflow) : 0;
          return {
            id: `sz-${idx}`,
            name: p.area_name || `Safe Zone ${idx + 1}`,
            location_type: p.location_type || 'relocation_site',
            total_capacity: cap,
            current_occupancy: occ,
            remaining_capacity: rem,
            fill_percentage: initialPct,
            centroid_lat: p.centroid_lat || (f.geometry?.coordinates?.[0]?.[0]?.[1] ?? 20.59),
            centroid_lon: p.centroid_lon || (f.geometry?.coordinates?.[0]?.[0]?.[0] ?? 78.96),
            inflow_rate_per_min: inflow,
            estimated_minutes_to_full: mins,
            alert_level: initialPct >= 100 ? 'FULL' : initialPct >= 90 ? 'CRITICAL' : initialPct >= 70 ? 'WARNING' : 'NORMAL',
            alert_message: initialPct >= 100 ? 'Safe Zone FULL – redirecting evacuees' : initialPct >= 90 ? 'Safe Zone almost full – rerouting recommended' : initialPct >= 70 ? 'Safe Zone nearing capacity' : 'Safe Zone capacity optimal',
            status_color: initialPct >= 100 ? '#ef4444' : initialPct >= 90 ? '#ff6b6b' : initialPct >= 70 ? '#f59e0b' : '#10b981',
          };
        });
    }
    return [];
  }, [safeZoneStatus, geoData]);

  // Quick lookup map of safe zone capacities
  const capacityMap = useMemo(() => {
    const map = {};
    safeZonesList.forEach((sz) => {
      map[sz.name] = sz;
    });
    return map;
  }, [safeZonesList]);

  // Summary Metrics
  const summary = useMemo(() => {
    if (safeZoneStatus?.summary && safeZoneStatus.summary.total_shelters > 0) {
      return safeZoneStatus.summary;
    }
    const totalShelters = safeZonesList.length;
    const totalCap = safeZonesList.reduce((acc, z) => acc + (z.total_capacity || 0), 0);
    const totalOcc = safeZonesList.reduce((acc, z) => acc + (z.current_occupancy || 0), 0);
    const totalRem = safeZonesList.reduce((acc, z) => acc + (z.remaining_capacity || 0), 0);
    const overallPct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;
    return {
      total_shelters: totalShelters,
      total_capacity: totalCap,
      total_occupancy: totalOcc,
      total_remaining_capacity: totalRem,
      overall_fill_percentage: overallPct,
    };
  }, [safeZoneStatus, safeZonesList]);

  // Status Filter Counts
  const counts = useMemo(() => {
    let safe = 0;
    let warning = 0;
    let critical = 0;
    let full = 0;

    safeZonesList.forEach((sz) => {
      const fill = sz.fill_percentage ?? 50;
      if (fill >= 100) full++;
      else if (fill >= 90) critical++;
      else if (fill >= 70) warning++;
      else safe++;
    });

    return { all: safeZonesList.length, safe, warning, critical, full };
  }, [safeZonesList]);

  // Filtered Shelter Cards
  const filteredShelters = useMemo(() => {
    return safeZonesList.filter((sz) => {
      const fill = sz.fill_percentage ?? 50;
      const matchesSearch =
        sz.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sz.location_type && sz.location_type.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'safe') matchesStatus = fill < 70;
      else if (statusFilter === 'warning') matchesStatus = fill >= 70 && fill < 90;
      else if (statusFilter === 'critical') matchesStatus = fill >= 90 && fill < 100;
      else if (statusFilter === 'full') matchesStatus = fill >= 100;

      return matchesSearch && matchesStatus;
    });
  }, [safeZonesList, searchTerm, statusFilter]);

  // 2. Active Evacuation Relocations & Autonomous Rerouting Engine
  const activeEvacuations = useMemo(() => {
    if (!relocationPlan || relocationPlan.length === 0) return [];

    // Shelters with ample headroom (<75% fill)
    const availableHavens = safeZonesList.filter((sz) => (sz.fill_percentage ?? 50) < 80);

    return relocationPlan.map((planItem, idx) => {
      const originalDest = planItem.to;
      const targetShelter = capacityMap[originalDest];
      const fill = targetShelter ? (targetShelter.fill_percentage ?? 50) : 60;
      const isCriticalOrFull = fill >= 90;

      let reroutedHaven = null;
      let isAutoRerouted = false;

      if (autoRerouteEnabled && isCriticalOrFull) {
        // Find alternative safe haven with capacity
        reroutedHaven = availableHavens.find((h) => h.name !== originalDest) || availableHavens[idx % Math.max(1, availableHavens.length)] || null;
        if (reroutedHaven) {
          isAutoRerouted = true;
        }
      }

      return {
        ...planItem,
        originalDest,
        effectiveDest: isAutoRerouted && reroutedHaven ? reroutedHaven.name : originalDest,
        effectiveDestCoords: isAutoRerouted && reroutedHaven ? [reroutedHaven.centroid_lat, reroutedHaven.centroid_lon] : planItem.dest_coords,
        isAutoRerouted,
        reroutedHaven,
        primaryFill: fill,
        targetShelter,
        status: isAutoRerouted
          ? 'REROUTED'
          : fill >= 100
          ? 'FULL'
          : fill >= 90
          ? 'CRITICAL'
          : fill >= 70
          ? 'WARNING'
          : 'OPTIMAL',
      };
    });
  }, [relocationPlan, safeZonesList, capacityMap, autoRerouteEnabled]);

  const reroutedCount = useMemo(() => {
    return activeEvacuations.filter((e) => e.isAutoRerouted).length;
  }, [activeEvacuations]);

  return (
    <div className="safezone-page-container">
      {/* 1. Top Operations Banner & Summary Metrics */}
      <div className="capacity-page-hero">
        <div className="hero-top-row">
          <div className="hero-title-group">
            <div className="hero-badge-row">
              <span className="live-radar-dot" />
              <h2>🛡️ Live Safe Zone Capacity & Evacuation Rerouting Center</h2>
              <span className="live-sync-badge">⏱️ Live Influx Active (4s Sync)</span>
            </div>
            <p className="hero-subtitle">
              Monitor real-time shelter bed utilization, predict saturation horizons, and autonomously reroute evacuees when safe havens reach peak capacity.
            </p>
          </div>

          <div className="hero-controls-group">
            <div className="auto-reroute-card">
              <div className="auto-reroute-header">
                <span className="auto-icon">⚡</span>
                <span className="auto-label">Auto-Rerouting (≥90% Load):</span>
              </div>
              <button
                type="button"
                className={`auto-toggle-btn ${autoRerouteEnabled ? 'btn-active-auto' : 'btn-manual'}`}
                onClick={onToggleAutoReroute}
                title="Automatically redirect incoming disaster victims to the nearest alternative haven when a shelter reaches 90% capacity"
              >
                {autoRerouteEnabled ? '✓ ENABLED (Autonomous)' : 'MANUAL DISPATCH'}
              </button>
            </div>

            {onResetCapacitySimulation && (
              <button
                type="button"
                className="btn-hero-reset"
                onClick={onResetCapacitySimulation}
                title="Reset live occupancy simulation back to baseline"
              >
                🔄 Reset Simulation
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="capacity-kpi-grid">
          <div className="cap-kpi-card">
            <span className="cap-kpi-icon">🏨</span>
            <div className="cap-kpi-info">
              <span className="cap-kpi-label">Designated Shelters</span>
              <strong className="cap-kpi-val">{summary.total_shelters || safeZonesList.length}</strong>
              <span className="cap-kpi-hint">Monitored across India</span>
            </div>
          </div>

          <div className="cap-kpi-card">
            <span className="cap-kpi-icon">🛏️</span>
            <div className="cap-kpi-info">
              <span className="cap-kpi-label">Total Shelter Capacity</span>
              <strong className="cap-kpi-val">{(summary.total_capacity || 0).toLocaleString()}</strong>
              <span className="cap-kpi-hint">Emergency beds available</span>
            </div>
          </div>

          <div className="cap-kpi-card">
            <span className="cap-kpi-icon">👥</span>
            <div className="cap-kpi-info">
              <span className="cap-kpi-label">Current Occupancy</span>
              <strong className="cap-kpi-val text-blue">
                {(summary.total_occupancy || 0).toLocaleString()}
              </strong>
              <span className="cap-kpi-hint">
                {summary.overall_fill_percentage || 0}% national saturation
              </span>
            </div>
          </div>

          <div className="cap-kpi-card">
            <span className="cap-kpi-icon">
              {reroutedCount > 0 ? '⚡' : (counts.critical + counts.full) > 0 ? '🚨' : '🟢'}
            </span>
            <div className="cap-kpi-info">
              <span className="cap-kpi-label">Auto-Rerouted Corridors</span>
              <strong className={`cap-kpi-val ${reroutedCount > 0 ? 'text-green' : (counts.critical + counts.full) > 0 ? 'text-danger' : 'text-success'}`}>
                {reroutedCount} Active
              </strong>
              <span className="cap-kpi-hint">
                {counts.full > 0 ? `${counts.full} shelters full, ` : ''}{counts.critical} nearing capacity
              </span>
            </div>
          </div>
        </div>

        {/* National Shelter Load Progress Bar */}
        <div className="national-load-bar-wrap">
          <div className="load-bar-header">
            <span className="load-title">National Shelter Load Index:</span>
            <strong className="load-pct">{summary.overall_fill_percentage || 0}% Saturation</strong>
          </div>
          <div className="national-track">
            <div
              className="national-fill"
              style={{
                width: `${Math.min(100, summary.overall_fill_percentage || 0)}%`,
                backgroundColor:
                  (summary.overall_fill_percentage || 0) >= 90
                    ? '#ef4444'
                    : (summary.overall_fill_percentage || 0) >= 70
                    ? '#f59e0b'
                    : '#10b981',
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Section Navigation Tabs */}
      <div className="capacity-section-tabs">
        <button
          type="button"
          className={`sec-tab-btn ${activeSection === 'all' || activeSection === 'relocations' ? 'active' : ''}`}
          onClick={() => setActiveSection(activeSection === 'relocations' ? 'all' : 'relocations')}
        >
          ⚡ Autonomous Relocations & Rerouting Matrix ({activeEvacuations.length} Corridors)
        </button>
        <button
          type="button"
          className={`sec-tab-btn ${activeSection === 'shelters' ? 'active' : ''}`}
          onClick={() => setActiveSection('shelters')}
        >
          🏨 Shelter Capacity Cards ({safeZonesList.length} Havens)
        </button>
      </div>

      {/* 3. Autonomous Relocation & Evacuation Dispatch Matrix */}
      {(activeSection === 'all' || activeSection === 'relocations') && (
        <div className="auto-relocation-section">
          <div className="auto-section-header">
            <div className="auto-sec-title-wrap">
              <span className="auto-sec-icon">⚡</span>
              <div>
                <h3 className="auto-sec-title">Live Evacuation Relocations & Autonomous Rerouting Status</h3>
                <p className="auto-sec-desc">
                  Real-time mapping of hazard origins to assigned safe havens. High-load havens (≥90%) are autonomously diverted to nearby shelters with headroom.
                </p>
              </div>
            </div>
            {autoRerouteEnabled && reroutedCount > 0 && (
              <span className="auto-reroute-active-tag">
                ✓ {reroutedCount} Evacuation Corridors Autonomously Rerouted
              </span>
            )}
          </div>

          <div className="relocation-matrix-table-wrap">
            <table className="relocation-matrix-table">
              <thead>
                <tr>
                  <th>Hazard Origin Zone</th>
                  <th>Risk Level</th>
                  <th>Evacuees</th>
                  <th>Primary Safe Haven</th>
                  <th>Primary Shelter Load</th>
                  <th>Active Evacuation Route</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeEvacuations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      Loading active evacuation corridors...
                    </td>
                  </tr>
                ) : (
                  activeEvacuations.map((evac, eIdx) => {
                    const isHigh = evac.risk === 'high';
                    const isMedium = evac.risk === 'medium';
                    const riskBadgeClass = isHigh ? 'pill-high' : isMedium ? 'pill-medium' : 'pill-low';

                    return (
                      <tr
                        key={`evac-row-${eIdx}-${evac.from}-${evac.effectiveDest}`}
                        className={evac.isAutoRerouted ? 'row-auto-rerouted' : evac.status === 'CRITICAL' ? 'row-warning' : ''}
                      >
                        <td className="font-semibold text-main">
                          📍 {evac.from}
                        </td>
                        <td>
                          <span className={`risk-pill ${riskBadgeClass}`}>
                            {(evac.risk || 'MEDIUM').toUpperCase()}
                          </span>
                        </td>
                        <td className="font-bold text-blue">
                          👥 {(evac.people || 0).toLocaleString()}
                        </td>
                        <td>
                          <span className="shelter-name-text">🛡️ {evac.originalDest}</span>
                        </td>
                        <td>
                          <div className="table-load-cell">
                            <div className="table-load-track">
                              <div
                                className="table-load-fill"
                                style={{
                                  width: `${Math.min(100, evac.primaryFill)}%`,
                                  backgroundColor:
                                    evac.primaryFill >= 100
                                      ? '#ef4444'
                                      : evac.primaryFill >= 90
                                      ? '#ff6b6b'
                                      : evac.primaryFill >= 70
                                      ? '#f59e0b'
                                      : '#10b981',
                                }}
                              />
                            </div>
                            <span className="table-load-pct">{evac.primaryFill}%</span>
                          </div>
                        </td>
                        <td>
                          {evac.isAutoRerouted ? (
                            <div className="reroute-destination-tag">
                              <span className="reroute-badge">⚡ AUTONOMOUSLY REROUTED</span>
                              <strong className="rerouted-name">➔ {evac.effectiveDest}</strong>
                              <span className="reroute-subtext">
                                Headroom: {evac.reroutedHaven?.remaining_capacity?.toLocaleString()} beds ({evac.reroutedHaven?.fill_percentage}% load)
                              </span>
                            </div>
                          ) : (
                            <div className="direct-route-tag">
                              <span className="direct-badge">🟢 DIRECT DISPATCH</span>
                              <span className="direct-name">➔ {evac.originalDest}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="table-actions-cell">
                            <button
                              type="button"
                              className="btn-matrix-trace"
                              onClick={() => {
                                if (onTraceRoute) {
                                  onTraceRoute(evac);
                                } else if (onLocateZone) {
                                  onLocateZone({
                                    area_name: evac.from,
                                    centroid_lat: evac.origin_coords?.[0],
                                    centroid_lon: evac.origin_coords?.[1],
                                  });
                                }
                              }}
                              title="Inspect evacuation highway corridor on map"
                            >
                              🛣️ Map
                            </button>

                            <button
                              type="button"
                              className="btn-matrix-alt"
                              onClick={() => {
                                if (onViewAlternateRoutes) {
                                  onViewAlternateRoutes({
                                    name: evac.effectiveDest,
                                    lat: evac.effectiveDestCoords?.[0] || evac.dest_coords?.[0],
                                    lon: evac.effectiveDestCoords?.[1] || evac.dest_coords?.[1],
                                    remaining_capacity: evac.targetShelter?.remaining_capacity,
                                    fill_percentage: evac.primaryFill,
                                  });
                                }
                              }}
                              title="Explore alternate corridors and multi-routes"
                            >
                              🔄 Alts
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Filter & Search Controls for Shelter Cards */}
      {(activeSection === 'all' || activeSection === 'shelters') && (
        <>
          <div className="shelter-filter-bar">
            <div className="filter-pill-group">
              <button
                type="button"
                className={`status-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All Shelters ({counts.all})
              </button>
              <button
                type="button"
                className={`status-pill-btn pill-btn-safe ${statusFilter === 'safe' ? 'active' : ''}`}
                onClick={() => setStatusFilter('safe')}
              >
                🟢 Safe &lt;70% ({counts.safe})
              </button>
              <button
                type="button"
                className={`status-pill-btn pill-btn-warning ${statusFilter === 'warning' ? 'active' : ''}`}
                onClick={() => setStatusFilter('warning')}
              >
                🟡 Warning 70-90% ({counts.warning})
              </button>
              <button
                type="button"
                className={`status-pill-btn pill-btn-critical ${statusFilter === 'critical' ? 'active' : ''}`}
                onClick={() => setStatusFilter('critical')}
              >
                🔴 Critical &gt;90% ({counts.critical})
              </button>
              <button
                type="button"
                className={`status-pill-btn pill-btn-full ${statusFilter === 'full' ? 'active' : ''}`}
                onClick={() => setStatusFilter('full')}
              >
                ⛔ Full 100% ({counts.full})
              </button>
            </div>

            <div className="search-wrap">
              <input
                type="text"
                className="shelter-search-input"
                placeholder="🔍 Search shelter by name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Grid of Safe Zone Operational Cards */}
          <div className="shelters-operational-grid">
            {filteredShelters.length === 0 ? (
              <div className="no-shelters-card">
                <p>No safe shelters match the selected filter or search term.</p>
              </div>
            ) : (
              filteredShelters.map((sz) => {
                const fill = sz.fill_percentage ?? 50;
                const isFull = fill >= 100;
                const isCritical = fill >= 90 && !isFull;
                const isWarning = fill >= 70 && fill < 90;
                const statusColor = isFull ? '#ef4444' : isCritical ? '#ff6b6b' : isWarning ? '#f59e0b' : '#10b981';

                return (
                  <div
                    key={sz.name}
                    className={`shelter-op-card ${isFull ? 'card-full' : isCritical ? 'card-critical' : isWarning ? 'card-warning' : 'card-safe'}`}
                    style={{ borderTopColor: statusColor }}
                  >
                    <div className="op-card-header">
                      <div className="op-name-wrap">
                        <span className="op-type-tag">🛡️ {sz.location_type || 'Relocation Haven'}</span>
                        <h4 className="op-shelter-title">{sz.name}</h4>
                      </div>

                      <span
                        className="op-status-badge"
                        style={{
                          backgroundColor: `${statusColor}18`,
                          color: statusColor,
                          borderColor: `${statusColor}40`,
                        }}
                      >
                        {isFull ? '⛔ 100% FULL' : isCritical ? '🚨 CRITICAL' : isWarning ? '⚠️ WARNING' : '🟢 SAFE'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="op-progress-section">
                      <div className="op-progress-labels">
                        <span className="op-numbers">
                          Occupancy: <strong>{sz.current_occupancy?.toLocaleString()}</strong> / {sz.total_capacity?.toLocaleString()}
                        </span>
                        <strong className="op-pct-val" style={{ color: statusColor }}>
                          {fill}%
                        </strong>
                      </div>
                      <div className="op-track">
                        <div
                          className="op-fill"
                          style={{
                            width: `${Math.min(100, fill)}%`,
                            backgroundColor: statusColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Metrics Breakdown */}
                    <div className="op-metrics-grid">
                      <div className="op-metric-box">
                        <span className="op-m-label">Remaining Capacity:</span>
                        <strong className="op-m-val">{sz.remaining_capacity?.toLocaleString()} beds</strong>
                      </div>
                      <div className="op-metric-box">
                        <span className="op-m-label">Evacuee Inflow:</span>
                        <strong className="op-m-val">+{sz.inflow_rate_per_min || 150} / min</strong>
                      </div>
                    </div>

                    {/* Predictive Fill Countdown Banner */}
                    {sz.estimated_minutes_to_full !== null && (
                      <div className={`op-predictive-banner ${isCritical || isFull ? 'banner-urgent' : ''}`}>
                        <span className="predictive-clock">⏱️</span>
                        <span>
                          {isFull
                            ? 'Capacity Exhausted — Diverting all evacuees to alternate havens'
                            : `Predicted 100% saturation in ~${sz.estimated_minutes_to_full} mins`}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="op-actions-row">
                      <button
                        type="button"
                        className="btn-op-alternates"
                        onClick={() => {
                          if (onViewAlternateRoutes) {
                            onViewAlternateRoutes({
                              name: sz.name,
                              lat: sz.centroid_lat,
                              lon: sz.centroid_lon,
                              remaining_capacity: sz.remaining_capacity,
                              fill_percentage: sz.fill_percentage,
                            });
                          }
                        }}
                      >
                        🔄 View Alternate Corridors
                      </button>

                      <button
                        type="button"
                        className="btn-op-locate"
                        onClick={() => {
                          if (onLocateZone) {
                            onLocateZone({
                              area_name: sz.name,
                              centroid_lat: sz.centroid_lat,
                              centroid_lon: sz.centroid_lon,
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
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

