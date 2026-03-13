/**
 * CFMoto 450 series concrete BLE protocol implementation.
 * UUIDs and packet structures are scaffolded — update from RE findings.
 */

import { IBikeProtocol, BleTransport, BikeData } from './types';
import { SERVICE_MAIN, CHAR_NOTIFY, CHAR_WRITE } from './uuids';
import { decodePacket, encodeCommand } from './codec';

const CMD_HANDSHAKE = 0x10; // UNCONFIRMED
const CMD_REQUEST_TELEMETRY = 0x20; // UNCONFIRMED — may be push-based

export class CFMoto450Protocol implements IBikeProtocol {
  private listeners: Array<(data: BikeData) => void> = [];
  private transport: BleTransport | null = null;
  private peripheralId: string | null = null;
  private unsubscribeNotify: (() => void) | null = null;

  async connect(transport: BleTransport, peripheralId: string): Promise<() => void> {
    this.transport = transport;
    this.peripheralId = peripheralId;

    await transport.connect(peripheralId);

    this.unsubscribeNotify = await transport.subscribe(
      peripheralId,
      SERVICE_MAIN,
      CHAR_NOTIFY,
      (data) => this.handleNotification(data),
    );

    // Send handshake to start telemetry stream
    await this.sendHandshake();

    return () => this.cleanup();
  }

  onData(callback: (data: BikeData) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  async sendCommand(command: Uint8Array): Promise<void> {
    if (!this.transport || !this.peripheralId) {
      throw new Error('Not connected');
    }
    await this.transport.write(
      this.peripheralId,
      SERVICE_MAIN,
      CHAR_WRITE,
      command,
      true,
    );
  }

  private handleNotification(data: Uint8Array): void {
    try {
      const bikeData = decodePacket(data);
      this.listeners.forEach((l) => l(bikeData));
    } catch {
      // Malformed packet — ignore, log in debug builds
    }
  }

  private async sendHandshake(): Promise<void> {
    const payload = new Uint8Array([0x01]); // UNCONFIRMED
    const packet = encodeCommand(CMD_HANDSHAKE, payload);
    await this.sendCommand(packet);
  }

  private cleanup(): void {
    this.unsubscribeNotify?.();
    this.unsubscribeNotify = null;
    if (this.transport && this.peripheralId) {
      this.transport.disconnect(this.peripheralId).catch(() => {});
    }
    this.transport = null;
    this.peripheralId = null;
  }
}
