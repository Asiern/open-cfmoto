import { KeepAliveManager } from '../src/keepalive';
import { parseFrame } from '../src/codec';
import { ControlCode } from '../src/response-router';

describe('KeepAliveManager', () => {
  let sentFrames: Uint8Array[];
  let disconnectCalled: boolean;
  let manager: KeepAliveManager;

  beforeEach(() => {
    jest.useFakeTimers(); // fresh clock at t=0 for every test
    sentFrames = [];
    disconnectCalled = false;
    manager = new KeepAliveManager(
      (frame) => { sentFrames.push(frame); return Promise.resolve(); },
      () => { disconnectCalled = true; },
    );
  });

  afterEach(() => {
    manager.stop();
    jest.useRealTimers();
  });

  test('sends first heartbeat after 2000ms', () => {
    manager.start();
    expect(sentFrames).toHaveLength(0);

    jest.advanceTimersByTime(2000);
    expect(sentFrames).toHaveLength(1);

    const parsed = parseFrame(sentFrames[0]!);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LOCK_CONTROL); // 0x67
  });

  test('sends heartbeat every 2000ms', () => {
    manager.start();
    jest.advanceTimersByTime(2000); // t=2000: heartbeat 1
    manager.notifyAck();            // reset watchdog
    jest.advanceTimersByTime(2000); // t=4000: heartbeat 2
    manager.notifyAck();            // reset watchdog
    jest.advanceTimersByTime(2000); // t=6000: heartbeat 3
    manager.notifyAck();
    expect(sentFrames).toHaveLength(3);
  });

  test('calls onDisconnect if no ACK within 4000ms of start', () => {
    manager.start(); // watchdog armed immediately for 4000ms
    jest.advanceTimersByTime(4000); // watchdog fires
    expect(disconnectCalled).toBe(true);
  });

  test('does NOT call onDisconnect if ACK arrives before 4000ms', () => {
    manager.start(); // watchdog armed at t=0, fires at t=4000

    jest.advanceTimersByTime(2000); // heartbeat sent at t=2000
    manager.notifyAck();            // ACK resets watchdog → fires at t=2000+4000=t=6000

    jest.advanceTimersByTime(3999); // advance to t=5999 — watchdog at t=6000 not yet fired
    expect(disconnectCalled).toBe(false);
  });

  test('calls onDisconnect when ACK stops coming', () => {
    manager.start();
    manager.notifyAck();            // ACK at t=0 → watchdog reset to t=4000
    jest.advanceTimersByTime(4000); // watchdog fires at t=4000
    expect(disconnectCalled).toBe(true);
  });

  test('stops sending after stop()', () => {
    manager.start();
    jest.advanceTimersByTime(2000);
    expect(sentFrames).toHaveLength(1);

    manager.stop();
    jest.advanceTimersByTime(10000);
    expect(sentFrames).toHaveLength(1);
  });

  test('stop() prevents watchdog from firing', () => {
    manager.start(); // watchdog armed at t=0 for 4000ms
    manager.stop();
    jest.advanceTimersByTime(5000); // watchdog would have fired
    expect(disconnectCalled).toBe(false);
  });

  // ── ACK control code confirmation (DecoderData.KEEP_ALIVE = -20 = 0xEC) ──────

  test('notifyAck() resets watchdog (0xEC path)', () => {
    // Simulates: ResponseRouter receives 0xEC → calls manager.notifyAck()
    manager.start(); // watchdog fires at t=4000

    jest.advanceTimersByTime(3000);
    manager.notifyAck(); // ACK at t=3000 → watchdog reset to t=7000

    jest.advanceTimersByTime(3999); // advance to t=6999 — watchdog at t=7000 not fired
    expect(disconnectCalled).toBe(false);
    manager.stop();
  });

  test('watchdog fires if 0xE7 arrives but notifyAck() is NOT called', () => {
    // 0xE7 (LOCK_RESULT) is NOT the heartbeat ACK — notifyAck must not be called for it.
    // This test asserts that without notifyAck(), the watchdog fires after 4000ms.
    manager.start(); // watchdog fires at t=4000
    // Simulate 0xE7 frame arriving but handler correctly does NOT call notifyAck()
    jest.advanceTimersByTime(4000);
    expect(disconnectCalled).toBe(true);
  });
});
