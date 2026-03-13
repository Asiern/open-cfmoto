import { useState, useEffect } from 'react';
import { locationService, LocationSample } from '../services/location.service';

export function useLocationTracking(active: boolean) {
  const [lastLocation, setLastLocation] = useState<LocationSample | null>(null);

  useEffect(() => {
    if (!active) return;
    locationService.startTracking(setLastLocation).catch(console.error);
    return () => locationService.stopTracking();
  }, [active]);

  return { lastLocation };
}
