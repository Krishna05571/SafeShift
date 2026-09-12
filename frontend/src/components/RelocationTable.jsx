import React, { useState } from 'react';

export default function RelocationTable({
  relocationPlan = [],
  geoData = null,
  riskMode = 'baseline',
  theme = 'light',
  onTraceRoute = null,
  onLocateZone = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');

  const filteredPlan = relocationPlan.filter((item) => {
    const zoneFeat = geoData?.features?.find((f) => f.properties?.area_name === item.from);
    const activeRisk = (
      riskMode === 'baseline'
        ? (zoneFeat?.properties?.baseline_risk || item.baseline_risk || item.risk || 'medium')
        : (item.risk || zoneFeat?.properties?.risk || 'medium')
    ).toLowerCase();

    const matchesSearch =
      item.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hazard_type && item.hazard_type.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRisk =
      filterRisk === 'all' || activeRisk === filterRisk.toLowerCase();

    return matchesSearch && matchesRisk;
  });

  return (
    <div className="table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-title">
            Relocation & Evacuation Dispatch Plan ({riskMode === 'live' ? 'Live Weather Risk' : 'Baseline Vulnerability Mode'})
          </h3>
          <p className="table-subtitle">
            Optimal algorithmic matching based on hazard priority, real-world road routing, and shelter capacity
          </p>
        </div>

        <div className="table-controls">
          <input
            type="text"
            className="table-search-input"
            placeholder="Search zones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="table-filter-select"
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="safeshift-table">
          <thead>
            <tr>
              <th>Hazard Origin (From)</th>
              <th>Hazard Type</th>
              <th>Risk Level ({riskMode === 'live' ? 'Live' : 'Baseline'})</th>
              <th>Priority Score</th>
              <th>Matched Safe Shelter (To)</th>
              <th>People Relocated</th>
              <th>Road Distance</th>
              <th>Est. Travel Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlan.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-empty">
                  No relocation records found.
                </td>
              </tr>
            ) : (
              filteredPlan.map((item, idx) => {
                const zoneFeat = geoData?.features?.find((f) => f.properties?.area_name === item.from);
                const activeRisk = (
                  riskMode === 'baseline'
                    ? (zoneFeat?.properties?.baseline_risk || item.baseline_risk || item.risk || 'medium')
                    : (item.risk || zoneFeat?.properties?.risk || 'medium')
                ).toLowerCase();

                const isHigh = activeRisk === 'high';
                const isMedium = activeRisk === 'medium';
                const isUnassigned = item.to?.includes('UNASSIGNED');

                return (
                  <tr key={idx} className={`table-row-${activeRisk}`}>
                    <td>
                      <div className="table-cell-zone">
                        <strong>{item.from}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="hazard-type-tag">
                        {item.hazard_type === 'landslide' ? 'Landslide' : 'Flood'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge-risk ${
                          isHigh ? 'badge-high' : isMedium ? 'badge-medium' : 'badge-low'
                        }`}
                      >
                        {activeRisk.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="priority-score-badge font-mono">
                        {item.priority_score?.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div className="safe-destination-tag">
                        <strong>{item.to}</strong>
                      </div>
                    </td>
                    <td>
                      <strong className="text-highlight-people font-mono">
                        {item.people?.toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      <span className="distance-badge font-mono">
                        {item.distance_km ? `${item.distance_km} km` : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="time-badge font-mono">
                        {item.travel_time_min ? `${item.travel_time_min} min` : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions-cell">
                        {onTraceRoute && !isUnassigned && (
                          <button
                            type="button"
                            className="btn-matrix-trace"
                            onClick={() => {
                              onTraceRoute({
                                ...item,
                                origin_coords: item.origin_coords || (zoneFeat?.properties ? [zoneFeat.properties.centroid_lat, zoneFeat.properties.centroid_lon] : null),
                              });
                            }}
                            title="Trace highway evacuation route on GIS map"
                          >
                            Trace
                          </button>
                        )}
                        {onLocateZone && (
                          <button
                            type="button"
                            className="btn-matrix-alt"
                            onClick={() => onLocateZone(zoneFeat?.properties || { area_name: item.from })}
                            title="Locate zone on map"
                          >
                            Locate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>Showing {filteredPlan.length} of {relocationPlan.length} evacuation routes</span>
        <span className="algorithm-note">
          Mode: <strong>{riskMode === 'live' ? 'Live Meteorological Prediction' : 'Baseline Vulnerability'}</strong> • Real-world road routing distance & duration
        </span>
      </div>
    </div>
  );
}

