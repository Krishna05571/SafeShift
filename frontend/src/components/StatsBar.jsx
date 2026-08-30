import React from 'react';

export default function StatsBar({
  stats,
  selectedFilters = ['all'],
  onToggleFilter,
  selectedFilter, // backward compatibility fallback
  onSelectFilter,
}) {
  const activeFilters = Array.isArray(selectedFilters)
    ? selectedFilters
    : [selectedFilter || 'all'];

  const handleChipClick = (id) => {
    if (onToggleFilter) {
      onToggleFilter(id);
    } else if (onSelectFilter) {
      onSelectFilter(id);
    }
  };

  const filters = [
    { id: 'all', label: 'All Zones', count: stats.totalZones },
    { id: 'high', label: '🔴 High Risk', count: stats.highRiskCount },
    { id: 'medium', label: '🟠 Medium Risk', count: stats.mediumRiskCount },
    { id: 'low', label: '🟡 Low Risk', count: stats.lowRiskCount },
    { id: 'safe', label: '🟢 Safe Zones', count: stats.safeZoneCount },
    { id: 'landslide', label: '⛰️ Landslide', count: stats.landslideCount },
    { id: 'flood', label: '🌊 Flood', count: stats.floodCount },
  ];

  return (
    <div className="stats-header-container">
      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">🗺️</div>
          <div className="metric-content">
            <span className="metric-label">Monitored Zones</span>
            <span className="metric-value">{stats.totalZones || 0}</span>
          </div>
        </div>

        <div className="metric-card alert-card">
          <div className="metric-icon">⚠️</div>
          <div className="metric-content">
            <span className="metric-label">High-Risk Zones</span>
            <span className="metric-value text-red">{stats.highRiskCount || 0}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <span className="metric-label">Vulnerable Population</span>
            <span className="metric-value text-orange">
              {(stats.totalPopulation || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="metric-card safe-card">
          <div className="metric-icon">🛡️</div>
          <div className="metric-content">
            <span className="metric-label">Shelter Capacity</span>
            <span className="metric-value text-green">
              {(stats.totalCapacity || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Selectable Filter Chips Bar */}
      <div className="filter-chips-bar">
        <span className="filter-title">Filter Layer:</span>
        <div className="filter-chips">
          {filters.map((f) => {
            const isChipActive = activeFilters.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={`filter-chip ${isChipActive ? 'active' : ''}`}
                onClick={() => handleChipClick(f.id)}
                title={
                  f.id === 'all'
                    ? 'Show all zones (clears other filters)'
                    : `Toggle ${f.label} filter`
                }
              >
                {f.label}
                {f.count !== undefined && (
                  <span className="filter-chip-count">{f.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
