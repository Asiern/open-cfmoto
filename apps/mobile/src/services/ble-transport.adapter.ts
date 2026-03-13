/**
 * RNBleTransport: implements BleTransport using react-native-ble-plx.
 * Only imported in production mode — mock mode uses MockBleTransport.
 */

import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { BleTransport, PeripheralInfo } from '@open-cfmoto/ble-protocol';
import { Buffer } from 'buffer';

export class RNBleTransport implements BleTransport {
  private manager = new BleManager();
  private connectedDevices = new Map<string, Device>();

  async scan(serviceUUIDs: string[], timeoutMs: number): Promise<PeripheralInfo[]> {
    return new Promise((resolve, reject) => {
      const found = new Map<string, PeripheralInfo>();
      const timer = setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve(Array.from(found.values()));
      }, timeoutMs);

      this.manager.startDeviceScan(serviceUUIDs, null, (error, device) => {
        if (error) {
          clearTimeout(timer);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (device) {
          found.set(device.id, {
            id: device.id,
            name: device.name,
            rssi: device.rssi ?? -100,
          });
        }
      });
    });
  }

  async stopScan(): Promise<void> {
    this.manager.stopDeviceScan();
  }

  async connect(peripheralId: string): Promise<void> {
    const device = await this.manager.connectToDevice(peripheralId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevices.set(peripheralId, device);
  }

  async disconnect(peripheralId: string): Promise<void> {
    const device = this.connectedDevices.get(peripheralId);
    if (device) {
      await device.cancelConnection();
      this.connectedDevices.delete(peripheralId);
    }
  }

  async write(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: Uint8Array,
    withResponse: boolean,
  ): Promise<void> {
    const device = this.connectedDevices.get(peripheralId);
    if (!device) throw new Error(`Not connected to ${peripheralId}`);
    const base64 = Buffer.from(data).toString('base64');
    if (withResponse) {
      await device.writeCharacteristicWithResponseForService(serviceUUID, characteristicUUID, base64);
    } else {
      await device.writeCharacteristicWithoutResponseForService(serviceUUID, characteristicUUID, base64);
    }
  }

  async requestMtu(peripheralId: string, mtu: number): Promise<number> {
    const device = this.connectedDevices.get(peripheralId);
    if (!device) throw new Error(`Not connected to ${peripheralId}`);
    const updated = await device.requestMTU(mtu);
    return updated.mtu ?? mtu;
  }

  async subscribe(
    peripheralId: string,
    serviceUUID: string,
    characteristicUUID: string,
    onData: (data: Uint8Array) => void,
  ): Promise<() => void> {
    const device = this.connectedDevices.get(peripheralId);
    if (!device) throw new Error(`Not connected to ${peripheralId}`);

    const subscription = device.monitorCharacteristicForService(
      serviceUUID,
      characteristicUUID,
      (error: Error | null, characteristic: Characteristic | null) => {
        if (error || !characteristic?.value) return;
        const bytes = Buffer.from(characteristic.value, 'base64');
        onData(new Uint8Array(bytes));
      },
    );

    return () => subscription.remove();
  }
}
