import { SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS trips (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at    INTEGER NOT NULL,
      ended_at      INTEGER,
      distance_km   REAL,
      duration_s    INTEGER,
      max_speed_kmh REAL,
      avg_speed_kmh REAL,
      route_geojson TEXT
    );

    CREATE TABLE IF NOT EXISTS trip_telemetry (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      ts         INTEGER NOT NULL,
      lat        REAL,
      lon        REAL,
      rpm        INTEGER,
      speed_kmh  REAL,
      gear       INTEGER,
      coolant_c  INTEGER,
      battery_v  REAL,
      throttle   INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_trip_telemetry_trip_id ON trip_telemetry(trip_id);
  `);
}
