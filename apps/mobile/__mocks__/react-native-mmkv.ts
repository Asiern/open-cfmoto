// apps/mobile/__mocks__/react-native-mmkv.ts
export const MMKV = jest.fn().mockImplementation(() => {
  const store = new Map<string, string>();
  return {
    getString: (key: string): string | undefined => store.get(key),
    set: (key: string, value: string): void => { store.set(key, value); },
    delete: (key: string): void => { store.delete(key); },
  };
});
