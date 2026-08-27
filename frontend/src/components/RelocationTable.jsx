import React, { useState } from 'react';

export default function RelocationTable({ relocationPlan = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');

  const filteredPlan = relocationPlan.filter((item) => {
    const matchesSearch =
      item.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hazard_type && item.hazard_type.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRisk =
      filterRisk === 'all' || (item.risk && item.risk.toLowerCase() === filterRisk.toLowerCase());

    return matchesSearch && matchesRisk;
  });

  return (
    <div className="table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-title">📋 Live Relocation & Evacuation Dispatch Plan</h3>
          <p className="table-subtitle">
            Optimal algorithmic matching based on hazard priority, real-world road routing, and shelter capacity
          </p>
        </div>

        <div className="table-controls">
          <input
            type="text"
            className="table-search-input"
            placeholder="🔍 Search zones..."
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
              <th>Risk Level</th>
              <th>Priority Score</th>
              <th>Matched Safe Shelter (To)</th>
              <th>People Relocated</th>
              <th>Road Distance</th>
              <th>Est. Travel Time</th>
              <th>Status</th>
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
                const risk = (item.risk || 'medium').toLowerCase();
                const isHigh = risk === 'high';
                const isMedium = risk === 'medium';

                return (
                  <tr key={idx} className={`table-row-${risk}`}>
                    <td>
                      <div className="table-cell-zone">
                        <strong>{item.from}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="hazard-type-tag">
                        {item.hazard_type === 'landslide' ? '⛰️ Landslide' : '🌊 Flood'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge-risk ${
                          isHigh ? 'badge-high' : isMedium ? 'badge-medium' : 'badge-low'
                        }`}
                      >
                        {risk.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="priority-score-badge font-mono">
                        {item.priority_score.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div className="safe-destination-tag">
                        <span>🛡️</span>
                        <strong>{item.to}</strong>
                      </div>
                    </td>
                    <td>
                      <strong className="text-highlight-people font-mono">
                        {item.people.toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      <span className="distance-badge font-mono">
                        {item.distance_km ? `${item.distance_km} km` : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="time-badge font-mono">
                        {item.travel_time_min ? `⏱️ ${item.travel_time_min} min` : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge-optimal">
                        ✓ Optimal Match
                      </span>
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
        <span className="algorithm-note">⚡ Real-world road routing distance & travel time estimation</span>
      </div>
    </div>
  );
}
