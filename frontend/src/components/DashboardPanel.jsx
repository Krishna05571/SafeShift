import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import RelocationTable from './RelocationTable';

const PIE_COLORS = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#eab308',
};

// Custom Tooltip for charts supporting theme
const CustomBarTooltip = ({ active, payload, label, theme }) => {
  if (active && payload && payload.length) {
    const isLight = theme === 'light';
    return (
      <div
        className="chart-tooltip"
        style={{
          background: isLight ? '#ffffff' : '#1e293b',
          borderColor: isLight ? '#e2e8f0' : '#475569',
          color: isLight ? '#0f172a' : '#ffffff',
          boxShadow: isLight
            ? '0 10px 25px rgba(0, 0, 0, 0.1)'
            : '0 8px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <p
          className="chart-tooltip-title"
          style={{
            color: isLight ? '#0f172a' : '#ffffff',
            borderColor: isLight ? '#e2e8f0' : '#334155',
          }}
        >
          {label}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: '3px 0', fontSize: '12px' }}>
            <strong>{entry.name}: </strong>
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPanel({
  geoData,
  relocationPlan = [],
  theme = 'dark',
}) {
  const isLight = theme === 'light';
  const gridColor = isLight ? '#e2e8f0' : '#334155';
  const axisTextColor = isLight ? '#64748b' : '#94a3b8';

  // 1. Calculate Required Core KPI Metrics
  const metrics = useMemo(() => {
    let highRiskPopulation = 0;
    let immediatePriorityCount = 0;
    let totalSafeCapacity = 0;
    let totalRelocatedPeople = 0;

    // From geoData
    if (geoData && geoData.features) {
      geoData.features.forEach((f) => {
        const p = f.properties || {};
        const isSafe = p.safe === true || p.location_type === 'relocation_site';

        if (isSafe) {
          totalSafeCapacity += Number(p.capacity) || 0;
        } else {
          const risk = (p.risk || '').toLowerCase();
          const priority = (p.priority || '').toLowerCase();
          const population = Number(p.population) || 0;

          if (risk === 'high') {
            highRiskPopulation += population;
          }
          if (priority === 'immediate') {
            immediatePriorityCount += 1;
          }
        }
      });
    }

    // From relocationPlan
    if (relocationPlan && relocationPlan.length > 0) {
      totalRelocatedPeople = relocationPlan.reduce(
        (sum, item) => sum + (Number(item.people) || 0),
        0
      );
    }

    return {
      highRiskPopulation,
      immediatePriorityCount,
      totalSafeCapacity,
      totalRelocatedPeople,
    };
  }, [geoData, relocationPlan]);

  // 2. Chart Data: Relocation Allocations by Origin & Destination
  const routeChartData = useMemo(() => {
    if (!relocationPlan || relocationPlan.length === 0) return [];
    return relocationPlan.map((r) => ({
      name: r.from.replace(' Zone', ''),
      fullName: r.from,
      destination: r.to,
      people: r.people,
      distance: r.distance_km || 0,
      priority: r.priority_score,
      risk: (r.risk || 'medium').toUpperCase(),
    }));
  }, [relocationPlan]);

  // 3. Chart Data: Population Distribution by Risk Level
  const riskDistributionData = useMemo(() => {
    if (!geoData || !geoData.features) return [];
    const counts = { high: 0, medium: 0, low: 0 };

    geoData.features.forEach((f) => {
      const p = f.properties || {};
      if (!p.safe) {
        const risk = (p.risk || 'low').toLowerCase();
        if (counts[risk] !== undefined) {
          counts[risk] += Number(p.population) || 0;
        }
      }
    });

    return [
      { name: 'High Risk', value: counts.high, color: PIE_COLORS.high },
      { name: 'Medium Risk', value: counts.medium, color: PIE_COLORS.medium },
      { name: 'Low Risk', value: counts.low, color: PIE_COLORS.low },
    ].filter((item) => item.value > 0);
  }, [geoData]);

  // 4. Chart Data: Safe Zone Utilization (Allocated vs Total Capacity)
  const safeZoneUtilizationData = useMemo(() => {
    if (!geoData || !geoData.features) return [];
    const safeZonesMap = {};

    // Initialize with safe zones from GeoJSON
    geoData.features.forEach((f) => {
      const p = f.properties || {};
      if (p.safe === true || p.location_type === 'relocation_site') {
        const name = p.area_name || 'Safe Zone';
        safeZonesMap[name] = {
          name,
          totalCapacity: Number(p.capacity) || 0,
          allocatedPeople: 0,
        };
      }
    });

    // Add allocated people from relocation plan
    if (relocationPlan) {
      relocationPlan.forEach((r) => {
        if (safeZonesMap[r.to]) {
          safeZonesMap[r.to].allocatedPeople += Number(r.people) || 0;
        }
      });
    }

    return Object.values(safeZonesMap).map((sz) => ({
      name: sz.name,
      'Allocated People': sz.allocatedPeople,
      'Remaining Capacity': Math.max(0, sz.totalCapacity - sz.allocatedPeople),
      'Total Capacity': sz.totalCapacity,
    }));
  }, [geoData, relocationPlan]);

  return (
    <div className="dashboard-panel-container">
      {/* 4 Core KPI Summary Cards at Top */}
      <div className="kpi-grid">
        {/* Metric 1 */}
        <div className="kpi-card kpi-critical">
          <div className="kpi-icon-wrap">🚨</div>
          <div className="kpi-details">
            <span className="kpi-label">High-Risk Population</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-red">
                {metrics.highRiskPopulation.toLocaleString()}
              </span>
              <span className="kpi-unit">citizens</span>
            </div>
            <span className="kpi-hint">Requires immediate dispatch</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="kpi-card kpi-warning">
          <div className="kpi-icon-wrap">⚡</div>
          <div className="kpi-details">
            <span className="kpi-label">Immediate Priority Zones</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-orange">
                {metrics.immediatePriorityCount}
              </span>
              <span className="kpi-unit">active zones</span>
            </div>
            <span className="kpi-hint">Triage level 1 evacuation</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="kpi-card kpi-success">
          <div className="kpi-icon-wrap">🛡️</div>
          <div className="kpi-details">
            <span className="kpi-label">Total Safe Capacity</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-green">
                {metrics.totalSafeCapacity.toLocaleString()}
              </span>
              <span className="kpi-unit">shelter beds</span>
            </div>
            <span className="kpi-hint">Across all designated safe zones</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="kpi-card kpi-info">
          <div className="kpi-icon-wrap">👥</div>
          <div className="kpi-details">
            <span className="kpi-label">People Relocated</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-blue">
                {metrics.totalRelocatedPeople.toLocaleString()}
              </span>
              <span className="kpi-unit">assigned</span>
            </div>
            <span className="kpi-hint">100% capacity accommodated</span>
          </div>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="charts-grid">
        {/* Chart 1: Relocation Population by Hazard Zone */}
        <div className="chart-card">
          <div className="chart-header">
            <h4>📊 People Relocated by Origin Hazard Zone</h4>
            <span className="chart-badge">Algorithmic Dispatch</span>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={routeChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisTextColor} fontSize={12} />
                <YAxis stroke={axisTextColor} fontSize={12} />
                <Tooltip content={<CustomBarTooltip theme={theme} />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="people" name="Evacuees Assigned" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Risk Population Severity Breakdown */}
        <div className="chart-card">
          <div className="chart-header">
            <h4>🎯 Population by Risk Severity</h4>
            <span className="chart-badge">Hazard Exposure</span>
          </div>
          <div className="chart-body flex-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomBarTooltip theme={theme} />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Safe Zone Capacity Utilization */}
        <div className="chart-card chart-card-wide">
          <div className="chart-header">
            <h4>🏨 Safe Shelter Capacity Utilization</h4>
            <span className="chart-badge">Capacity vs Load</span>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={safeZoneUtilizationData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisTextColor} fontSize={12} />
                <YAxis stroke={axisTextColor} fontSize={12} />
                <Tooltip content={<CustomBarTooltip theme={theme} />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Allocated People" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar
                  dataKey="Remaining Capacity"
                  stackId="a"
                  fill={isLight ? '#cbd5e1' : '#334155'}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Relocation Plan Table */}
      <RelocationTable relocationPlan={relocationPlan} theme={theme} />
    </div>
  );
}
