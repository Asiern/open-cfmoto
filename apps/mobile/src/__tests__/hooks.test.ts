// Mock react-native-mmkv before any imports that use it
jest.mock('react-native-mmkv');

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 31 },
}));

// Mock bleService
jest.mock('../services/ble.service', () => ({
  BleService: jest.fn(),
  bleService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendCommand: jest.fn(),
    initialize: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock CFMotoProvider context — hooks that call useCFMotoContext() need this.
// The mock reads live store state so the tests can drive connectionState via the store.
jest.mock('../providers/CFMotoProvider', () => {
  const { useBikeStore } = require('../stores/bike.store');
  const { bleService: svc } = require('../services/ble.service');
  return {
    useCFMotoContext: () => ({
      bleService: svc,
      connectionState: useBikeStore.getState().connectionState,
      lastHeartbeatAck: useBikeStore.getState().lastHeartbeatAck,
      commandHistory: useBikeStore.getState().commandHistory,
    }),
  };
});

import {
  checkConnected,
  calcIsAlive,
  ALIVE_THRESHOLD_MS,
  buildTripSummary,
  persistTrip,
  LAST_TRIP_KEY,
  connectAndPersist,
  sendBikeCommand,
} from '../hooks/index';
import { useSettingsStore } from '../stores/settings.store';
import { useBikeStore } from '../stores/bike.store';
import { findCar, ControlCode } from '@open-cfmoto/ble-protocol';

beforeEach(() => {
  jest.clearAllMocks();
  useBikeStore.setState({
    connectionState: 'disconnected',
    connectedPeripheralId: null,
    bikeData: null,
    lastHeartbeatAck: null,
    commandHistory: [],
  });
  useSettingsStore.setState({
    units: 'metric',
    speedLimit: 120,
    lastConnectedDeviceId: null,
    lastConnectedDeviceName: null,
    useMockBike: false,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCFMoto
// ─────────────────────────────────────────────────────────────────────────────

describe('useCFMoto — connect()', () => {
  test('persists deviceId in settings.store after successful connect', async () => {
    const mockConnect = jest.fn().mockResolvedValue(undefined);

    await connectAndPersist(
      'AA:BB:CC:DD:EE:FF',
      'MT450 NK',
      { connect: mockConnect },
      useSettingsStore.getState().setLastConnectedDevice,
    );

    expect(useSettingsStore.getState().lastConnectedDeviceId).toBe('AA:BB:CC:DD:EE:FF');
    expect(useSettingsStore.getState().lastConnectedDeviceName).toBe('MT450 NK');
  });

  test('isConnected is true when connectionState is "connected"', () => {
    useBikeStore.setState({ connectionState: 'connected' });
    expect(useBikeStore.getState().connectionState === 'connected').toBe(true);
  });

  test('isConnected is false when connectionState is "disconnected"', () => {
    useBikeStore.setState({ connectionState: 'disconnected' });
    expect(useBikeStore.getState().connectionState === 'connected').toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useBikeCommands
// ─────────────────────────────────────────────────────────────────────────────

describe('useBikeCommands — connection guard', () => {
  test('checkConnected throws when disconnected', () => {
    expect(() => checkConnected('disconnected')).toThrow('No active BLE connection');
  });

  test('checkConnected throws when connecting', () => {
    expect(() => checkConnected('connecting')).toThrow('No active BLE connection');
  });

  test('checkConnected does not throw when connected', () => {
    expect(() => checkConnected('connected')).not.toThrow();
  });
});

describe('useBikeCommands — findCar', () => {
  test('findCar("horn") sends the correct BLE frame via sendBikeCommand', async () => {
    const mockSend = jest.fn().mockResolvedValue(undefined);
    const mockRecord = jest.fn();
    const frame = findCar('horn');

    await sendBikeCommand(frame, ControlCode.FIND_CAR, 'connected', {
      sendCommand: mockSend,
      recordCommandSent: mockRecord,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(frame);
    expect(mockRecord).toHaveBeenCalledWith(ControlCode.FIND_CAR);
  });

  test('sendBikeCommand throws if not connected', async () => {
    const mockSend = jest.fn();
    const mockRecord = jest.fn();

    await expect(
      sendBikeCommand(new Uint8Array([0x01]), 0x6a, 'disconnected', {
        sendCommand: mockSend,
        recordCommandSent: mockRecord,
      }),
    ).rejects.toThrow('No active BLE connection');

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useHeartbeat
// ─────────────────────────────────────────────────────────────────────────────

describe('useHeartbeat — isAlive', () => {
  test('isAlive is false if lastHeartbeatAck is older than ALIVE_THRESHOLD_MS', () => {
    const oldAck = Date.now() - ALIVE_THRESHOLD_MS - 1000;
    expect(calcIsAlive(oldAck)).toBe(false);
  });

  test('isAlive is false if lastHeartbeatAck is null (never received)', () => {
    expect(calcIsAlive(null)).toBe(false);
  });

  test('isAlive is true with a recent ack', () => {
    const recentAck = Date.now() - 1000;
    expect(calcIsAlive(recentAck)).toBe(true);
  });

  test('isAlive boundary: exactly at threshold is false (exclusive)', () => {
    const now = Date.now();
    expect(calcIsAlive(now - ALIVE_THRESHOLD_MS, now)).toBe(false);
  });

  test('isAlive boundary: one ms inside threshold is true', () => {
    const now = Date.now();
    expect(calcIsAlive(now - ALIVE_THRESHOLD_MS + 1, now)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useRideRecording
// ─────────────────────────────────────────────────────────────────────────────

describe('useRideRecording — finalizeTrip', () => {
  test('buildTripSummary calculates durationMs correctly', () => {
    const summary = buildTripSummary('AA:BB:CC', 'MT450', 1000, 4000);
    expect(summary.durationMs).toBe(3000);
    expect(summary.startedAt).toBe(1000);
    expect(summary.endedAt).toBe(4000);
  });

  test('buildTripSummary preserves deviceId and deviceName', () => {
    const summary = buildTripSummary('AA:BB:CC:DD:EE:FF', 'MT450 NK', 0, 5000);
    expect(summary.deviceId).toBe('AA:BB:CC:DD:EE:FF');
    expect(summary.deviceName).toBe('MT450 NK');
  });

  test('buildTripSummary accepts null deviceName', () => {
    const summary = buildTripSummary('AA:BB', null, 0, 1000);
    expect(summary.deviceName).toBeNull();
  });

  test('trip is persisted to MMKV storage after persistTrip', () => {
    const stored = new Map<string, string>();
    const mockStorage = {
      set: (k: string, v: string) => { stored.set(k, v); },
      getString: (k: string) => stored.get(k),
    };

    const summary = buildTripSummary('AA:BB:CC', 'MT450', 1000, 4000);
    persistTrip(summary, mockStorage);

    const raw = mockStorage.getString(LAST_TRIP_KEY);
    expect(raw).toBeDefined();
    const saved = JSON.parse(raw!);
    expect(saved.deviceId).toBe('AA:BB:CC');
    expect(saved.durationMs).toBe(3000);
    expect(saved.startedAt).toBe(1000);
    expect(saved.endedAt).toBe(4000);
  });
});
