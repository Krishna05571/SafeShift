/**
 * SafeShift Geographic and Route Calculation Utilities
 * High-performance client-side centroid extraction, Bezier highway path generation,
 * and resilient local relocation and multi-route planning.
 */

// Risk Score Weights for Emergency Triage
const RISK_SCORES = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Extracts [lat, lon] centroid from a GeoJSON feature, raw properties object, or coordinate pair
 */
export function extractCentroid(item) {
  if (!item) return null;

  // If already [lat, lon] array
  if (Array.isArray(item) && item.length >= 2 && !isNaN(item[0]) && !isNaN(item[1])) {
    return [Number(item[0]), Number(item[1])];
  }

  const p = item.properties || item;
  if (p.centroid_lat !== undefined && p.centroid_lon !== undefined && !isNaN(p.centroid_lat) && !isNaN(p.centroid_lon)) {
    return [Number(p.centroid_lat), Number(p.centroid_lon)];
  }
  if (p.lat !== undefined && p.lon !== undefined && !isNaN(p.lat) && !isNaN(p.lon)) {
    return [Number(p.lat), Number(p.lon)];
  }

  const geom = item.geometry;
  if (!geom) return null;

  if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
    return [Number(geom.coordinates[1]), Number(geom.coordinates[0])];
  }

  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates[0]?.length) {
    const ring = geom.coordinates[0];
    let sumLat = 0;
    let sumLon = 0;
    ring.forEach(([lon, lat]) => {
      sumLon += Number(lon);
      sumLat += Number(lat);
    });
    return [sumLat / ring.length, sumLon / ring.length];
  }

  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates) && geom.coordinates[0]?.[0]?.length) {
    const ring = geom.coordinates[0][0];
    let sumLat = 0;
    let sumLon = 0;
    ring.forEach(([lon, lat]) => {
      sumLon += Number(lon);
      sumLat += Number(lat);
    });
    return [sumLat / ring.length, sumLon / ring.length];
  }

  return null;
}

/**
 * Enriches GeoJSON feature collection so every feature has centroid_lat and centroid_lon in properties
 */
export function enrichGeoJsonWithCentroids(geoJson) {
  if (!geoJson || !Array.isArray(geoJson.features)) return geoJson;

  const enrichedFeatures = geoJson.features.map((f) => {
    const centroid = extractCentroid(f);
    if (!centroid) return f;

    const [lat, lon] = centroid;
    return {
      ...f,
      properties: {
        ...f.properties,
        centroid_lat: lat,
        centroid_lon: lon,
      },
    };
  });

  return {
    ...geoJson,
    features: enrichedFeatures,
  };
}

/**
 * Haversine great-circle distance between two points in kilometers
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Generates curved quadratic Bezier polyline coordinates between origin and destination
 * with gentle curvature to represent highway / transit corridors realistically
 */
