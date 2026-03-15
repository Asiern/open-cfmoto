import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

export interface BleAuthRecord {
  vehicleId: string;
  peripheralId: string;
  encryptValue: string;
  key: string;
  idcard: string | null;
  userId: string | null;
  savedAt: number;
}

export const bleAuthStorage = new MMKV({ id: 'open-cfmoto-ble-auth' });

const mmkvStorage = createJSONStorage(() => ({
  getItem: (key: string): string | null => bleAuthStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    bleAuthStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    bleAuthStorage.delete(key);
  },
}));

interface BleAuthState {
  records: BleAuthRecord[];
  upsertRecord: (record: Omit<BleAuthRecord, 'savedAt'>) => void;
  getByPeripheralId: (peripheralId: string) => BleAuthRecord | null;
  hasAnyKey: () => boolean;
  clearAll: () => void;
}

export const useBleAuthStore = create<BleAuthState>()(
  persist(
    immer((set, get) => ({
      records: [],
      upsertRecord: (record) =>
        set((s) => {
          const existingIndex = s.records.findIndex(
            (r) => r.peripheralId === record.peripheralId && r.vehicleId === record.vehicleId,
          );
          const next: BleAuthRecord = { ...record, savedAt: Date.now() };
          if (existingIndex >= 0) {
            s.records[existingIndex] = next;
          } else {
            s.records.push(next);
          }
        }),
      getByPeripheralId: (peripheralId) => {
        const found = get()
          .records
          .filter((r) => r.peripheralId === peripheralId)
          .sort((a, b) => b.savedAt - a.savedAt)[0];
        return found ?? null;
      },
      hasAnyKey: () => get().records.length > 0,
      clearAll: () =>
        set((s) => {
          s.records = [];
        }),
    })),
    {
      name: 'open-cfmoto-ble-auth',
      storage: mmkvStorage,
    },
  ),
);

