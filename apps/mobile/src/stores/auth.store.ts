import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

export const authStorage = new MMKV({ id: 'open-cfmoto-auth' });

const mmkvStorage = createJSONStorage(() => ({
  getItem: (key: string): string | null => authStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    authStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    authStorage.delete(key);
  },
}));

interface AuthState {
  token: string | null;
  userId: string | null;
  idcard: string | null;
  setSession: (session: { token: string; userId: string | null; idcard: string | null }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set) => ({
      token: null,
      userId: null,
      idcard: null,
      setSession: ({ token, userId, idcard }) =>
        set((s) => {
          s.token = token;
          s.userId = userId;
          s.idcard = idcard;
        }),
      clearSession: () =>
        set((s) => {
          s.token = null;
          s.userId = null;
          s.idcard = null;
        }),
    })),
    {
      name: 'open-cfmoto-auth',
      storage: mmkvStorage,
    },
  ),
);

