import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { BikeData, ConnectionState } from '@open-cfmoto/ble-protocol';

interface BikeState {
  connectionState: ConnectionState;
  connectedPeripheralId: string | null;
  bikeData: BikeData | null;

  setConnectionState: (state: ConnectionState) => void;
  setConnectedPeripheral: (id: string | null) => void;
  updateBikeData: (data: BikeData) => void;
  reset: () => void;
}

export const useBikeStore = create<BikeState>()(
  immer((set) => ({
    connectionState: 'disconnected',
    connectedPeripheralId: null,
    bikeData: null,

    setConnectionState: (state) => set((s) => { s.connectionState = state; }),
    setConnectedPeripheral: (id) => set((s) => { s.connectedPeripheralId = id; }),
    updateBikeData: (data) => set((s) => { s.bikeData = data; }),
    reset: () => set((s) => {
      s.connectionState = 'disconnected';
      s.connectedPeripheralId = null;
      s.bikeData = null;
    }),
  })),
);
