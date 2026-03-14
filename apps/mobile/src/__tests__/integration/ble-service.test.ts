/**
 * Integration tests for BleService — wires real CFMoto450Protocol with a spy
 * transport so the full stack (codec → protocol → store) runs without hardware.
 *
 * Mock scope: ONLY the BleTransport layer.
 * Real: CFMoto450Protocol connection sequence, codec, commands, KeepAliveManager.
 *
 * CFMoto450Protocol status: connect() sequence is fully real (connect → 100ms delay
 * → subscribe → requestMtu → handshake stub). KeepAliveManager and ResponseRouter
 * are not yet wired into CFMoto450Protocol (Block 2 TODOs). Keepalive integration
 * is therefore tested via KeepAliveManager directly (Scenario 2).
 * End-to-end validation against real hardware: see docs/hardware-validation.md.
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('react-native-mmkv');
jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 31 },
}));

import { BleService } from '../../services/ble.service';
import {
  CFMoto450Protocol,
  KeepAliveManager,
  ControlCode,
  lock,
  findCar,
} from '@open-cfmoto/ble-protocol';
import { CHAR_WRITE, CHAR_NOTIFY, SERVICE_MAIN } from '@open-cfmoto/ble-protocol';
import { useBikeStore } from '../../stores/bike.store';

// ─── Spy transport factory ────────────────────────────────────────────────────

/**
 * Creates a BleTransport-compatible spy with Jest mock functions.
 * simulateNotification() lets tests inject incoming BLE frames.
 */
function makeSpyTransport() {
  let notifyHandler: ((data: Uint8Array) => void) | null = null;

  const transport = {
    scan: jest.fn().mockResolvedValue([
      { id: 'AA:BB:CC:DD:EE:FF', name: 'MT450', rssi: -65 },
    ]),
    stopScan: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    requestMtu: jest.fn().mockResolvedValue(185),
    subscribe: jest.fn().mockImplementation(
      (_pid: string, _svc: string, _char: string, handler: (d: Uint8Array) => void) => {
        notifyHandler = handler;
        return Promise.resolve(() => {
          notifyHandler = null;
        });
      },
    ),
    write: jest.fn().mockResolvedValue(undefined),
    /** Inject an incoming BLE notification frame from the bike side. */
    simulateNotification(frame: Uint8Array) {
      notifyHandler?.(frame);
    },
  };
  return transport;
}

/** Wire a real CFMoto450Protocol + spy transport into a BleService instance. */
function makeBleService(transport: ReturnType<typeof makeSpyTransport>): BleService {
  const svc = new BleService() as unknown as Record<string, unknown>;
  svc['protocol'] = new CFMoto450Protocol();
  svc['transport'] = transport;
  return svc as unknown as BleService;
}

const PERIPHERAL_ID = 'AA:BB:CC:DD:EE:FF';

beforeEach(() => {
  jest.useFakeTimers();
  useBikeStore.setState({
    connectionState: 'disconnected',
    connectedPeripheralId: null,
    bikeData: null,
    lastHeartbeatAck: null,
    commandHistory: [],
  });
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Scenario 1: Full connection sequence ─────────────────────────────────────

describe('Scenario 1 — full connection sequence', () => {
  test('connect() calls transport in order: connect → subscribe → requestMtu', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const connectPromise = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200); // past 100ms post-connect delay
    await connectPromise;

    const connectOrder = transport.connect.mock.invocationCallOrder[0]!;
    const subscribeOrder = transport.subscribe.mock.invocationCallOrder[0]!;
    const mtuOrder = transport.requestMtu.mock.invocationCallOrder[0]!;
    expect(connectOrder).toBeLessThan(subscribeOrder);
    expect(subscribeOrder).toBeLessThan(mtuOrder);
  });

  test('subscribe() targets CHAR_NOTIFY on SERVICE_MAIN', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const connectPromise = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await connectPromise;

    expect(transport.subscribe).toHaveBeenCalledWith(
      PERIPHERAL_ID,
      SERVICE_MAIN,
      CHAR_NOTIFY,
      expect.any(Function),
    );
  });

  test('requestMtu() negotiates exactly 185 bytes', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const connectPromise = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await connectPromise;

    expect(transport.requestMtu).toHaveBeenCalledWith(PERIPHERAL_ID, 185);
  });

  test('store shows "connected" with correct peripheralId after connect()', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const connectPromise = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await connectPromise;

    expect(useBikeStore.getState().connectionState).toBe('connected');
    expect(useBikeStore.getState().connectedPeripheralId).toBe(PERIPHERAL_ID);
  });

  test('store transitions through "connecting" before "connected"', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);
    const states: string[] = [];

    // Snapshot state just after connect() starts (before first await resolves)
    transport.connect.mockImplementation(async () => {
      states.push(useBikeStore.getState().connectionState);
    });

    const connectPromise = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await connectPromise;

    expect(states).toContain('connecting');
    expect(useBikeStore.getState().connectionState).toBe('connected');
  });
});

// ─── Scenario 3: Command writes to CHAR_WRITE ─────────────────────────────────

