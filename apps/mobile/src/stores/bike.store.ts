import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { BikeData, ConnectionState } from '@open-cfmoto/ble-protocol';

const COMMAND_HISTORY_MAX = 20;

export interface CommandHistoryEntry {
  /** Control code of the sent command (e.g. 0x67 for LOCK_CONTROL). */
  code: number;
  /** ms timestamp when the command was written to BLE. */
  sentAt: number;
  /** ms timestamp when the matching ACK was received, or null if still pending. */
  ackedAt: number | null;
}

interface BikeState {
  connectionState: ConnectionState;
  connectedPeripheralId: string | null;
  bikeData: BikeData | null;
  /** Timestamp (ms) of the last received heartbeat ACK (0xEC or 0xE7). null until first ACK. */
  lastHeartbeatAck: number | null;
  /** FIFO log of the last 20 outgoing commands. */
  commandHistory: CommandHistoryEntry[];

  setConnectionState: (state: ConnectionState) => void;
  setConnectedPeripheral: (id: string | null) => void;
  updateBikeData: (data: BikeData) => void;
  /**
   * Record a heartbeat ACK. Call from the ResponseRouter handler for
   * KEEP_ALIVE_RESULT (0xEC) or LOCK_RESULT (0xE7) — TBD from live traffic.
   */
  recordHeartbeatAck: () => void;
  /** Record a command being sent. Call immediately before writing to BLE. */
  recordCommandSent: (code: number) => void;
  /**
   * Record an ACK for a previously sent command. Finds the most recent unacked
   * entry matching sentCode and sets its ackedAt timestamp.
   * Callers map ACK codes to sent codes (e.g. 0xE7 → 0x67).
   */
  recordCommandAcked: (sentCode: number) => void;
  reset: () => void;
}

export const useBikeStore = create<BikeState>()(
  immer((set) => ({
    connectionState: 'disconnected',
    connectedPeripheralId: null,
    bikeData: null,
    lastHeartbeatAck: null,
    commandHistory: [],

    setConnectionState: (state) => set((s) => { s.connectionState = state; }),
    setConnectedPeripheral: (id) => set((s) => { s.connectedPeripheralId = id; }),
    updateBikeData: (data) => set((s) => { s.bikeData = data; }),

    recordHeartbeatAck: () => set((s) => { s.lastHeartbeatAck = Date.now(); }),

    recordCommandSent: (code) => set((s) => {
      s.commandHistory.push({ code, sentAt: Date.now(), ackedAt: null });
      if (s.commandHistory.length > COMMAND_HISTORY_MAX) {
        s.commandHistory.shift();
      }
    }),

    recordCommandAcked: (sentCode) => set((s) => {
      // Scan from most recent backwards; update first unacked match
      for (let i = s.commandHistory.length - 1; i >= 0; i--) {
        const entry = s.commandHistory[i]!;
        if (entry.code === sentCode && entry.ackedAt === null) {
          entry.ackedAt = Date.now();
          break;
        }
      }
    }),

    reset: () => set((s) => {
      s.connectionState = 'disconnected';
      s.connectedPeripheralId = null;
      s.bikeData = null;
      s.lastHeartbeatAck = null;
      s.commandHistory = [];
    }),
  })),
);
