/**
 * Mock BLE protocol — emits synthetic BikeData for dev/testing.
 * No real BLE hardware required.
 */

import { IBikeProtocol, BleTransport, BikeData, CloudConnectCredentials } from '../types';

const TICK_INTERVAL_MS = 500;

function syntheticBikeData(tick: number): BikeData {
  const t = tick * 0.1;
  return {
    // MOCK ONLY — en hardware real estos campos no llegan por BLE.
    // La telemetría real viene del cloud via MQTT/VehicleNowInfoResp.
    rpm: Math.round(1200 + Math.sin(t) * 800),
    speedKmh: Math.round(Math.max(0, 60 + Math.sin(t * 0.7) * 40)),
    gear: Math.min(6, Math.max(1, Math.round(3 + Math.sin(t * 0.3) * 2))),
    coolantTempC: Math.round(85 + Math.sin(t * 0.05) * 5),
    batteryVoltage: parseFloat((12.4 + Math.sin(t * 0.02) * 0.3).toFixed(2)),
    throttlePercent: Math.round(Math.max(0, Math.min(100, 30 + Math.sin(t * 0.5) * 25))),
    odometerKm: 1234 + Math.floor(tick / 10),
    fuelPercent: Math.round(75 - tick * 0.01),
    faultCount: 0,
    bikeTimestampMs: Date.now(),
  };
}

export class MockBleTransport implements BleTransport {
  async scan() {
    return [{ id: 'mock-bike-001', name: 'CFMOTO_450MT_MOCK', rssi: -62 }];
  }
  async stopScan() {}
  async connect() {}
  async disconnect() {}
  async write() {}
  async requestMtu(_peripheralId: string, mtu: number): Promise<number> {
    return mtu; // mock: grant requested MTU
  }
  async subscribe(
    _peripheralId: string,
    _serviceUUID: string,
    _characteristicUUID: string,
    onData: (data: Uint8Array) => void,
  ) {
    // Mock transport doesn't use subscribe for data delivery
    void onData; // suppress unused warning
    return () => {};
  }
}

export class MockBikeProtocol implements IBikeProtocol {
  private listeners: Array<(data: BikeData) => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;

  async connect(
    _transport: BleTransport,
    _peripheralId: string,
    _cloudCredentials?: CloudConnectCredentials,
  ): Promise<() => void> {
    this.tick = 0;
    this.timer = setInterval(() => {
      const data = syntheticBikeData(this.tick++);
      this.listeners.forEach((l) => l(data));
    }, TICK_INTERVAL_MS);

    return () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    };
  }

  onData(callback: (data: BikeData) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  onLockState(_callback: (state: 'locked' | 'unlocked' | 'unknown') => void): () => void {
    return () => {};
  }

  async sendCommand(_command: Uint8Array): Promise<void> {
    // No-op in mock
  }
}