export function generateCurvedHighwayGeometry(originCoords, destCoords, numPoints = 25) {
  if (!originCoords || !destCoords) return [];
  const [lat1, lon1] = originCoords;
  const [lat2, lon2] = destCoords;

  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // Gentle normal perpendicular offset for natural curvature
  const offset = 0.08;
  const controlLat = midLat - dLon * offset;
  const controlLon = midLon + dLat * offset;

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const invT = 1 - t;
    const lat = invT * invT * lat1 + 2 * invT * t * controlLat + t * t * lat2;
    const lon = invT * invT * lon1 + 2 * invT * t * controlLon + t * t * lon2;
    points.push([Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
  }
  return points;
}

/**
 * Generates an instant local baseline relocation plan from GeoJSON dataset
 */
export function generateClientRelocationPlan(geoData, riskMode = 'baseline') {
  if (!geoData || !Array.isArray(geoData.features)) return [];

  const hazardZones = [];
  const safeZones = [];

  geoData.features.forEach((f, idx) => {
    const props = f.properties || {};
    const centroid = extractCentroid(f);
    if (!centroid) return;

    const isSafe = props.safe === true || props.location_type === 'relocation_site';
    if (isSafe) {
      const cap = Number(props.capacity || 10000);
      safeZones.push({
        id: idx,
        area_name: props.area_name || `Safe Zone ${safeZones.length + 1}`,
        capacity: cap,
        remaining_capacity: cap,
        centroid_lat: centroid[0],
        centroid_lon: centroid[1],
      });
    } else {
      const rawRisk = (riskMode === 'live' ? (props.risk || props.baseline_risk) : (props.baseline_risk || props.risk)) || 'low';
      const risk = String(rawRisk).toLowerCase();
      const population = Number(props.population || 0);
      const riskScore = RISK_SCORES[risk] || 1;
      const priorityScore = riskScore * population;

      hazardZones.push({
        id: idx,
        area_name: props.area_name || `Hazard Zone ${hazardZones.length + 1}`,
        hazard_type: props.hazard_type || 'general',
        risk,
        risk_score: riskScore,
        population,
        priority_score: priorityScore,
        priority: props.priority || 'short-term',
        centroid_lat: centroid[0],
        centroid_lon: centroid[1],
      });
    }
  });

  // Triage: sort highest priority hazard zones first
  hazardZones.sort((a, b) => b.priority_score - a.priority_score);

  const plan = [];

  hazardZones.forEach((hz) => {
    let peopleToRelocate = hz.population;
    if (peopleToRelocate <= 0) return;

    // Rank safe zones by distance from this hazard zone
    const rankedSafeZones = safeZones
      .map((sz) => ({
        distance: haversineDistanceKm(hz.centroid_lat, hz.centroid_lon, sz.centroid_lat, sz.centroid_lon),
        safeZone: sz,
      }))
      .sort((a, b) => a.distance - b.distance);

    for (const { distance, safeZone } of rankedSafeZones) {
      if (peopleToRelocate <= 0) break;
      if (safeZone.remaining_capacity <= 0) continue;

      const allocated = Math.min(peopleToRelocate, safeZone.remaining_capacity);
      safeZone.remaining_capacity -= allocated;
      peopleToRelocate -= allocated;

      const roadDistanceKm = Math.round(distance * 1.3);
      const travelTimeMin = Math.round((roadDistanceKm / 45) * 60);

      plan.push({
        from: hz.area_name,
        to: safeZone.area_name,
        people: allocated,
        hazard_type: hz.hazard_type,
        risk: hz.risk,
        priority_score: hz.priority_score,
        priority: hz.priority,
        distance_km: roadDistanceKm,
        travel_time_min: travelTimeMin,
        origin_coords: [hz.centroid_lat, hz.centroid_lon],
        dest_coords: [safeZone.centroid_lat, safeZone.centroid_lon],
        route_status: 'Optimal Allocation',
      });
    }

    if (peopleToRelocate > 0) {
      plan.push({
        from: hz.area_name,
        to: 'UNASSIGNED (OVERFLOW)',
        people: peopleToRelocate,
        hazard_type: hz.hazard_type,
        risk: hz.risk,
        priority_score: hz.priority_score,
        priority: hz.priority,
        distance_km: null,
        travel_time_min: null,
        origin_coords: [hz.centroid_lat, hz.centroid_lon],
        dest_coords: null,
        route_status: 'Capacity Exceeded',
      });
    }
  });

  return plan;
}

/**
 * Builds multi-route alternatives client-side for zero-latency instant display
 */
export function buildClientMultiRoutes(originName, originCoords, destName, destCoords, geoData, safeZoneStatus) {
  const safeZonesList = [];

  if (geoData?.features) {
    geoData.features.forEach((f) => {
      const p = f.properties || {};
      const isSafe = p.safe === true || p.location_type === 'relocation_site';
      if (isSafe) {
        const c = extractCentroid(f);
        if (c) {
          const cap = Number(p.capacity || 10000);
          const liveStatus = safeZoneStatus?.safe_zones?.find((sz) => sz.name === p.area_name);
          const fillPct = liveStatus?.fill_percentage ?? (p.fill_percentage ?? 45);
          const remCap = liveStatus?.remaining_capacity ?? (p.remaining_capacity ?? Math.round(cap * (1 - fillPct / 100)));

          safeZonesList.push({
            name: p.area_name,
            centroid_lat: c[0],
            centroid_lon: c[1],
            total_capacity: cap,
            remaining_capacity: remCap,
            fill_percentage: fillPct,
          });
        }
      }
    });
  }

  // Find target safe zone or fallback
  let primaryHaven = safeZonesList.find((sz) => sz.name === destName);
  if (!primaryHaven && destCoords) {
    primaryHaven = {
      name: destName || 'Designated Safe Haven',
      centroid_lat: destCoords[0],
      centroid_lon: destCoords[1],
      total_capacity: 10000,
      remaining_capacity: 5500,
      fill_percentage: 45,
    };
  }

  const oCoords = originCoords || [28.61, 77.20];
  const pCoords = primaryHaven ? [primaryHaven.centroid_lat, primaryHaven.centroid_lon] : [28.70, 77.10];

  const primaryDist = haversineDistanceKm(oCoords[0], oCoords[1], pCoords[0], pCoords[1]);
  const primaryRoadDist = Math.round(primaryDist * 1.3);
  const primaryTime = Math.round((primaryRoadDist / 50) * 60);

  const primaryRoute = {
    id: 'primary',
    type: 'primary',
    name: primaryHaven?.name || destName || 'Primary Haven',
    distance_km: primaryRoadDist,
    travel_time_min: primaryTime,
    dest_coords: pCoords,
    coordinates: generateCurvedHighwayGeometry(oCoords, pCoords, 28),
    total_capacity: primaryHaven?.total_capacity || 10000,
    remaining_capacity: primaryHaven?.remaining_capacity || 5500,
    fill_percentage: primaryHaven?.fill_percentage || 45,
    color: '#2563eb',
    source: 'SafeShift Transit Engine',
  };

  // Find alternative safe havens
  const altCandidates = safeZonesList
    .filter((sz) => sz.name !== primaryRoute.name)
    .map((sz) => {
      const d = haversineDistanceKm(oCoords[0], oCoords[1], sz.centroid_lat, sz.centroid_lon);
      const roadD = Math.round(d * 1.3);
      const time = Math.round((roadD / 50) * 60);
      return {
        ...sz,
        distance_km: roadD,
        travel_time_min: time,
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km);

  const alternates = altCandidates.slice(0, 2).map((alt, idx) => {
    const aCoords = [alt.centroid_lat, alt.centroid_lon];
    return {
      id: `alt_${idx + 1}`,
      type: 'alternate',
      name: alt.name,
      distance_km: alt.distance_km,
      travel_time_min: alt.travel_time_min,
      dest_coords: aCoords,
      coordinates: generateCurvedHighwayGeometry(oCoords, aCoords, 28),
      total_capacity: alt.total_capacity,
      remaining_capacity: alt.remaining_capacity,
      fill_percentage: alt.fill_percentage,
      color: idx === 0 ? '#10b981' : '#f59e0b',
      source: 'SafeShift Transit Engine',
    };
  });

  return {
    origin: {
      name: originName || 'Hazard Origin',
      coords: oCoords,
    },
    primary: primaryRoute,
    alternates,
  };
}

/**
 * Generates an initial Safe Zone capacity status object from GeoJSON
 */
export function getInitialSafeZoneStatus(geoData) {
  if (!geoData?.features) return { safe_zones: [], capacity_alerts: [] };
  const safe_zones = [];
  geoData.features.forEach((f) => {
    const p = f.properties || {};
    if (p.safe === true || p.location_type === 'relocation_site') {
      const cap = Number(p.capacity || 10000);
      const c = extractCentroid(f) || [28.7, 77.1];
      const fill = p.fill_percentage ?? 45;
      safe_zones.push({
        name: p.area_name,
        total_capacity: cap,
        remaining_capacity: Math.round(cap * (1 - fill / 100)),
        current_occupancy: Math.round(cap * (fill / 100)),
        fill_percentage: fill,
        centroid_lat: c[0],
        centroid_lon: c[1],
        location_type: p.location_type || 'relocation_site',
      });
    }
  });
  return { safe_zones, capacity_alerts: [] };
}

/**
 * Fetch wrapper with strict timeout so sleeping backend cold starts never stall the browser
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

