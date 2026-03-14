/**
 * Public React hooks for CFMoto BLE operations.
 *
 * All hooks except useSettings require <CFMotoProvider> in the tree.
 *
 * Pure helper functions used internally are also exported for unit testing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MMKV } from 'react-native-mmkv';
import { useCFMotoContext } from '../providers/CFMotoProvider';
import { useBikeStore } from '../stores/bike.store';
import { useSettingsStore } from '../stores/settings.store';
import {
  lock,
  unlock,
  findCar as buildFindCar,
  setIndicators as buildSetIndicators,
  setUnits as buildSetUnits,
  setSpeedLimit as buildSetSpeedLimit,
  ControlCode,
  ConnectionState,
} from '@open-cfmoto/ble-protocol';
import { BleService } from '../services/ble.service';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — exported for unit testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Throws a descriptive error if the connection is not active.
 * Called by every useBikeCommands action.
 */
export function checkConnected(connectionState: ConnectionState): void {
  if (connectionState !== 'connected') {
    throw new Error(
      'CFMoto: No active BLE connection. ' +
        'Call connect() and wait for connectionState === "connected" before sending commands.',
    );
  }
}

/** Heartbeat "alive" threshold: interval (2s) + watchdog (4s). */
export const ALIVE_THRESHOLD_MS = 6000;

/**
 * Returns true if a heartbeat ACK was received within ALIVE_THRESHOLD_MS.
 * @param lastAck - timestamp (ms) of the last received ACK, or null
 * @param now     - injectable for deterministic testing; defaults to Date.now()
 */
export function calcIsAlive(lastAck: number | null, now = Date.now()): boolean {
  return lastAck !== null && now - lastAck < ALIVE_THRESHOLD_MS;
}

export interface TripSummary {
  deviceId: string;
  deviceName: string | null;
  startedAt: number; // ms timestamp
  endedAt: number;   // ms timestamp
  durationMs: number;
}

/** Build a TripSummary from raw timestamps. Pure function. */
export function buildTripSummary(
  deviceId: string,
  deviceName: string | null,
  startedAt: number,
  endedAt: number,
): TripSummary {
  return { deviceId, deviceName, startedAt, endedAt, durationMs: endedAt - startedAt };
}

export const LAST_TRIP_KEY = 'lastTrip';

/** Persist a TripSummary to MMKV-compatible storage. Injectable for testing. */
export function persistTrip(
  summary: TripSummary,
  storage: { set(key: string, value: string): void },
): void {
  storage.set(LAST_TRIP_KEY, JSON.stringify(summary));
}

/**
 * Connect to a bike and persist deviceId/Name to settings store.
 * Exported for testing; called internally by useCFMoto.connect().
 */
export async function connectAndPersist(
  deviceId: string,
  deviceName: string,
  svc: Pick<BleService, 'connect'>,
  setDevice: (id: string | null, name: string | null) => void,
): Promise<void> {
  await svc.connect(deviceId);
  setDevice(deviceId, deviceName);
}

/**
 * Guard-and-send helper: checks connection, records the command, then sends the frame.
 * Exported for testing; called internally by useBikeCommands.
 */
