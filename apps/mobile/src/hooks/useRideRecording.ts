import { useEffect, useRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useRideStore } from '../stores/ride.store';
import { useBikeStore } from '../stores/bike.store';
import { locationService } from '../services/location.service';
import { createTrip, finalizeTrip, insertTelemetrySample } from '../db/trips.repo';

export function useRideRecording() {
  const db = useSQLiteContext();
  const { isRecording, startedAt, currentTripId, setCurrentTripId, updateStats, stopRecording } = useRideStore();
  const bikeData = useBikeStore((s) => s.bikeData);
  const tripIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording) {
      locationService.stopTracking();
      return;
    }

    let cancelled = false;

    async function startTrip() {
      const tripId = await createTrip(db, Date.now());
      tripIdRef.current = tripId;
      setCurrentTripId(tripId);

      await locationService.startTracking(async (loc) => {
        if (cancelled || !tripIdRef.current || !bikeData) return;
        await insertTelemetrySample(db, {
          trip_id: tripIdRef.current,
          ts: loc.ts,
          lat: loc.lat,
          lon: loc.lon,
          rpm: bikeData.rpm,
          speed_kmh: bikeData.speedKmh,
          gear: bikeData.gear,
          coolant_c: bikeData.coolantTempC,
          battery_v: bikeData.batteryVoltage,
          throttle: bikeData.throttlePercent,
        });
      });
    }

    startTrip().catch(console.error);
    return () => { cancelled = true; };
  }, [isRecording]);

  return { isRecording, stopRecording };
}
