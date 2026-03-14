import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

/**
 * Exported so tests can inspect the raw MMKV state and the mock can be injected.
 * Use id 'open-cfmoto-settings' to isolate from other MMKV stores.
 */
export const settingsStorage = new MMKV({ id: 'open-cfmoto-settings' });

const mmkvStorage = createJSONStorage(() => ({
  getItem: (key: string): string | null => settingsStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => { settingsStorage.set(key, value); },
  removeItem: (key: string): void => { settingsStorage.delete(key); },
}));

interface SettingsState {
  /** Unit system for display and BLE commands. */
  units: 'metric' | 'imperial';
  /** Max speed limit in km/h (0–255, matches Meter.Preference.maximumSpeedLimit). */
  speedLimit: number;
  /** BLE peripheral ID of the last successfully connected bike. */
  lastConnectedDeviceId: string | null;
  /** Human-readable name of the last connected bike. */
  lastConnectedDeviceName: string | null;
  /**
   * Selects mock vs real BLE transport. In-memory only — NOT persisted to MMKV.
   * Used by ble.service.ts to choose MockBleTransport or RNBleTransport.
   */
  useMockBike: boolean;

  setUnits: (units: 'metric' | 'imperial') => void;
  setSpeedLimit: (kmh: number) => void;
  setLastConnectedDevice: (id: string | null, name: string | null) => void;
  setUseMockBike: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      units: 'metric',
      speedLimit: 120,
      lastConnectedDeviceId: null,
      lastConnectedDeviceName: null,
      useMockBike: false,

      setUnits: (units) => set((s) => { s.units = units; }),
      setSpeedLimit: (kmh) => set((s) => { s.speedLimit = kmh; }),
      setLastConnectedDevice: (id, name) => set((s) => {
        s.lastConnectedDeviceId = id;
        s.lastConnectedDeviceName = name;
      }),
      setUseMockBike: (value) => set((s) => { s.useMockBike = value; }),
    })),
    {
      name: 'open-cfmoto-settings',
      storage: mmkvStorage,
      // Only these 4 fields are persisted; useMockBike stays in-memory
      partialize: (state) => ({
        units: state.units,
        speedLimit: state.speedLimit,
        lastConnectedDeviceId: state.lastConnectedDeviceId,
        lastConnectedDeviceName: state.lastConnectedDeviceName,
      }),
    },
  ),
);
