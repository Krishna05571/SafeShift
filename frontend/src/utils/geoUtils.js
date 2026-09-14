import initialHighwayRoutes from '../data/initial_highway_routes.json';

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

export { initialHighwayRoutes };

/**
 * Retrieves precomputed real-world national highway coordinates from disk or generates realistic curve
 */
export function getHighwayRouteGeometry(originCoords, destCoords) {
  if (!originCoords || !destCoords) return null;
  const [oLat, oLon] = originCoords;
  const [dLat, dLon] = destCoords;
  const key = `${Number(oLat).toFixed(4)}_${Number(oLon).toFixed(4)}_${Number(dLat).toFixed(4)}_${Number(dLon).toFixed(4)}`;

  if (initialHighwayRoutes && initialHighwayRoutes[key]) {
    return initialHighwayRoutes[key];
  }

  // Also check reverse key
  const reverseKey = `${Number(dLat).toFixed(4)}_${Number(dLon).toFixed(4)}_${Number(oLat).toFixed(4)}_${Number(oLon).toFixed(4)}`;
  if (initialHighwayRoutes && initialHighwayRoutes[reverseKey]) {
    const rev = initialHighwayRoutes[reverseKey];
    return {
      ...rev,
      coordinates: [...rev.coordinates].reverse(),
    };
  }

  // Fallback to curved geometry
  const directCurve = generateCurvedHighwayGeometry(originCoords, destCoords, 30);
  const crowDist = haversineDistanceKm(oLat, oLon, dLat, dLon);
  const estDistance = Math.round(crowDist * 1.3);
  const estDuration = Math.round((estDistance / 50) * 60);
  return {
    coordinates: directCurve,
    distance_km: estDistance,
    travel_time_min: estDuration,
    source: 'Direct Transit Corridor',
  };
}

/**
 * Fetches real-time highway turn-by-turn geometry directly from OSRM OpenStreetMap engine
 */
