/**
 * CFMoto 450 series concrete BLE protocol implementation.
 * UUIDs and packet structures confirmed from jadx decompilation of
 * com.cfmoto.cfmotointernational. See docs/ for RE findings.
 */

import { CloudAuthClient, VehicleClient } from '@open-cfmoto/cloud-client';
import { IBikeProtocol, BleTransport, BikeData, CloudConnectCredentials } from './types';
import { SERVICE_MAIN, CHAR_NOTIFY, CHAR_WRITE } from './uuids';
import { AuthFlow, AuthCredentials } from './auth';
import { ResponseRouter } from './response-router';

export { AuthCredentials } from './auth';

export class CFMoto450Protocol implements IBikeProtocol {
  private listeners: Array<(data: BikeData) => void> = [];
  private transport: BleTransport | null = null;
  private peripheralId: string | null = null;
  private unsubscribeNotify: (() => void) | null = null;
  /** Active auth router — non-null only while authentication is in progress */
  private authRouter: ResponseRouter | null = null;
  private readonly cloudAuthClient: Pick<CloudAuthClient, 'login'>;
  private readonly vehicleClient: Pick<VehicleClient, 'getEncryptInfo'>;

  constructor(clients?: {
    cloudAuthClient?: Pick<CloudAuthClient, 'login'>;
    vehicleClient?: Pick<VehicleClient, 'getEncryptInfo'>;
  }) {
    this.cloudAuthClient = clients?.cloudAuthClient ?? new CloudAuthClient();
    this.vehicleClient = clients?.vehicleClient ?? new VehicleClient();
  }

  async connect(
    transport: BleTransport,
    peripheralId: string,
    cloudCredentials?: CloudConnectCredentials,
  ): Promise<() => void> {
    this.transport = transport;
    this.peripheralId = peripheralId;

    await transport.connect(peripheralId);

    // Delay 100ms before enabling notify — confirmed in BleModel.java onConnectSuccess().
    // Without this, some devices reject the descriptor write on an unstable GATT connection.
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.unsubscribeNotify = await transport.subscribe(
      peripheralId,
      SERVICE_MAIN,
      CHAR_NOTIFY,
      (data) => this.handleNotification(data),
    );

    // Negotiate MTU before any commands — confirmed 185 bytes (BleModel.java).
    // Auth proceeds even if MTU negotiation fails (onSetMTUFailure also calls authPkg).
    try {
      const negotiated = await transport.requestMtu(peripheralId, 185);
      if (negotiated < 185) {
        console.warn(`[CFMoto] MTU negotiated to ${negotiated} (wanted 185) — continuing`);
      }
    } catch {
      console.warn('[CFMoto] MTU negotiation failed — continuing with default MTU');
    }

    // 2000ms delay between MTU callback and auth — confirmed in BleModel$bleMtuChangedCallback$1.java.
    // Applied on both MTU success and failure paths.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (cloudCredentials) {
      const token = await this.cloudAuthClient.login(
        cloudCredentials.username,
        cloudCredentials.password,
      );
      const encryptInfo = await this.vehicleClient.getEncryptInfo(
        cloudCredentials.vehicleId,
        token,
      );

      const credentials: AuthCredentials = {
        encryptValue: encryptInfo.encryptValue,
        key: encryptInfo.key,
      };

      const router = new ResponseRouter();
      this.authRouter = router;
      const sendFn = (frame: Uint8Array) =>
        transport.write(peripheralId, SERVICE_MAIN, CHAR_WRITE, frame, true);
      const auth = new AuthFlow(sendFn, router);
      try {
        await auth.authenticate(credentials);
      } finally {
        // Always clear authRouter so handleNotification stops dispatching to it
        this.authRouter = null;
      }
    } else {
      console.warn('[CFMoto] No cloud credentials provided — skipping auth (dev mode)');
    }

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
    // Dispatch incoming frames to the auth router while auth is in progress
    this.authRouter?.dispatch(data);
    // TODO(block2): wire to telemetry ResponseRouter + proto decode
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
