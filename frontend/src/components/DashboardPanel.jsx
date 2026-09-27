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
import { getActiveZonePopulation, getEffectiveZoneRisk, getEffectiveZonePriority, groupRelocationPlanByOrigin } from '../utils/geoUtils';

const PIE_COLORS = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#eab308',
};
const RISK_SCORES = { high: 3, medium: 2, low: 1 };

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
            {entry.name === 'Utilization (%)'
              ? `${Number(entry.value).toFixed(1)}%`
              : typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
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
  stats = null,
  theme = 'dark',
  riskMode = 'baseline',
  safeZoneStatus = null,
  onTraceRoute = null,
  onLocateZone = null,
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
    let featurePopulationTotal = 0;

    // From geoData
    if (geoData && geoData.features) {
      geoData.features.forEach((f) => {
        const p = f.properties || {};
        const isSafe = p.safe === true || p.location_type === 'relocation_site';

        if (isSafe) {
          totalSafeCapacity += Number(p.capacity) || 0;
        } else {
          const risk = getEffectiveZoneRisk(p, riskMode).toLowerCase();
          const priority = getEffectiveZonePriority(p, riskMode).toLowerCase();
          const population = getActiveZonePopulation(p, 0);
          featurePopulationTotal += population;

          if (priority === 'immediate') {
            immediatePriorityCount += 1;
          }
        }
      });
    }

    if (relocationPlan.length > 0) {
      groupRelocationPlanByOrigin(relocationPlan).forEach((originPlan) => {
        const zone = geoData?.features?.find((feature) => feature.properties?.area_name === originPlan.from);
        const activeRisk = zone?.properties
          ? getEffectiveZoneRisk(zone.properties, riskMode).toLowerCase()
          : (originPlan.risk || 'medium').toLowerCase();
        if (activeRisk === 'high') {
          highRiskPopulation += Number(originPlan.people) || 0;
        }
      });
    } else {
      highRiskPopulation = (geoData?.features || []).reduce((sum, feature) => {
        const props = feature.properties || {};
        if (props.safe === true || props.location_type === 'relocation_site') return sum;
        return getEffectiveZoneRisk(props, riskMode).toLowerCase() === 'high'
          ? sum + getActiveZonePopulation(props, 0)
          : sum;
      }, 0);
    }

    const liveCapacity = Number(safeZoneStatus?.summary?.total_capacity);
    if (Number.isFinite(liveCapacity) && liveCapacity > 0) {
      totalSafeCapacity = liveCapacity;
    }

    // From relocationPlan
    if (relocationPlan && relocationPlan.length > 0) {
      totalRelocatedPeople = relocationPlan.reduce(
        (sum, item) => sum + (Number(item.people) || 0),
        0
      );
    }

    return {
      totalActivePopulation: Number(stats?.totalPopulation) || (totalRelocatedPeople || featurePopulationTotal),
      highRiskPopulation,
      immediatePriorityCount,
      totalSafeCapacity,
      totalRelocatedPeople,
    };
  }, [geoData, relocationPlan, riskMode, safeZoneStatus, stats?.totalPopulation]);

  // 2. Chart Data: Relocation Allocations by Origin & Destination
  const routeChartData = useMemo(() => {
    if (!relocationPlan || relocationPlan.length === 0) return [];
    return groupRelocationPlanByOrigin(relocationPlan).map((r) => {
      const zoneFeat = geoData?.features?.find((f) => f.properties?.area_name === r.from);
      const activeRisk = (
        zoneFeat?.properties
          ? getEffectiveZoneRisk(zoneFeat.properties, riskMode)
          : (r.risk || 'medium')
      ).toLowerCase();
      const activePopulation = Number(r.people) || 0;
      const distances = r.allocations
        .map((allocation) => Number(allocation.distance_km))
        .filter((distance) => Number.isFinite(distance) && distance > 0);

      return {
        name: r.from.replace(' Zone', ''),
        fullName: r.from,
        destination: r.allocations.map((allocation) => `${allocation.to} (${Number(allocation.people || 0).toLocaleString()})`).join(', '),
        people: r.people,
        distance: distances.length ? Math.min(...distances) : 0,
        priority: (RISK_SCORES[activeRisk] || 1) * (Number(activePopulation) || 0),
        risk: activeRisk.toUpperCase(),
      };
    });
  }, [relocationPlan, geoData, riskMode]);

  // 3. Chart Data: Population Distribution by Risk Level
  const riskDistributionData = useMemo(() => {
    if (relocationPlan.length > 0) {
      const counts = { high: 0, medium: 0, low: 0 };
      groupRelocationPlanByOrigin(relocationPlan).forEach((originPlan) => {
        const zone = geoData?.features?.find((feature) => feature.properties?.area_name === originPlan.from);
        const risk = zone?.properties
          ? getEffectiveZoneRisk(zone.properties, riskMode).toLowerCase()
          : (originPlan.risk || 'medium').toLowerCase();
        if (counts[risk] !== undefined) counts[risk] += Number(originPlan.people) || 0;
      });

      return [
        { name: 'High Risk', value: counts.high, color: PIE_COLORS.high },
        { name: 'Medium Risk', value: counts.medium, color: PIE_COLORS.medium },
        { name: 'Low Risk', value: counts.low, color: PIE_COLORS.low },
      ].filter((item) => item.value > 0);
    }

    if (!geoData || !geoData.features) return [];
    const counts = { high: 0, medium: 0, low: 0 };

    geoData.features.forEach((f) => {
      const p = f.properties || {};
      const isSafe = p.safe === true || p.location_type === 'relocation_site';
      if (!isSafe) {
        const risk = getEffectiveZoneRisk(p, riskMode).toLowerCase();
        if (counts[risk] !== undefined) {
          counts[risk] += getActiveZonePopulation(p, 0);
        }
      }
    });

    return [
      { name: 'High Risk', value: counts.high, color: PIE_COLORS.high },
      { name: 'Medium Risk', value: counts.medium, color: PIE_COLORS.medium },
      { name: 'Low Risk', value: counts.low, color: PIE_COLORS.low },
    ].filter((item) => item.value > 0);
  }, [geoData, relocationPlan, riskMode]);

  // 4. Chart Data: Safe Zone Utilization (Allocated vs Total Capacity)
  const safeZoneUtilizationData = useMemo(() => {
    if (!geoData || !geoData.features) return [];
    const safeZonesMap = {};
    const liveSafeZones = safeZoneStatus?.safe_zones;

    if (liveSafeZones?.length) {
      liveSafeZones.forEach((zone) => {
        safeZonesMap[zone.name] = {
          name: zone.name,
          totalCapacity: Number(zone.total_capacity) || 0,
          currentOccupancy: Number(zone.current_occupancy) || 0,
          utilization: Math.min(100, Math.max(0, Number(zone.fill_percentage) || 0)),
        };
      });
    } else {
      geoData.features.forEach((f) => {
        const p = f.properties || {};
        if (p.safe === true || p.location_type === 'relocation_site') {
          const name = p.area_name || 'Safe Zone';
          const capacity = Number(p.capacity) || 0;
          const utilization = Math.min(100, Math.max(0, Number(p.fill_percentage) || 0));
          safeZonesMap[name] = {
            name,
            totalCapacity: capacity,
            currentOccupancy: Math.round(capacity * utilization / 100),
            utilization,
          };
        }
      });
    }

    return Object.values(safeZonesMap).map((sz) => ({
      name: sz.name,
      occupancy: sz.currentOccupancy,
      capacity: sz.totalCapacity,
      utilization: sz.utilization,
      'Utilization (%)': sz.utilization,
    }));
  }, [geoData, safeZoneStatus]);

  return (
    <div className="dashboard-panel-container">
      {/* 4 Core KPI Summary Cards at Top */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-info">
          <div className="kpi-details">
            <span className="kpi-label">Population at Risk</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-blue">
                {metrics.totalActivePopulation.toLocaleString()}
              </span>
              <span className="kpi-unit">citizens</span>
            </div>
            <span className="kpi-hint">Same active total shown on the GIS map</span>
          </div>
        </div>

        {/* Metric 1 */}
        <div className="kpi-card kpi-critical">
          <div className="kpi-details">
            <span className="kpi-label">High-Risk Subset</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-red">
                {metrics.highRiskPopulation.toLocaleString()}
              </span>
              <span className="kpi-unit">citizens</span>
            </div>
            <span className="kpi-hint">Population in high-risk zones only</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="kpi-card kpi-warning">
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
          <div className="kpi-details">
            <span className="kpi-label">Evacuation Plan Total</span>
            <div className="kpi-val-group">
              <span className="kpi-value text-blue">
                {metrics.totalRelocatedPeople.toLocaleString()}
              </span>
              <span className="kpi-unit">allocated</span>
            </div>
              <span className="kpi-hint">Includes shelter splits and overflow entries</span>
          </div>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="charts-grid">

        {/* Chart 1: Relocation Population by Hazard Zone */}
        <div className="chart-card">
          <div className="chart-header">
            <h4>People Relocated by Origin Hazard Zone</h4>
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
            <h4>Population by Risk Severity</h4>
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
            <h4>Safe Shelter Capacity Utilization</h4>
          <span className="chart-badge">Current occupancy by shelter</span>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={safeZoneUtilizationData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisTextColor} fontSize={12} />
                <YAxis
                  stroke={axisTextColor}
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomBarTooltip theme={theme} />} />
                <Bar dataKey="Utilization (%)" radius={[5, 5, 0, 0]}>
                  {safeZoneUtilizationData.map((zone) => (
                    <Cell
                      key={zone.name}
                      fill={zone.utilization >= 90 ? '#ef4444' : zone.utilization >= 70 ? '#f59e0b' : '#10b981'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Relocation Plan Table */}
      <RelocationTable
        relocationPlan={relocationPlan}
        geoData={geoData}
        riskMode={riskMode}
        theme={theme}
        onTraceRoute={onTraceRoute}
        onLocateZone={onLocateZone}
      />
    </div>
  );
}
