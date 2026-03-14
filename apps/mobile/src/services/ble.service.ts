/**
 * BLE service singleton — bridges RNBleTransport/MockBleTransport
 * with the CFMoto450Protocol and feeds data into Zustand stores.
 */

import { BleTransport, IBikeProtocol, PeripheralInfo } from '@open-cfmoto/ble-protocol';
import { MockBikeProtocol, MockBleTransport } from '@open-cfmoto/ble-protocol';
import { CFMoto450Protocol } from '@open-cfmoto/ble-protocol';
import { useBikeStore } from '../stores/bike.store';
import { SERVICE_MAIN } from '@open-cfmoto/ble-protocol';

export class BleService {
  private protocol: IBikeProtocol | null = null;
  private transport: BleTransport | null = null;
  private disconnectFn: (() => void) | null = null;
  private unsubscribeData: (() => void) | null = null;

  /** Call once at app start */
  initialize(useMock: boolean): void {
    if (useMock) {
      this.transport = new MockBleTransport();
      this.protocol = new MockBikeProtocol();
    } else {
      // RNBleTransport is imported lazily to avoid requiring BLE hardware in mock mode
      const { RNBleTransport } = require('./ble-transport.adapter');
      this.transport = new RNBleTransport();
      this.protocol = new CFMoto450Protocol();
    }
  }

  async scan(): Promise<PeripheralInfo[]> {
    if (!this.transport) throw new Error('BleService not initialized');
    useBikeStore.getState().setConnectionState('scanning');
    try {
      const peripherals = await this.transport.scan([SERVICE_MAIN], 10_000);
      useBikeStore.getState().setConnectionState('disconnected');
      return peripherals;
    } catch (e) {
      useBikeStore.getState().setConnectionState('error');
      throw e;
    }
  }

  async connect(peripheralId: string): Promise<void> {
    if (!this.protocol || !this.transport) throw new Error('BleService not initialized');
    useBikeStore.getState().setConnectionState('connecting');
    try {
      this.disconnectFn = await this.protocol.connect(this.transport, peripheralId);
      this.unsubscribeData = this.protocol.onData((data) => {
        useBikeStore.getState().updateBikeData(data);
      });
      useBikeStore.getState().setConnectionState('connected');
      useBikeStore.getState().setConnectedPeripheral(peripheralId);
    } catch (e) {
      useBikeStore.getState().setConnectionState('error');
      throw e;
    }
  }

  disconnect(): void {
    this.unsubscribeData?.();
    this.disconnectFn?.();
    this.unsubscribeData = null;
    this.disconnectFn = null;
    useBikeStore.getState().reset();
  }

  /** Send a pre-built BLE frame (Uint8Array) to the connected bike. */
  async sendCommand(frame: Uint8Array): Promise<void> {
    if (!this.protocol) throw new Error('BleService not initialized');
    await this.protocol.sendCommand(frame);
  }

  /** Release all resources. Call on app unmount (CFMotoProvider cleanup). */
  destroy(): void {
    this.disconnect();
    this.protocol = null;
    this.transport = null;
  }
}

export const bleService = new BleService();
