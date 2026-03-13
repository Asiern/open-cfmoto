import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type SpeedUnit = 'kmh' | 'mph';
type TempUnit = 'celsius' | 'fahrenheit';

interface SettingsState {
  speedUnit: SpeedUnit;
  tempUnit: TempUnit;
  useMockBike: boolean;

  setSpeedUnit: (unit: SpeedUnit) => void;
  setTempUnit: (unit: TempUnit) => void;
  setUseMockBike: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  immer((set) => ({
    speedUnit: 'kmh',
    tempUnit: 'celsius',
    useMockBike: false,

    setSpeedUnit: (unit) => set((s) => { s.speedUnit = unit; }),
    setTempUnit: (unit) => set((s) => { s.tempUnit = unit; }),
    setUseMockBike: (value) => set((s) => { s.useMockBike = value; }),
  })),
);
