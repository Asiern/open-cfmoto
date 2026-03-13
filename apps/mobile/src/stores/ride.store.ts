import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface RideStats {
  distanceKm: number;
  durationS: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
}

interface RideState {
  isRecording: boolean;
  currentTripId: number | null;
  currentStats: RideStats | null;
  startedAt: number | null;

  startRecording: () => void;
  stopRecording: () => void;
  updateStats: (stats: RideStats) => void;
  setCurrentTripId: (id: number) => void;
}

export const useRideStore = create<RideState>()(
  immer((set) => ({
    isRecording: false,
    currentTripId: null,
    currentStats: null,
    startedAt: null,

    startRecording: () => set((s) => {
      s.isRecording = true;
      s.startedAt = Date.now();
      s.currentStats = { distanceKm: 0, durationS: 0, maxSpeedKmh: 0, avgSpeedKmh: 0 };
    }),
    stopRecording: () => set((s) => {
      s.isRecording = false;
    }),
    updateStats: (stats) => set((s) => { s.currentStats = stats; }),
    setCurrentTripId: (id) => set((s) => { s.currentTripId = id; }),
  })),
);
