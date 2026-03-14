import React, { createContext, useContext, useEffect, PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { bleService, BleService } from '../services/ble.service';
import { requestBlePermissions } from '../utils/permissions';
import { useSettingsStore } from '../stores/settings.store';
import { useBikeStore, CommandHistoryEntry } from '../stores/bike.store';
import { ConnectionState } from '@open-cfmoto/ble-protocol';

export interface CFMotoContextValue {
  bleService: BleService;
  connectionState: ConnectionState;
  lastHeartbeatAck: number | null;
  commandHistory: CommandHistoryEntry[];
}

const CFMotoContext = createContext<CFMotoContextValue | null>(null);

export interface CFMotoProviderProps extends PropsWithChildren {
  onPermissionDenied?: () => void;
}

/**
 * Core initialization logic — exported for unit testing.
 *
 * On Android: requests BLE permissions before initializing.
 * On iOS: skips permission request (no runtime BLE permissions on iOS).
 *
 * Returns true if bleService was initialized, false if permissions were denied.
 */
export async function runBleInit(options: {
  useMock: boolean;
  onPermissionDenied?: () => void;
}): Promise<boolean> {
  let granted = true;
  if (Platform.OS === 'android') {
    granted = await requestBlePermissions();
  }
  if (!granted) {
    options.onPermissionDenied?.();
    return false;
  }
  bleService.initialize(options.useMock);
  return true;
}

/**
 * Top-level BLE lifecycle provider.
 *
 * Mount → request permissions (Android only) → initialize bleService → [app usage] → unmount → destroy.
 *
 * Exposes { bleService, connectionState, lastHeartbeatAck, commandHistory } via context.
 * All CFMoto hooks must be rendered inside this provider.
 */
export function CFMotoProvider({ children, onPermissionDenied }: CFMotoProviderProps) {
  const useMock = useSettingsStore((s) => s.useMockBike);
  const connectionState = useBikeStore((s) => s.connectionState);
  const lastHeartbeatAck = useBikeStore((s) => s.lastHeartbeatAck);
  const commandHistory = useBikeStore((s) => s.commandHistory);

  useEffect(() => {
    let cancelled = false;

    runBleInit({ useMock, onPermissionDenied }).catch((err) => {
      if (!cancelled) console.error('[CFMotoProvider] BLE init error:', err);
    });

    return () => {
      cancelled = true;
      bleService.destroy();
    };
    // [] intentional — run once on mount; useMock and onPermissionDenied are
    // read at mount time only (consistent with native BLE init lifecycle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: CFMotoContextValue = {
    bleService,
    connectionState,
    lastHeartbeatAck,
    commandHistory,
  };

  return <CFMotoContext.Provider value={value}>{children}</CFMotoContext.Provider>;
}

/**
 * Access the CFMoto context. Must be called inside <CFMotoProvider>.
 * @throws if called outside CFMotoProvider
 */
export function useCFMotoContext(): CFMotoContextValue {
  const ctx = useContext(CFMotoContext);
  if (ctx === null) {
    throw new Error(
      'CFMoto hooks must be used inside <CFMotoProvider>. ' +
        'Wrap your app or screen with <CFMotoProvider>.',
    );
  }
  return ctx;
}
