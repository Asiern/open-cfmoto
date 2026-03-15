import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { LoginArea } from '@open-cfmoto/cloud-client';

const regionStorage = new MMKV({ id: 'open-cfmoto-region' });

const mmkvStorage = createJSONStorage(() => ({
  getItem: (key: string): string | null => regionStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    regionStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    regionStorage.delete(key);
  },
}));

interface RegionState {
  available: LoginArea[];
  selected: LoginArea | null;
  setAvailable: (areas: LoginArea[]) => void;
  setSelected: (area: LoginArea | null) => void;
}

export const useRegionStore = create<RegionState>()(
  persist(
    (set) => ({
      available: [],
      selected: null,
      setAvailable: (areas) =>
        set(() => ({
          available: areas,
        })),
      setSelected: (area) =>
        set(() => ({
          selected: area,
        })),
    }),
    {
      name: 'open-cfmoto-region',
      storage: mmkvStorage,
      partialize: (state) => ({
        selected: state.selected,
      }),
    },
  ),
);