export async function sendBikeCommand(
  frame: Uint8Array,
  code: number,
  connectionState: ConnectionState,
  deps: {
    sendCommand: (frame: Uint8Array) => Promise<void>;
    recordCommandSent: (code: number) => void;
  },
): Promise<void> {
  checkConnected(connectionState);
  deps.recordCommandSent(code);
  await deps.sendCommand(frame);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rides MMKV storage — exported so tests can inspect persisted state
// ─────────────────────────────────────────────────────────────────────────────

export const ridesStorage = new MMKV({ id: 'open-cfmoto-rides' });

// ─────────────────────────────────────────────────────────────────────────────
// useCFMoto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Primary hook for BLE connection management.
 * Requires <CFMotoProvider>.
 *
 * @returns connect(deviceId, deviceName) — connects and persists device to settings
 * @returns disconnect()
 * @returns connectionState — raw ConnectionState from store
 * @returns isConnected — boolean shorthand
 */
export function useCFMoto() {
  const { bleService, connectionState } = useCFMotoContext();
  const setLastConnectedDevice = useSettingsStore((s) => s.setLastConnectedDevice);

  const connect = useCallback(
    async (deviceId: string, deviceName: string): Promise<void> => {
      await connectAndPersist(deviceId, deviceName, bleService, setLastConnectedDevice);
    },
    [bleService, setLastConnectedDevice],
  );

  const disconnect = useCallback((): void => {
    bleService.disconnect();
  }, [bleService]);

  const isConnected = connectionState === 'connected';

  return { connect, disconnect, connectionState, isConnected };
}

// ─────────────────────────────────────────────────────────────────────────────
// useBikeCommands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns senders for all supported BLE control commands.
 * Every command throws if not connected.
 * Requires <CFMotoProvider>.
 */
export function useBikeCommands() {
  const { bleService, connectionState } = useCFMotoContext();
  const recordCommandSent = useBikeStore((s) => s.recordCommandSent);

  const send = (frame: Uint8Array, code: number) =>
    sendBikeCommand(frame, code, connectionState, {
      sendCommand: (f) => bleService.sendCommand(f),
      recordCommandSent,
    });

  return {
    lock: (encryptedPayload: Uint8Array) =>
      send(lock(encryptedPayload), ControlCode.LOCK_CONTROL),
    unlock: (encryptedPayload: Uint8Array) =>
      send(unlock(encryptedPayload), ControlCode.LOCK_CONTROL),
    findCar: (mode: 'horn' | 'flash' | 'light') =>
      send(buildFindCar(mode), ControlCode.FIND_CAR),
    setIndicators: (side: 'left' | 'right' | 'off') =>
      send(buildSetIndicators(side), ControlCode.LIGHT_CONTROL),
    setUnits: (system: 'metric' | 'imperial') =>
      send(buildSetUnits(system), ControlCode.DISPLAY_UNITS),
    setSpeedLimit: (kmh: number) =>
      send(buildSetSpeedLimit(kmh), ControlCode.PREFERENCE),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useSettings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thin wrapper over settings.store — no additional logic.
 * Does NOT require <CFMotoProvider>.
 */
export function useSettings() {
  const units = useSettingsStore((s) => s.units);
  const speedLimit = useSettingsStore((s) => s.speedLimit);
  const lastConnectedDeviceId = useSettingsStore((s) => s.lastConnectedDeviceId);
  const lastConnectedDeviceName = useSettingsStore((s) => s.lastConnectedDeviceName);
  const setUnits = useSettingsStore((s) => s.setUnits);
  const setSpeedLimit = useSettingsStore((s) => s.setSpeedLimit);

  return {
    units,
    speedLimit,
    lastConnectedDevice: { id: lastConnectedDeviceId, name: lastConnectedDeviceName },
    setUnits,
    setSpeedLimit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useHeartbeat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reflects the live heartbeat status of the connected bike.
 * isAlive is true if an ACK was received within the last 6s
 * (2s heartbeat interval + 4s watchdog).
 * Requires <CFMotoProvider>.
 */
export function useHeartbeat() {
  const { lastHeartbeatAck } = useCFMotoContext();
  const isAlive = calcIsAlive(lastHeartbeatAck);
  return { lastAck: lastHeartbeatAck, isAlive };
}

// ─────────────────────────────────────────────────────────────────────────────
// useRideRecording
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages trip recording tied to BLE connection state.
 *
 * - Recording starts automatically when connectionState becomes 'connected'.
 * - Recording stops automatically on disconnect (endedAt is captured).
 * - Call finalizeTrip() to generate a TripSummary and persist to MMKV.
 *   Returns null if no trip has been started.
 *
 * Note: no telemetry fields (speed, RPM) — BLE is control-only.
 * Requires <CFMotoProvider>.
 */
export function useRideRecording() {
  const { connectionState } = useCFMotoContext();
  const lastConnectedDeviceId = useSettingsStore((s) => s.lastConnectedDeviceId);
  const lastConnectedDeviceName = useSettingsStore((s) => s.lastConnectedDeviceName);

  const [isRecording, setIsRecording] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const endedAtRef = useRef<number | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const deviceNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (connectionState === 'connected' && !isRecording) {
      startedAtRef.current = Date.now();
      endedAtRef.current = null;
      deviceIdRef.current = lastConnectedDeviceId;
      deviceNameRef.current = lastConnectedDeviceName;
      setIsRecording(true);
    } else if (connectionState !== 'connected' && isRecording) {
      endedAtRef.current = Date.now();
      setIsRecording(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  function finalizeTrip(): TripSummary | null {
    const deviceId = deviceIdRef.current;
    const startedAt = startedAtRef.current;
    if (deviceId === null || startedAt === null) return null;

    const endedAt = endedAtRef.current ?? Date.now();
    const summary = buildTripSummary(deviceId, deviceNameRef.current, startedAt, endedAt);
    persistTrip(summary, ridesStorage);
    return summary;
  }

  return { isRecording, finalizeTrip };
}
