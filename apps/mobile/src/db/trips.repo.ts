import { SQLiteDatabase } from 'expo-sqlite';

export interface Trip {
  id: number;
  started_at: number;
  ended_at: number | null;
  distance_km: number | null;
  duration_s: number | null;
  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  route_geojson: string | null;
}

export async function getAllTrips(db: SQLiteDatabase): Promise<Trip[]> {
  return db.getAllAsync<Trip>('SELECT * FROM trips ORDER BY started_at DESC');
}

export async function createTrip(db: SQLiteDatabase, startedAt: number): Promise<number> {
  const result = await db.runAsync('INSERT INTO trips (started_at) VALUES (?)', startedAt);
  return result.lastInsertRowId;
}

export async function finalizeTrip(
  db: SQLiteDatabase,
  tripId: number,
  summary: {
    endedAt: number;
    distanceKm: number;
    durationS: number;
    maxSpeedKmh: number;
    avgSpeedKmh: number;
    routeGeoJSON: string;
  },
): Promise<void> {
  await db.runAsync(
    `UPDATE trips SET ended_at=?, distance_km=?, duration_s=?, max_speed_kmh=?, avg_speed_kmh=?, route_geojson=?
     WHERE id=?`,
    summary.endedAt,
    summary.distanceKm,
    summary.durationS,
    summary.maxSpeedKmh,
    summary.avgSpeedKmh,
    summary.routeGeoJSON,
    tripId,
  );
}

export interface TelemetrySample {
  trip_id: number;
  ts: number;
  lat: number | null;
  lon: number | null;
  rpm: number;
  speed_kmh: number;
  gear: number;
  coolant_c: number;
  battery_v: number;
  throttle: number;
}

export async function insertTelemetrySample(
  db: SQLiteDatabase,
  sample: TelemetrySample,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO trip_telemetry (trip_id, ts, lat, lon, rpm, speed_kmh, gear, coolant_c, battery_v, throttle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sample.trip_id,
    sample.ts,
    sample.lat,
    sample.lon,
    sample.rpm,
    sample.speed_kmh,
    sample.gear,
    sample.coolant_c,
    sample.battery_v,
    sample.throttle,
  );
}
