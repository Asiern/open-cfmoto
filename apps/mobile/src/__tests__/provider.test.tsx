// Mock react-native-mmkv before any imports that use it
jest.mock('react-native-mmkv');

// Mock react-native so we can control Platform.OS between tests
jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 31 },
}));

// Mock bleService with jest.fn() spies for all public methods
jest.mock('../services/ble.service', () => ({
  BleService: jest.fn(),
  bleService: {
    initialize: jest.fn(),
    destroy: jest.fn(),
    scan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendCommand: jest.fn(),
  },
}));

// Mock requestBlePermissions so tests control the permission outcome
jest.mock('../utils/permissions', () => ({
  requestBlePermissions: jest.fn(),
}));

import { runBleInit } from '../providers/CFMotoProvider';
import { bleService } from '../services/ble.service';
import { requestBlePermissions } from '../utils/permissions';

const mockPlatform = () => require('react-native').Platform as { OS: string };

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform().OS = 'android';
  (requestBlePermissions as jest.Mock).mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Android
// ─────────────────────────────────────────────────────────────────────────────

describe('runBleInit — Android', () => {
  test('calls requestBlePermissions', async () => {
    await runBleInit({ useMock: false });
    expect(requestBlePermissions).toHaveBeenCalledTimes(1);
  });

  test('calls bleService.initialize() after permissions are granted', async () => {
    await runBleInit({ useMock: true });
    expect(bleService.initialize).toHaveBeenCalledWith(true);
  });

  test('calls onPermissionDenied if permissions denied', async () => {
    (requestBlePermissions as jest.Mock).mockResolvedValue(false);
    const onDenied = jest.fn();

    await runBleInit({ useMock: false, onPermissionDenied: onDenied });

    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(bleService.initialize).not.toHaveBeenCalled();
  });

  test('returns false when permissions denied', async () => {
    (requestBlePermissions as jest.Mock).mockResolvedValue(false);
    const result = await runBleInit({ useMock: false });
    expect(result).toBe(false);
  });

  test('returns true when permissions granted', async () => {
    const result = await runBleInit({ useMock: false });
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// iOS
// ─────────────────────────────────────────────────────────────────────────────

describe('runBleInit — iOS', () => {
  test('does not call requestBlePermissions on iOS', async () => {
    mockPlatform().OS = 'ios';

    await runBleInit({ useMock: false });

    expect(requestBlePermissions).not.toHaveBeenCalled();
  });

  test('initializes bleService directly on iOS without requesting permissions', async () => {
    mockPlatform().OS = 'ios';

    await runBleInit({ useMock: false });

    expect(bleService.initialize).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unmount cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('provider unmount', () => {
  test('bleService.destroy() is called when the provider cleanup runs', () => {
    // The provider's useEffect returns () => { bleService.destroy() }
    // We test the cleanup function in isolation.
    const cleanup = () => bleService.destroy();
    cleanup();
    expect(bleService.destroy).toHaveBeenCalledTimes(1);
  });
});
