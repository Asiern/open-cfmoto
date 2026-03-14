// Mock react-native-mmkv before any imports that use it
jest.mock('react-native-mmkv');

import { useSettingsStore, settingsStorage } from '../stores/settings.store';

beforeEach(() => {
  // Reset to defaults between tests
  useSettingsStore.setState({
    units: 'metric',
    speedLimit: 120,
    lastConnectedDeviceId: null,
    lastConnectedDeviceName: null,
    useMockBike: false,
  });
});

describe('default values', () => {
  test('units is metric', () => {
    expect(useSettingsStore.getState().units).toBe('metric');
  });
  test('speedLimit is 120', () => {
    expect(useSettingsStore.getState().speedLimit).toBe(120);
  });
  test('lastConnectedDeviceId is null', () => {
    expect(useSettingsStore.getState().lastConnectedDeviceId).toBeNull();
  });
  test('lastConnectedDeviceName is null', () => {
    expect(useSettingsStore.getState().lastConnectedDeviceName).toBeNull();
  });
  test('useMockBike is false', () => {
    expect(useSettingsStore.getState().useMockBike).toBe(false);
  });
});

describe('setUnits()', () => {
  test('changes units to imperial', () => {
    useSettingsStore.getState().setUnits('imperial');
    expect(useSettingsStore.getState().units).toBe('imperial');
  });

  test('persists to MMKV storage', () => {
    useSettingsStore.getState().setUnits('imperial');
    const raw = settingsStorage.getString('open-cfmoto-settings');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!).state.units).toBe('imperial');
  });
});

describe('setSpeedLimit()', () => {
  test('updates speedLimit', () => {
    useSettingsStore.getState().setSpeedLimit(80);
    expect(useSettingsStore.getState().speedLimit).toBe(80);
  });

  test('persists to MMKV storage', () => {
    useSettingsStore.getState().setSpeedLimit(80);
    const raw = settingsStorage.getString('open-cfmoto-settings');
    expect(JSON.parse(raw!).state.speedLimit).toBe(80);
  });
});

describe('setLastConnectedDevice()', () => {
  test('sets both id and name', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    expect(useSettingsStore.getState().lastConnectedDeviceId).toBe('AA:BB:CC:DD:EE:FF');
    expect(useSettingsStore.getState().lastConnectedDeviceName).toBe('MT450 NK');
  });

  test('available synchronously — no await needed', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    // Synchronous read: no Promise, no await
    const id = useSettingsStore.getState().lastConnectedDeviceId;
    expect(id).toBe('AA:BB:CC:DD:EE:FF');
  });

  test('can be cleared with null', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    useSettingsStore.getState().setLastConnectedDevice(null, null);
    expect(useSettingsStore.getState().lastConnectedDeviceId).toBeNull();
    expect(useSettingsStore.getState().lastConnectedDeviceName).toBeNull();
  });

  test('persists to MMKV storage', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    const raw = settingsStorage.getString('open-cfmoto-settings');
    const state = JSON.parse(raw!).state;
    expect(state.lastConnectedDeviceId).toBe('AA:BB:CC:DD:EE:FF');
    expect(state.lastConnectedDeviceName).toBe('MT450 NK');
  });
});

describe('useMockBike (non-persisted)', () => {
  test('setUseMockBike updates in-memory value', () => {
    useSettingsStore.getState().setUseMockBike(true);
    expect(useSettingsStore.getState().useMockBike).toBe(true);
  });

  test('useMockBike is NOT written to MMKV storage', () => {
    useSettingsStore.getState().setUseMockBike(true);
    const raw = settingsStorage.getString('open-cfmoto-settings');
    if (raw) {
      const persisted = JSON.parse(raw).state;
      expect(persisted.useMockBike).toBeUndefined();
    }
  });
});