describe('Scenario 3 — BLE commands route to CHAR_WRITE', () => {
  async function connectSvc() {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);
    const p = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    return { transport, svc };
  }

  test('sendCommand() writes to CHAR_WRITE with withResponse=true', async () => {
    const { transport, svc } = await connectSvc();

    const payload = new Uint8Array(16); // placeholder encrypted payload
    const frame = lock(payload);
    await svc.sendCommand(frame);

    expect(transport.write).toHaveBeenCalledWith(
      PERIPHERAL_ID,
      SERVICE_MAIN,
      CHAR_WRITE,
      frame,
      true,
    );
  });

  test('findCar("horn") frame carries control code FIND_CAR (0x6A)', async () => {
    const { transport, svc } = await connectSvc();

    const frame = findCar('horn');
    await svc.sendCommand(frame);

    // Frame byte[2] is the control code
    const writtenFrame: Uint8Array = transport.write.mock.calls[0][3];
    expect(writtenFrame[2]).toBe(ControlCode.FIND_CAR); // 0x6A
  });

  test('sendCommand() before connect() throws "not initialized"', async () => {
    const svc = new BleService();
    const frame = findCar('flash');
    await expect(svc.sendCommand(frame)).rejects.toThrow();
  });
});

// ─── Scenario 4: Disconnect / reconnect ──────────────────────────────────────

describe('Scenario 4 — disconnect and manual reconnect', () => {
  test('disconnect() resets store to disconnected', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const p = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(useBikeStore.getState().connectionState).toBe('connected');

    svc.disconnect();

    expect(useBikeStore.getState().connectionState).toBe('disconnected');
    expect(useBikeStore.getState().connectedPeripheralId).toBeNull();
  });

  test('disconnect() calls transport.disconnect()', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const p = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await p;

    svc.disconnect();

    expect(transport.disconnect).toHaveBeenCalledWith(PERIPHERAL_ID);
  });

  test('no auto-reconnect after disconnect — manual connect succeeds', async () => {
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    // First connect
    let p = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await p;

    svc.disconnect();
    expect(useBikeStore.getState().connectionState).toBe('disconnected');

    // Verify no automatic reconnect occurs after a pause
    await jest.advanceTimersByTimeAsync(5000);
    expect(useBikeStore.getState().connectionState).toBe('disconnected');

    // Manual reconnect succeeds
    p = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(useBikeStore.getState().connectionState).toBe('connected');
    expect(transport.connect).toHaveBeenCalledTimes(2);
  });
});

// ─── Scenario 2: KeepAliveManager watchdog + store integration ───────────────
//
// NOTE: KeepAliveManager is not yet wired into CFMoto450Protocol (Block 2 TODO).
// These tests validate KeepAliveManager behaviour and show how it would integrate
// with BleService.disconnect() on watchdog expiry.
// Full end-to-end validation requires live BLE traffic. See docs/hardware-validation.md §2.

describe('Scenario 2 — KeepAlive watchdog integration', () => {
  test('watchdog fires onDisconnect after 4s without ACK', () => {
    const onDisconnect = jest.fn();
    const sendFn = jest.fn().mockResolvedValue(undefined);

    const mgr = new KeepAliveManager(sendFn, onDisconnect);
    mgr.start();

    jest.advanceTimersByTime(4000);

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  test('notifyAck() resets watchdog — ACK at 3s prevents 4s timeout', () => {
    const onDisconnect = jest.fn();
    const sendFn = jest.fn().mockResolvedValue(undefined);

    const mgr = new KeepAliveManager(sendFn, onDisconnect);
    mgr.start();

    jest.advanceTimersByTime(3000);
    mgr.notifyAck(); // resets watchdog to t=3000+4000=7000
    jest.advanceTimersByTime(3000); // advance to t=6000 — watchdog at 7000 not fired

    expect(onDisconnect).not.toHaveBeenCalled();
    mgr.stop();
  });

  test('heartbeat frame carries LOCK_CONTROL code (0x67) at 2s interval', () => {
    const sentFrames: Uint8Array[] = [];
    const sendFn = jest.fn().mockImplementation((f: Uint8Array) => {
      sentFrames.push(f);
      return Promise.resolve();
    });

    const mgr = new KeepAliveManager(sendFn, jest.fn());
    mgr.start();

    jest.advanceTimersByTime(2000);
    mgr.stop();

    expect(sentFrames).toHaveLength(1);
    expect(sentFrames[0]![2]).toBe(ControlCode.LOCK_CONTROL); // frame byte[2] = control code
  });

  test('watchdog onDisconnect callback can drive BleService.disconnect()', async () => {
    // Demonstrates the integration: KeepAliveManager → onDisconnect → bleService.disconnect()
    const transport = makeSpyTransport();
    const svc = makeBleService(transport);

    const p = svc.connect(PERIPHERAL_ID);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(useBikeStore.getState().connectionState).toBe('connected');

    // Simulate what a wired CFMoto450Protocol would do on watchdog expiry
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const mgr = new KeepAliveManager(sendFn, () => svc.disconnect());
    mgr.start();

    jest.advanceTimersByTime(4000); // watchdog fires → svc.disconnect() called

    expect(useBikeStore.getState().connectionState).toBe('disconnected');
    mgr.stop();
  });
});
