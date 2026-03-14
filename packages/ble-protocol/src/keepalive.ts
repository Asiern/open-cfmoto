/**
 * TBox BLE keep-alive manager.
 *
 * Sends Heartbeat{ping:1} via control code 0x67 every 2000ms.
 * Maintains a 4000ms watchdog that resets on each ACK (control 0xE7).
 * If no ACK arrives within 4000ms, calls onDisconnect() and stops.
 *
 * Source: BleConstant.java (CONNECT_KEEP_LIVE_TIME=2000, CONNECT_KEEP_ALIVE_TIME_OUT=4000)
 *         BleModel.java (getLockControlFrame used for both Lock and Heartbeat)
 */

import { buildFrame } from './codec';
import { ControlCode } from './response-router';
import { Heartbeat } from './generated/meter';

const HEARTBEAT_INTERVAL_MS = 2000;
const WATCHDOG_TIMEOUT_MS = 4000;

export class KeepAliveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private watchdogId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private disconnectNotified = false;
  // Lazy-encoded on first use so module import never fails if generated/meter.ts is missing.
  private heartbeatFrame: Uint8Array | null = null;

  constructor(
    private readonly sendFn: (frame: Uint8Array) => Promise<void>,
    private readonly onDisconnect: () => void,
  ) {}

  private getHeartbeatFrame(): Uint8Array {
    if (!this.heartbeatFrame) {
      // ts-proto requires fromPartial() to fill in defaults before encoding
      const payload = Heartbeat.encode(Heartbeat.fromPartial({ ping: 1 })).finish();
      this.heartbeatFrame = buildFrame(ControlCode.LOCK_CONTROL, payload);
    }
    return this.heartbeatFrame;
  }

  /** Guards against calling onDisconnect more than once (send-fail + watchdog race). */
  private triggerDisconnect(): void {
    if (!this.disconnectNotified) {
      this.disconnectNotified = true;
      this.stop();
      this.onDisconnect();
    }
  }

  /**
   * Start the heartbeat loop. Call after auth completes.
   * Arms the watchdog immediately — first ACK must arrive within 4000ms.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.armWatchdog(); // must receive ACK within 4s to stay connected
    this.intervalId = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  /** Stop the heartbeat loop and clear all timers. */
  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.clearWatchdog();
  }

  /**
   * Notify the manager that an ACK was received (incoming control 0xE7).
   * Resets the 4000ms watchdog. Call this from the ResponseRouter LOCK_RESULT handler.
   */
  notifyAck(): void {
    if (this.running) {
      this.armWatchdog(); // reset watchdog — we're still alive
    }
  }

  private sendHeartbeat(): void {
    // Watchdog is managed via notifyAck, not reset on each send.
    // A send failure immediately triggers disconnect.
    this.sendFn(this.getHeartbeatFrame()).catch(() => {
      this.triggerDisconnect();
    });
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdogId = setTimeout(() => {
      this.triggerDisconnect();
    }, WATCHDOG_TIMEOUT_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdogId !== null) {
      clearTimeout(this.watchdogId);
      this.watchdogId = null;
    }
  }
}
