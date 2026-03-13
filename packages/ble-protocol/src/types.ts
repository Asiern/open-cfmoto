/**
 * Core types and interfaces for the CFMoto BLE protocol.
 * This package has ZERO React Native dependencies — runs in Node/Jest.
 */

export type ConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'       // notify registered, MTU set, auth pending
  | 'authenticated'   // auth complete, keep-alive running
  | 'error';

/** Live telemetry snapshot from bike */
export interface BikeData {
  /** Engine RPM */
  rpm: number;
  /** Speed in km/h */
  speedKmh: number;
  /** Gear position: 0 = neutral, 1-6 = gear */
  gear: number;
  /** Engine coolant temperature °C */
  coolantTempC: number;
  /** Battery voltage in volts */
  batteryVoltage: number;
  /** Throttle position 0–100 % */
  throttlePercent: number;
  /** Odometer in km */
  odometerKm: number;
  /** Fuel level 0–100 % (if available) */
  fuelPercent: number | null;
  /** Fault code count */
  faultCount: number;
  /** Raw timestamp from bike frame (ms) or null */
  bikeTimestampMs: number | null;
}

/** Minimal BLE transport interface — implemented by RN adapter or mock */
export interface BleTransport {
  /**
   * Start scanning and resolve with discovered peripheral IDs.
   * Rejects after timeoutMs if nothing found.
   */
  scan(serviceUUIDs: string[], timeoutMs: number): Promise<PeripheralInfo[]>;

  /** Stop an in-progress scan */
  stopScan(): Promise<void>;

  /** Connect to a peripheral by ID */
  connect(peripheralId: string): Promise<void>;

  /** Disconnect from peripheral */
  disconnect(peripheralId: string): Promise<void>;

  /**
   * Write data to a GATT characteristic.
   * @param withResponse - true = Write with response, false = Write command
   */
  write(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: Uint8Array,
    withResponse: boolean,
  ): Promise<void>;

  /**
   * Request a specific ATT MTU from the peripheral.
   * The peripheral may negotiate a lower value.
   * @returns the negotiated MTU actually granted
   */
  requestMtu(peripheralId: string, mtu: number): Promise<number>;

  /**
   * Subscribe to notifications from a characteristic.
   * Returns an unsubscribe function.
   */
  subscribe(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string,
    onData: (data: Uint8Array) => void,
  ): Promise<() => void>;
}

export interface PeripheralInfo {
  id: string;
  name: string | null;
  rssi: number;
  /** Raw advertisement data as base64 */
  advertisementDataBase64?: string;
}

/** High-level bike protocol interface */
export interface IBikeProtocol {
  /** Connect to bike and return a cleanup function */
  connect(transport: BleTransport, peripheralId: string): Promise<() => void>;

  /** Subscribe to live telemetry frames */
  onData(callback: (data: BikeData) => void): () => void;

  /** Send a raw command (for testing) */
  sendCommand(command: Uint8Array): Promise<void>;
}