export async function fetchLiveOsrmHighway(originCoords, destCoords) {
  const [oLat, oLon] = originCoords;
  const [dLat, dLon] = destCoords;
  const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson`;
  const res = await fetchWithTimeout(url, {}, 3500);
  if (!res.ok) throw new Error(`OSRM status ${res.status}`);
  const data = await res.json();
  if (data.code === 'Ok' && data.routes && data.routes[0]) {
    const r = data.routes[0];
    const raw = r.geometry.coordinates;
    const latLon = raw.map(([lon, lat]) => [Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
    return {
      coordinates: latLon,
      distance_km: Math.round((r.distance / 1000) * 10) / 10,
      travel_time_min: Math.round(r.duration / 60),
      source: 'OpenStreetMap National Highway Engine',
      waypoints_count: latLon.length,
    };
  }
  throw new Error('OSRM did not return valid routes');
}

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
 * Evaluates the effective risk level ('high' | 'medium' | 'low') for a zone based on the active risk mode.
 * In 'baseline' mode: returns structural vulnerability (props.baseline_risk || props.risk).
 * In 'live' mode: dynamically calculates risk based on live/fallback rainfall & hazard type under IMD/GSI guidelines.
 */
export function getEffectiveZoneRisk(props = {}, riskMode = 'baseline') {
  if (!props) return 'low';
  if (props.safe === true || props.location_type === 'relocation_site') {
    return 'safe';
  }

  // Baseline Mode: Intrinsic structural geological / floodplain vulnerability
  if (riskMode === 'baseline') {
    return (props.baseline_risk || props.risk || 'medium').toLowerCase();
  }

  // Live Weather Mode:
  let rMm = null;
  if (props.rainfall !== undefined && props.rainfall !== null) {
    rMm = Number(props.rainfall);
  } else {
    const fallback = getZoneFallbackWeather(props);
    if (fallback && fallback.rainfall !== undefined) {
      rMm = Number(fallback.rainfall);
    }
  }

  if (rMm !== null && !isNaN(rMm)) {
    const hazardType = (props.hazard_type || 'landslide').toLowerCase();

    if (hazardType.includes('landslide')) {
      // GSI Hill Slope Saturation Guidelines:
      // R >= 64.5mm -> HIGH (Immediate)
      // 35.5mm <= R < 64.5mm -> MEDIUM (Short-Term)
      // R < 35.5mm -> LOW (Monitoring)
      if (rMm >= 64.5) return 'high';
      if (rMm >= 35.5) return 'medium';
      return 'low';
    } else {
      // IMD Flood Inundation Guidelines:
      // R >= 115.6mm -> HIGH (Immediate)
      // 64.5mm <= R < 115.6mm -> MEDIUM (Short-Term)
      // R < 64.5mm -> LOW (Monitoring)
      if (rMm >= 115.6) return 'high';
      if (rMm >= 64.5) return 'medium';
      return 'low';
    }
  }

  return (props.risk || props.baseline_risk || 'medium').toLowerCase();
}

/**
 * Evaluates effective triage priority ('immediate' | 'short-term' | 'monitoring')
 */
export function getEffectiveZonePriority(props = {}, riskMode = 'baseline') {
  if (!props) return 'monitoring';
  if (props.safe === true || props.location_type === 'relocation_site') {
    return 'optimal';
  }

  const effectiveRisk = getEffectiveZoneRisk(props, riskMode);
  if (effectiveRisk === 'high') return 'immediate';
  if (effectiveRisk === 'medium') return 'short-term';
  return 'monitoring';
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
      const risk = getEffectiveZoneRisk(props, riskMode);
      const population = Number(props.population || 0);
      const riskScore = RISK_SCORES[risk] || 1;
      const priorityScore = riskScore * population;
      const priority = getEffectiveZonePriority(props, riskMode);

      hazardZones.push({
        id: idx,
        area_name: props.area_name || `Hazard Zone ${hazardZones.length + 1}`,
        hazard_type: props.hazard_type || 'general',
        risk,
        risk_score: riskScore,
        population,
        priority_score: priorityScore,
        priority: priority || props.priority || 'short-term',
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
          const fillPct = liveStatus?.fill_percentage ?? (p.fill_percentage ?? (DEFAULT_SHELTER_OCCUPANCIES[p.area_name] || 50));
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
    const defaultFill = DEFAULT_SHELTER_OCCUPANCIES[destName] || 50;
    primaryHaven = {
      name: destName || 'Designated Safe Haven',
      centroid_lat: destCoords[0],
      centroid_lon: destCoords[1],
      total_capacity: 10000,
      remaining_capacity: Math.round(10000 * (1 - defaultFill / 100)),
      fill_percentage: defaultFill,
    };
  }

  const oCoords = originCoords || [28.61, 77.20];
  const pCoords = primaryHaven ? [primaryHaven.centroid_lat, primaryHaven.centroid_lon] : [28.70, 77.10];

  const primaryDist = haversineDistanceKm(oCoords[0], oCoords[1], pCoords[0], pCoords[1]);
  const primaryRoadDist = Math.round(primaryDist * 1.3);
  const primaryTime = Math.round((primaryRoadDist / 50) * 60);

  const primaryHw = getHighwayRouteGeometry(oCoords, pCoords);
  const primaryRoute = {
    id: 'primary',
    type: 'primary',
    name: primaryHaven?.name || destName || 'Primary Haven',
    distance_km: primaryHw?.distance_km || primaryRoadDist,
    travel_time_min: primaryHw?.travel_time_min || primaryTime,
    dest_coords: pCoords,
    coordinates: primaryHw?.coordinates || generateCurvedHighwayGeometry(oCoords, pCoords, 28),
    total_capacity: primaryHaven?.total_capacity || 10000,
    remaining_capacity: primaryHaven?.remaining_capacity || 5500,
    fill_percentage: primaryHaven?.fill_percentage || 45,
    color: '#2563eb',
    source: primaryHw?.source || 'OpenStreetMap National Highway Engine',
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
    const altHw = getHighwayRouteGeometry(oCoords, aCoords);
    return {
      id: `alt_${idx + 1}`,
      type: 'alternate',
      name: alt.name,
      distance_km: altHw?.distance_km || alt.distance_km,
      travel_time_min: altHw?.travel_time_min || alt.travel_time_min,
      dest_coords: aCoords,
      coordinates: altHw?.coordinates || generateCurvedHighwayGeometry(oCoords, aCoords, 28),
      total_capacity: alt.total_capacity,
      remaining_capacity: alt.remaining_capacity,
      fill_percentage: alt.fill_percentage,
      color: idx === 0 ? '#10b981' : '#f59e0b',
      source: altHw?.source || 'OpenStreetMap National Highway Engine',
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

export const DEFAULT_SHELTER_OCCUPANCIES = {
  'Safe Zone South-1 (Kozhikode Regional Elevated Sports Complex)': 92.4, // CRITICAL (Red, >=90%)
  'Safe Zone East-3 (Patna AIIMS & Bihta Highland Center)': 94.8,         // CRITICAL (Red, >=90%)
  'Safe Zone North-1 (Dehradun FRI & Cantt Grounds)': 78.5,             // WARNING (Yellow, 70-89%)
  'Safe Zone West-2 (Pune Pimpri Elevated Shelter Grounds)': 82.6,       // WARNING (Yellow, 70-89%)
  'Safe Zone East-1 (Guwahati Khanapara Elevated Stadium)': 86.0,        // WARNING (Yellow, 70-89%)
  'Safe Zone South-2 (Kochi Infopark Elevated Convention Grounds)': 74.2, // WARNING (Yellow, 70-89%)
  'Safe Zone North-3 (Srinagar Elevated Airport Plateau)': 79.0,         // WARNING (Yellow, 70-89%)
  'Safe Zone East-5 (Kolkata Salt Lake Stadium High-Ground)': 54.5,       // NORMAL (Green, <70%)
  'Safe Zone Central-1 (Nagpur Divisional Sports Complex)': 58.0,        // NORMAL (Green, <70%)
  'Safe Zone North-4 (Greater Noida High-Ground Center)': 48.2,         // NORMAL (Green, <70%)
  'Safe Zone North-2 (Chandigarh Sports Complex)': 42.5,                 // NORMAL (Green, <70%)
  'Safe Zone Central-2 (Bhopal BHEL Highland Grounds)': 51.0,           // NORMAL (Green, <70%)
  'Safe Zone East-2 (Bhubaneswar Kalinga Stadium)': 62.4,                // NORMAL (Green, <70%)
  'Safe Zone East-4 (Siliguri North Bengal University Grounds)': 46.8,   // NORMAL (Green, <70%)
  'Safe Zone West-1 (Ahmedabad Sardar Patel Sports Enclave)': 39.5,      // NORMAL (Green, <70%)
  'Safe Zone West-3 (Jaipur SMS Stadium High-Ground)': 53.0,             // NORMAL (Green, <70%)
  'Safe Zone West-4 (Surat Althan Elevated Community Complex)': 61.2,    // NORMAL (Green, <70%)
  'Safe Zone South-3 (Hyderabad Gachibowli Stadium Complex)': 44.0,      // NORMAL (Green, <70%)
  'Safe Zone South-4 (Bengaluru Kanteerava Highland Complex)': 56.5,     // NORMAL (Green, <70%)
  'Safe Zone South-5 (Chennai Elevated Jawaharlal Nehru Stadium Grounds)': 64.0, // NORMAL (Green, <70%)
};

/**
 * Generates an initial Safe Zone capacity status object from GeoJSON with realistic demo spread (green, yellow, critical)
 */
export function getInitialSafeZoneStatus(geoData) {
  if (!geoData?.features) return { safe_zones: [], capacity_alerts: [] };
  const safe_zones = [];
  const capacity_alerts = [];

  geoData.features.forEach((f, idx) => {
    const p = f.properties || {};
    if (p.safe === true || p.location_type === 'relocation_site') {
      const cap = Number(p.capacity || 10000);
      const c = extractCentroid(f) || [28.7, 77.1];
      const fill = p.fill_percentage ?? (DEFAULT_SHELTER_OCCUPANCIES[p.area_name] ?? (50 + ((idx % 4) * 11)));
      const occ = Math.round((cap * fill) / 100);
      const rem = Math.max(0, cap - occ);
      const inflow = 120 + ((idx * 45) % 150);
      const mins = inflow > 0 && rem > 0 ? Math.round((rem / inflow) * 10) / 10 : 0;

      const alertLevel = fill >= 100 ? 'FULL' : fill >= 90 ? 'CRITICAL' : fill >= 70 ? 'WARNING' : 'NORMAL';
      const alertMsg =
        fill >= 100
          ? `Safe Zone FULL (${fill}%) – redirecting evacuees`
          : fill >= 90
          ? `Safe Zone Critical (${fill}%) – only ${rem.toLocaleString()} beds remaining`
          : fill >= 70
          ? `Safe Zone Warning (${fill}%) – load nearing capacity`
          : `Safe Zone optimal (${fill}%)`;
      const statusColor = fill >= 100 ? '#ef4444' : fill >= 90 ? '#ff6b6b' : fill >= 70 ? '#f59e0b' : '#10b981';

      if (fill >= 90) {
        capacity_alerts.push({
          id: `cap-alert-${p.area_name}-${idx}`,
          zone_name: p.area_name,
          shelter_name: p.area_name,
          name: p.area_name,
          area_name: p.area_name,
          fill_percentage: fill,
          alert_level: alertLevel,
          message: alertMsg,
          remaining_capacity: rem,
          total_capacity: cap,
          current_occupancy: occ,
          centroid_lat: c[0],
          centroid_lon: c[1],
          estimated_minutes_to_full: mins,
          status_color: statusColor,
        });
      }

      safe_zones.push({
        id: `sz-${idx}`,
        name: p.area_name,
        total_capacity: cap,
        remaining_capacity: rem,
        current_occupancy: occ,
        fill_percentage: fill,
        centroid_lat: c[0],
        centroid_lon: c[1],
        location_type: p.location_type || 'relocation_site',
        inflow_rate_per_min: inflow,
        estimated_minutes_to_full: mins,
        alert_level: alertLevel,
        alert_message: alertMsg,
        status_color: statusColor,
      });
    }
  });

  return { safe_zones, capacity_alerts };
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

export const DEFAULT_ZONE_WEATHER = {
  'Chamoli - Joshimath Zone (UK)': { rainfall: 124.5, humidity: 88, temperature: 18.2, weather: 'Heavy rain / Cloudburst alert' },
  'Kedarnath - Rudraprayag Valley (UK)': { rainfall: 118.0, humidity: 86, temperature: 16.5, weather: 'Continuous heavy rain' },
  'Nainital Kumaon Hills (UK)': { rainfall: 54.0, humidity: 79, temperature: 21.0, weather: 'Moderate rain' },
  'Shimla - Rampur Corridor (HP)': { rainfall: 92.5, humidity: 84, temperature: 17.8, weather: 'Heavy monsoon showers' },
  'Kullu - Manali Beas Basin (HP)': { rainfall: 104.0, humidity: 87, temperature: 15.6, weather: 'Heavy rain / Torrential' },
  'Mandi - Pandoh Catchment (HP)': { rainfall: 68.2, humidity: 81, temperature: 22.4, weather: 'Moderate rain showers' },
  'Dharamsala - Kangra Slopes (HP)': { rainfall: 128.0, humidity: 91, temperature: 19.5, weather: 'Cloudburst warning' },
  'Wayanad - Meppadi Ghats (Kerala)': { rainfall: 135.0, humidity: 94, temperature: 23.1, weather: 'Extreme torrential monsoon' },
  'Idukki - Munnar High Ranges (Kerala)': { rainfall: 112.5, humidity: 92, temperature: 19.8, weather: 'Very heavy rain' },
  'Mahad - Savitri River Basin (Maharashtra)': { rainfall: 126.4, humidity: 89, temperature: 25.4, weather: 'Heavy rain / River cresting' },
  'Chiplun - Vashishti Basin (Maharashtra)': { rainfall: 119.0, humidity: 88, temperature: 26.0, weather: 'Heavy monsoon downpour' },
  'Raigad - Western Slopes (Maharashtra)': { rainfall: 98.5, humidity: 85, temperature: 26.8, weather: 'Heavy rain' },
  'Pune Western Ghats Slopes (Maharashtra)': { rainfall: 62.0, humidity: 76, temperature: 24.5, weather: 'Moderate rain' },
  'Nilgiris - Ooty Slopes (Tamil Nadu)': { rainfall: 72.5, humidity: 83, temperature: 16.2, weather: 'Active rain showers' },
  'Darjeeling - Kurseong Hills (WB)': { rainfall: 114.0, humidity: 90, temperature: 17.0, weather: 'Heavy rain / Mountain fog' },
  'Kalimpong - Teesta Gorge (WB)': { rainfall: 96.5, humidity: 88, temperature: 19.2, weather: 'Heavy rain' },
  'Cherrapunji - Khasi Hills (Meghalaya)': { rainfall: 148.0, humidity: 96, temperature: 20.5, weather: 'Extreme continuous downpour' },
  'Assam Brahmaputra Basin - Majuli': { rainfall: 132.0, humidity: 93, temperature: 27.5, weather: 'Severe riverine inundation' },
  'Kosi Inundation Belt - Supaul (Bihar)': { rainfall: 122.7, humidity: 94, temperature: 29.1, weather: 'Heavy monsoon downpour' },
  'Patna Ganga Basin (Bihar)': { rainfall: 82.5, humidity: 78, temperature: 29.0, weather: 'Moderate rain' },
  'Varanasi Ganga Lowlands (UP)': { rainfall: 42.0, humidity: 72, temperature: 31.0, weather: 'Scattered showers' },
  'Delhi Yamuna Floodplains (Delhi-NCR)': { rainfall: 38.5, humidity: 68, temperature: 32.5, weather: 'Partly cloudy / Light drizzle' },
  'Cuttack - Mahanadi Delta (Odisha)': { rainfall: 88.0, humidity: 84, temperature: 28.5, weather: 'Moderate rain showers' },
  'Leh Indus Valley Belt (Ladakh)': { rainfall: 48.0, humidity: 55, temperature: 14.0, weather: 'Overcast / High altitude drizzle' },
};

/**
 * Returns fallback meteorological parameters for any zone
 */
export function getZoneFallbackWeather(zone) {
  if (!zone) return null;
  const name = zone.area_name || zone.name || '';
  if (DEFAULT_ZONE_WEATHER[name]) {
    return DEFAULT_ZONE_WEATHER[name];
  }

  // Fuzzy match
  const found = Object.keys(DEFAULT_ZONE_WEATHER).find((k) =>
    k.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase())
  );
  if (found) {
    return DEFAULT_ZONE_WEATHER[found];
  }

  // Default synthetic based on risk
  const risk = (zone.risk || zone.baseline_risk || 'medium').toLowerCase();
  const isHigh = risk === 'high';
  const isMed = risk === 'medium';
  return {
    rainfall: isHigh ? 116.5 : isMed ? 68.0 : 32.0,
    humidity: isHigh ? 88 : isMed ? 78 : 65,
    temperature: 26.5,
    weather: isHigh ? 'Heavy rain' : isMed ? 'Moderate rain' : 'Partly cloudy',
  };
}

export function getWmoWeatherDescription(code) {
  const map = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm',
  };
  return map[code] || 'Cloudy with precipitation';
}

/**
 * Direct client-side Open-Meteo live weather fetcher
 */
export async function fetchLiveOpenMeteoWeather(lat, lon) {
  if (!lat || !lon) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code&daily=precipitation_sum&timezone=auto&forecast_days=1`;
  const res = await fetchWithTimeout(url, {}, 3000);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  const cur = data.current || {};
  const daily = data.daily || {};
  const rain24h = daily.precipitation_sum?.[0] !== undefined ? Number(daily.precipitation_sum[0]) : (Number(cur.precipitation || 0) * 12);
  const wCode = cur.weather_code ?? 61;
  const weatherDesc = getWmoWeatherDescription(wCode);
  return {
    rainfall: Math.round(rain24h * 10) / 10,
    rainfall_1h: Math.round(Number(cur.precipitation || 0) * 10) / 10,
    humidity: Math.round(Number(cur.relative_humidity_2m || 75)),
    temperature: Math.round(Number(cur.temperature_2m || 24) * 10) / 10,
    weather: weatherDesc,
    source: 'Open-Meteo Real-Time Telemetry',
  };
}

