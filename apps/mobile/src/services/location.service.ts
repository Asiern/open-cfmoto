import * as Location from 'expo-location';

export interface LocationSample {
  lat: number;
  lon: number;
  altitudeM: number | null;
  accuracyM: number | null;
  speedMs: number | null;
  ts: number;
}

type LocationCallback = (sample: LocationSample) => void;

class LocationService {
  private subscriber: Location.LocationSubscription | null = null;

  async startTracking(callback: LocationCallback): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    this.subscriber = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (location) => {
        callback({
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          altitudeM: location.coords.altitude,
          accuracyM: location.coords.accuracy,
          speedMs: location.coords.speed,
          ts: location.timestamp,
        });
      },
    );
  }

  stopTracking(): void {
    this.subscriber?.remove();
    this.subscriber = null;
  }
}

export const locationService = new LocationService();
