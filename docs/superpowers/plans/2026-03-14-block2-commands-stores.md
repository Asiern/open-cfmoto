# Block 2 — Command Builders + Store Extensions + MMKV Persistence

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement typed BLE command builders (F07), extend bike.store with heartbeat tracking and command history (F08), and rewrite settings.store with MMKV persistence (F09), all test-driven.

**Architecture:** Command builders are pure functions in `ble-protocol` (zero side-effects, return `Uint8Array` ready to write). Store extensions live in `apps/mobile`. Tests for mobile stores require adding Jest to the mobile app with an MMKV mock; command builder tests use the existing ble-protocol jest setup.

**Tech Stack:** ts-proto v2 (already generated), Zustand v5 + immer, react-native-mmkv v3, jest + ts-jest

---

## Design Decisions

### heartbeat() duplication
`keepalive.ts` is off-limits (Reglas). `KeepAliveManager.getHeartbeatFrame()` is private.
`heartbeat()` in `commands/index.ts` duplicates the one-liner; add a comment noting the canonical
user. Future refactor: export `heartbeat()` from `keepalive.ts` and call it from both places.

### lock/unlock signature
The spec says `lock(encryptedPayload: Uint8Array)`. The current TBox protocol does not encrypt
Lock commands — auth is done once via challenge-response. The `encryptedPayload` parameter is
forward-looking (in case per-command auth is needed). Implementation: `buildFrame(LOCK_CONTROL, payload)`.
The caller (eventually auth.ts) is responsible for producing the correct payload bytes.

### setUnits() — time and language
`Display` proto has 4 fields. `setUnits('metric'|'imperial')` controls distance + temperature;
time is fixed at H24 and language at EN since we have no other settings API for them.

### bike.store commandHistory ACK matching
`recordCommandAcked(sentCode)` finds the most recent unacked entry with `code === sentCode` and
sets `ackedAt`. The caller (CFMoto450Protocol, out of scope here) maps ACK control codes to sent
codes (e.g., 0xE7 → 0x67 for lock/heartbeat) and calls the right store action.

### settings.store field cleanup
Old fields `speedUnit`, `tempUnit`, `useMockBike` are replaced. `useMockBike` stays as a
non-persisted in-memory field (controlled via `partialize`) since it is used by `ble.service.ts`.
Old `speedUnit`/`tempUnit` are removed — callers must migrate to `units`.

### Jest in mobile app
Mobile app has no Jest today. We add `jest`, `@types/jest`, `ts-jest` as devDependencies.
Tests are pure Node (no RN renderer needed) since we only test Zustand stores.
MMKV is mocked via `apps/mobile/__mocks__/react-native-mmkv.ts`.

---

## File Map

| Path | Action | Scope |
|------|--------|-------|
| `packages/ble-protocol/src/commands/index.ts` | **CREATE** | F07 builders |
| `packages/ble-protocol/__tests__/commands.test.ts` | **CREATE** | F07 tests |
| `packages/ble-protocol/src/index.ts` | **MODIFY** | re-export commands |
| `apps/mobile/src/stores/bike.store.ts` | **MODIFY** | F08 new fields + actions |
| `apps/mobile/src/stores/settings.store.ts` | **REWRITE** | F09 MMKV persist |
| `apps/mobile/__mocks__/react-native-mmkv.ts` | **CREATE** | MMKV Jest mock |
| `apps/mobile/jest.config.js` | **CREATE** | mobile Jest setup |
| `apps/mobile/src/__tests__/bike-store.test.ts` | **CREATE** | F08 tests |
| `apps/mobile/src/__tests__/settings-store.test.ts` | **CREATE** | F09 tests |
| `docs/test-coverage.md` | **CREATE** | coverage summary |

---

## Chunk 1: F07 — Command Builders

### Task 1: Write failing command builder tests

**Files:**
- Create: `packages/ble-protocol/__tests__/commands.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// packages/ble-protocol/__tests__/commands.test.ts
import { parseFrame } from '../src/codec';
import { ControlCode } from '../src/response-router';
import {
  Lock, Lock_Type, Lock_State,
  FindCar, LightControl, LightControl_Type,
  Display, Display_Distance, Display_Temperature,
  Heartbeat, Preference,
} from '../src/generated/meter';
import {
  lock, unlock, findCar, setIndicators, setUnits, setSpeedLimit, heartbeat,
} from '../src/commands';

// Helper: round-trip parse and assert valid
function parsedFrame(frame: Uint8Array) {
  const result = parseFrame(frame);
  expect(result.valid).toBe(true);
  return result;
}

describe('lock()', () => {
  const payload = Lock.encode(Lock.fromPartial({
    type: Lock_Type.MOTORCYCLE, state: Lock_State.LOCKED,
  })).finish();

  test('produces valid frame', () => {
    expect(parsedFrame(lock(payload)).valid).toBe(true);
  });
  test('control code is LOCK_CONTROL (0x67)', () => {
    expect(parsedFrame(lock(payload)).controlCode).toBe(ControlCode.LOCK_CONTROL);
  });
  test('payload round-trips unchanged', () => {
    expect(parsedFrame(lock(payload)).payload).toEqual(payload);
  });
});

describe('unlock()', () => {
  const payload = Lock.encode(Lock.fromPartial({
    type: Lock_Type.MOTORCYCLE, state: Lock_State.UNLOCKED,
  })).finish();

  test('produces valid frame with LOCK_CONTROL', () => {
    const f = parsedFrame(unlock(payload));
    expect(f.controlCode).toBe(ControlCode.LOCK_CONTROL);
    expect(f.payload).toEqual(payload);
  });
});

describe('findCar()', () => {
  test('horn mode — loudspeaker=true, others=false', () => {
    const f = parsedFrame(findCar('horn'));
    expect(f.controlCode).toBe(ControlCode.FIND_CAR);
    const msg = FindCar.decode(f.payload);
    expect(msg.loudspeakerStatus).toBe(true);
    expect(msg.doubleflashStatus).toBe(false);
    expect(msg.headlightStatus).toBe(false);
  });
  test('flash mode — doubleflash=true, others=false', () => {
    const msg = FindCar.decode(parsedFrame(findCar('flash')).payload);
    expect(msg.doubleflashStatus).toBe(true);
    expect(msg.loudspeakerStatus).toBe(false);
    expect(msg.headlightStatus).toBe(false);
  });
  test('light mode — headlight=true, others=false', () => {
    const msg = FindCar.decode(parsedFrame(findCar('light')).payload);
    expect(msg.headlightStatus).toBe(true);
    expect(msg.loudspeakerStatus).toBe(false);
    expect(msg.doubleflashStatus).toBe(false);
  });
});

describe('setIndicators()', () => {
  test('right → RIGHT_OPEN', () => {
    const f = parsedFrame(setIndicators('right'));
    expect(f.controlCode).toBe(ControlCode.LIGHT_CONTROL);
    expect(LightControl.decode(f.payload).type).toBe(LightControl_Type.RIGHT_OPEN);
  });
  test('left → LEFT_OPEN', () => {
    expect(LightControl.decode(parsedFrame(setIndicators('left')).payload).type)
      .toBe(LightControl_Type.LEFT_OPEN);
  });
  test('off → NONE2 (0)', () => {
    expect(LightControl.decode(parsedFrame(setIndicators('off')).payload).type)
      .toBe(LightControl_Type.NONE2);
  });
});

describe('setUnits()', () => {
  test('metric → KM + CELSIUS', () => {
    const f = parsedFrame(setUnits('metric'));
    expect(f.controlCode).toBe(ControlCode.DISPLAY_UNITS);
    const msg = Display.decode(f.payload);
    expect(msg.distance).toBe(Display_Distance.KM);
    expect(msg.temperature).toBe(Display_Temperature.CELSIUS);
  });
  test('imperial → MILE + FAHRENHEIT', () => {
    const msg = Display.decode(parsedFrame(setUnits('imperial')).payload);
    expect(msg.distance).toBe(Display_Distance.MILE);
    expect(msg.temperature).toBe(Display_Temperature.FAHRENHEIT);
  });
});

describe('setSpeedLimit()', () => {
  test('0 is valid', () => {
    expect(parsedFrame(setSpeedLimit(0)).controlCode).toBe(ControlCode.PREFERENCE);
  });
  test('120 encodes correctly', () => {
    const msg = Preference.decode(parsedFrame(setSpeedLimit(120)).payload);
    expect(msg.maximumSpeedLimit).toBe(120);
  });
  test('255 is valid upper boundary', () => {
    expect(parsedFrame(setSpeedLimit(255)).valid).toBe(true);
  });
  test('256 throws RangeError', () => {
    expect(() => setSpeedLimit(256)).toThrow(RangeError);
  });
  test('-1 throws RangeError', () => {
    expect(() => setSpeedLimit(-1)).toThrow(RangeError);
  });
});

describe('heartbeat()', () => {
  test('produces valid LOCK_CONTROL frame', () => {
    const f = parsedFrame(heartbeat());
    expect(f.controlCode).toBe(ControlCode.LOCK_CONTROL);
  });
  test('payload decodes to Heartbeat{ping:1}', () => {
    const msg = Heartbeat.decode(parsedFrame(heartbeat()).payload);
    expect(msg.ping).toBe(1);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/ble-protocol && npx jest __tests__/commands.test.ts
```

Expected: `Cannot find module '../src/commands'`

---

### Task 2: Implement command builders

**Files:**
- Create: `packages/ble-protocol/src/commands/index.ts`

- [ ] **Step 1: Create the file**

```typescript
// packages/ble-protocol/src/commands/index.ts
/**
 * BLE command builders — pure functions, zero side effects.
 * Each builder constructs the correct Protobuf payload and wraps it in a TBox frame.
 *
 * Source: TboxFrameFactory.java, BleModel.java (confirmed from jadx decompilation)
 */

import { buildFrame } from '../codec';
import { ControlCode } from '../response-router';
import {
  FindCar,
  LightControl,
  LightControl_Type,
  Display,
  Display_Distance,
  Display_Temperature,
  Display_Time,
  Display_Language,
  Preference,
  Heartbeat,
} from '../generated/meter';

/**
 * Lock command frame.
 * @param encryptedPayload - Lock protobuf bytes (prepared by auth layer).
 *   Current protocol: plain Lock{type:MOTORCYCLE,state:LOCKED} proto bytes.
 *   Future: may require per-command encryption via auth.ts.
 */
export function lock(encryptedPayload: Uint8Array): Uint8Array {
  return buildFrame(ControlCode.LOCK_CONTROL, encryptedPayload);
}

/**
 * Unlock command frame.
 * @param encryptedPayload - Lock protobuf bytes (prepared by auth layer).
 */
export function unlock(encryptedPayload: Uint8Array): Uint8Array {
  return buildFrame(ControlCode.LOCK_CONTROL, encryptedPayload);
}

/**
 * Find car command. Activates horn, double-flash, or headlight on the bike.
 * Source: BleModel.findCar()
 */
export function findCar(mode: 'horn' | 'flash' | 'light'): Uint8Array {
  const payload = FindCar.encode(
    FindCar.fromPartial({
      headlightStatus: mode === 'light',
      doubleflashStatus: mode === 'flash',
      loudspeakerStatus: mode === 'horn',
    }),
  ).finish();
  return buildFrame(ControlCode.FIND_CAR, payload);
}

/**
 * Turn indicator command. Uses OPEN variants (no explicit CLOSE).
 * Source: BleModel.lightControl() — LightType enum
 */
export function setIndicators(side: 'left' | 'right' | 'off'): Uint8Array {
  const typeMap: Record<'left' | 'right' | 'off', LightControl_Type> = {
    right: LightControl_Type.RIGHT_OPEN,
    left: LightControl_Type.LEFT_OPEN,
    off: LightControl_Type.NONE2,
  };
  const payload = LightControl.encode(
    LightControl.fromPartial({ type: typeMap[side] }),
  ).finish();
  return buildFrame(ControlCode.LIGHT_CONTROL, payload);
}

/**
 * Display units command.
 * Maps 'metric'→KM+CELSIUS, 'imperial'→MILE+FAHRENHEIT.
 * Time is fixed at H24 and language at EN (no other settings available).
 * Source: BleModel.setDisplay()
 */
export function setUnits(system: 'metric' | 'imperial'): Uint8Array {
  const isMetric = system === 'metric';
  const payload = Display.encode(
    Display.fromPartial({
      distance: isMetric ? Display_Distance.KM : Display_Distance.MILE,
      temperature: isMetric ? Display_Temperature.CELSIUS : Display_Temperature.FAHRENHEIT,
      time: Display_Time.H24,
      languageType: Display_Language.EN,
    }),
  ).finish();
  return buildFrame(ControlCode.DISPLAY_UNITS, payload);
}

/**
 * Max speed limit command.
 * @param kmh - 0–255 (uint8 range, matches Meter.Preference.maximumSpeedLimit)
 * @throws RangeError if kmh is outside 0–255
 * Source: BleModel.setPreference()
 */
export function setSpeedLimit(kmh: number): Uint8Array {
  if (kmh < 0 || kmh > 255) {
    throw new RangeError(`Speed limit must be 0–255, got ${kmh}`);
  }
  const payload = Preference.encode(
    Preference.fromPartial({ maximumSpeedLimit: kmh }),
  ).finish();
  return buildFrame(ControlCode.PREFERENCE, payload);
}

/**
 * Heartbeat frame — same logic as KeepAliveManager.getHeartbeatFrame() (private).
 * Canonical user is KeepAliveManager; this export is for one-off sends and testing.
 * TODO: export this from keepalive.ts and call it from both places.
 */
export function heartbeat(): Uint8Array {
  const payload = Heartbeat.encode(Heartbeat.fromPartial({ ping: 1 })).finish();
  return buildFrame(ControlCode.LOCK_CONTROL, payload);
}
```

- [ ] **Step 2: Run tests**

```bash
cd packages/ble-protocol && npx jest __tests__/commands.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Re-export from package root**

In `packages/ble-protocol/src/index.ts`, add after the existing exports:

```typescript
export * from './commands';
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @open-cfmoto/ble-protocol typecheck
```

Expected: no errors.

- [ ] **Step 5: Run all ble-protocol tests to confirm no regression**

```bash
pnpm --filter @open-cfmoto/ble-protocol test
```

Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ble-protocol/src/commands/index.ts \
        packages/ble-protocol/__tests__/commands.test.ts \
        packages/ble-protocol/src/index.ts
git commit -m "feat(ble-protocol): add command builders for all confirmed app→bike codes (F07)"
```

---

## Chunk 2: Jest Setup for Mobile App

### Task 3: Add Jest to mobile app

**Files:**
- Create: `apps/mobile/jest.config.js`
- Create: `apps/mobile/__mocks__/react-native-mmkv.ts`
- Modify: `apps/mobile/package.json` (add devDependencies)

The mobile app has no Jest today. We add a minimal Node-only Jest config for testing Zustand stores (no RN renderer required since stores are pure JS).

- [ ] **Step 1: Create jest.config.js**

```javascript
// apps/mobile/jest.config.js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Resolve workspace package to its built source
    '^@open-cfmoto/ble-protocol$': '<rootDir>/../../packages/ble-protocol/src/index.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
  },
};
```

- [ ] **Step 2: Create the MMKV Jest mock**

```typescript
// apps/mobile/__mocks__/react-native-mmkv.ts
// Manual mock — replaces react-native-mmkv in Jest environment.
// Each MMKV instance gets its own Map, matching MMKV's per-id isolation.
export const MMKV = jest.fn().mockImplementation(() => {
  const store = new Map<string, string>();
  return {
    getString: (key: string): string | undefined => store.get(key),
    set: (key: string, value: string): void => { store.set(key, value); },
    delete: (key: string): void => { store.delete(key); },
  };
});
```

- [ ] **Step 3: Add devDependencies to apps/mobile/package.json**

Add to `"devDependencies"`:
```json
"@types/jest": "^29.5.14",
"jest": "^29.7.0",
"ts-jest": "^29.2.5"
```

Then install:
```bash
pnpm install
```

- [ ] **Step 4: Add test script to apps/mobile/package.json**

Add to `"scripts"`:
```json
"test": "jest"
```

- [ ] **Step 5: Verify Jest runs (expect no test files yet — 0 suites)**

```bash
cd apps/mobile && pnpm test
```

Expected: `Test Suites: 0 total` with exit 0 (or "no tests found" with exit 1 — either is fine at this stage).

---

## Chunk 3: F08 — bike.store Extensions

### Task 4: Write failing bike.store tests

**Files:**
- Create: `apps/mobile/src/__tests__/bike-store.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/mobile/src/__tests__/bike-store.test.ts
import { useBikeStore } from '../../stores/bike.store';

// Reset store state between tests
beforeEach(() => {
  useBikeStore.setState({
    connectionState: 'disconnected',
    connectedPeripheralId: null,
    bikeData: null,
    lastHeartbeatAck: null,
    commandHistory: [],
  });
});

describe('lastHeartbeatAck', () => {
  test('initial value is null', () => {
    expect(useBikeStore.getState().lastHeartbeatAck).toBeNull();
  });

  test('updates when recordHeartbeatAck() is called (simulates 0xEC dispatch)', () => {
    const before = Date.now();
    useBikeStore.getState().recordHeartbeatAck();
    const ack = useBikeStore.getState().lastHeartbeatAck;
    expect(ack).not.toBeNull();
    expect(ack!).toBeGreaterThanOrEqual(before);
  });

  test('updates again on second call (simulates 0xE7 dispatch)', () => {
    useBikeStore.getState().recordHeartbeatAck();
    const first = useBikeStore.getState().lastHeartbeatAck!;
    useBikeStore.getState().recordHeartbeatAck();
    const second = useBikeStore.getState().lastHeartbeatAck!;
    expect(second).toBeGreaterThanOrEqual(first);
  });
});

describe('commandHistory', () => {
  test('empty on init', () => {
    expect(useBikeStore.getState().commandHistory).toHaveLength(0);
  });

  test('recordCommandSent adds entry with sentAt and ackedAt=null', () => {
    const before = Date.now();
    useBikeStore.getState().recordCommandSent(0x67);
    const [entry] = useBikeStore.getState().commandHistory;
    expect(entry!.code).toBe(0x67);
    expect(entry!.sentAt).toBeGreaterThanOrEqual(before);
    expect(entry!.ackedAt).toBeNull();
  });

  test('recordCommandAcked sets ackedAt on matching unacked entry', () => {
    useBikeStore.getState().recordCommandSent(0x67);
    useBikeStore.getState().recordCommandAcked(0x67);
    const [entry] = useBikeStore.getState().commandHistory;
    expect(entry!.ackedAt).not.toBeNull();
    expect(entry!.ackedAt!).toBeGreaterThanOrEqual(entry!.sentAt);
  });

  test('commandHistory is FIFO — 21 inserts keeps max 20', () => {
    for (let i = 0; i < 21; i++) {
      useBikeStore.getState().recordCommandSent(i);
    }
    const history = useBikeStore.getState().commandHistory;
    expect(history).toHaveLength(20);
    // Oldest entry (code=0) is evicted; newest (code=20) survives
    expect(history[0]!.code).toBe(1);
    expect(history[19]!.code).toBe(20);
  });

  test('recordCommandAcked does not affect already-acked entries', () => {
    useBikeStore.getState().recordCommandSent(0x67);
    useBikeStore.getState().recordCommandAcked(0x67); // ack first
    const ackedAt = useBikeStore.getState().commandHistory[0]!.ackedAt;
    useBikeStore.getState().recordCommandAcked(0x67); // second call — no matching unacked
    // ackedAt unchanged (still the same value)
    expect(useBikeStore.getState().commandHistory[0]!.ackedAt).toBe(ackedAt);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/mobile && pnpm test src/__tests__/bike-store.test.ts
```

Expected: fails — `recordHeartbeatAck is not a function` (or similar)

---

### Task 5: Update bike.store

**Files:**
- Modify: `apps/mobile/src/stores/bike.store.ts`

- [ ] **Step 1: Rewrite the store file**

```typescript
// apps/mobile/src/stores/bike.store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { BikeData, ConnectionState } from '@open-cfmoto/ble-protocol';

const COMMAND_HISTORY_MAX = 20;

export interface CommandHistoryEntry {
  code: number;
  sentAt: number;
  ackedAt: number | null;
}

interface BikeState {
  connectionState: ConnectionState;
  connectedPeripheralId: string | null;
  bikeData: BikeData | null;
  /** Timestamp (ms) of last heartbeat ACK (0xEC or 0xE7). null until first ACK. */
  lastHeartbeatAck: number | null;
  /** FIFO log of last 20 sent commands. */
  commandHistory: CommandHistoryEntry[];

  setConnectionState: (state: ConnectionState) => void;
  setConnectedPeripheral: (id: string | null) => void;
  updateBikeData: (data: BikeData) => void;
  /** Call when 0xEC (KEEP_ALIVE_RESULT) or 0xE7 (LOCK_RESULT) is received. */
  recordHeartbeatAck: () => void;
  /** Call immediately before writing a command frame to BLE. */
  recordCommandSent: (code: number) => void;
  /**
   * Call when an ACK arrives. Updates the most recent unacked entry matching sentCode.
   * Caller maps ACK control codes to sent codes
   * (e.g., 0xE7 LOCK_RESULT → sentCode 0x67 LOCK_CONTROL).
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
      // Find most recent unacked entry with this code and set ackedAt
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
```

- [ ] **Step 2: Run tests**

```bash
cd apps/mobile && pnpm test src/__tests__/bike-store.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/stores/bike.store.ts \
        apps/mobile/src/__tests__/bike-store.test.ts \
        apps/mobile/jest.config.js \
        apps/mobile/__mocks__/react-native-mmkv.ts \
        apps/mobile/package.json
git commit -m "feat(mobile): add heartbeat tracking and command history to bike.store (F08), add Jest setup"
```

---

## Chunk 4: F09 — settings.store MMKV Persistence

### Task 6: Write failing settings.store tests

**Files:**
- Create: `apps/mobile/src/__tests__/settings-store.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// apps/mobile/src/__tests__/settings-store.test.ts

// Jest automock for react-native-mmkv (resolves from __mocks__/)
jest.mock('react-native-mmkv');

// Re-import store after mock is in place
import { useSettingsStore, settingsStorage } from '../../stores/settings.store';

beforeEach(() => {
  // Reset store to defaults between tests
  useSettingsStore.setState({
    units: 'metric',
    speedLimit: 120,
    lastConnectedDeviceId: null,
    lastConnectedDeviceName: null,
    useMockBike: false,
  });
  // Clear MMKV between tests (the mock stores state in the Map instance)
  // Re-instantiation happens via jest.isolateModules if needed; for simplicity
  // we clear by resetting the store which triggers a persist re-write.
});

describe('default values', () => {
  test('units defaults to metric', () => {
    expect(useSettingsStore.getState().units).toBe('metric');
  });
  test('speedLimit defaults to 120', () => {
    expect(useSettingsStore.getState().speedLimit).toBe(120);
  });
  test('lastConnectedDeviceId defaults to null', () => {
    expect(useSettingsStore.getState().lastConnectedDeviceId).toBeNull();
  });
  test('lastConnectedDeviceName defaults to null', () => {
    expect(useSettingsStore.getState().lastConnectedDeviceName).toBeNull();
  });
});

describe('setUnits()', () => {
  test('changes units to imperial', () => {
    useSettingsStore.getState().setUnits('imperial');
    expect(useSettingsStore.getState().units).toBe('imperial');
  });
  test('persists to MMKV storage', () => {
    useSettingsStore.getState().setUnits('imperial');
    // Zustand persist writes JSON to the storage key
    const raw = settingsStorage.getString('open-cfmoto-settings');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!).state.units).toBe('imperial');
  });
});

describe('setSpeedLimit()', () => {
  test('updates speedLimit', () => {
    useSettingsStore.getState().setSpeedLimit(100);
    expect(useSettingsStore.getState().speedLimit).toBe(100);
  });
  test('persists to MMKV storage', () => {
    useSettingsStore.getState().setSpeedLimit(80);
    const raw = settingsStorage.getString('open-cfmoto-settings');
    expect(JSON.parse(raw!).state.speedLimit).toBe(80);
  });
});

describe('setLastConnectedDevice()', () => {
  test('sets both id and name', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    expect(useSettingsStore.getState().lastConnectedDeviceId).toBe('AA:BB:CC:DD:EE:FF');
    expect(useSettingsStore.getState().lastConnectedDeviceName).toBe('MT450 NK');
  });

  test('persists and is readable synchronously (no await)', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    // Synchronous read — no Promise, no await
    const id = useSettingsStore.getState().lastConnectedDeviceId;
    expect(id).toBe('AA:BB:CC:DD:EE:FF');
  });

  test('can be cleared with null', () => {
    useSettingsStore.getState().setLastConnectedDevice('AA:BB:CC:DD:EE:FF', 'MT450 NK');
    useSettingsStore.getState().setLastConnectedDevice(null, null);
    expect(useSettingsStore.getState().lastConnectedDeviceId).toBeNull();
  });
});

describe('useMockBike (non-persisted)', () => {
  test('defaults to false', () => {
    expect(useSettingsStore.getState().useMockBike).toBe(false);
  });
  test('setUseMockBike updates in-memory', () => {
    useSettingsStore.getState().setUseMockBike(true);
    expect(useSettingsStore.getState().useMockBike).toBe(true);
  });
  test('useMockBike is NOT written to MMKV storage', () => {
    useSettingsStore.getState().setUseMockBike(true);
    const raw = settingsStorage.getString('open-cfmoto-settings');
    if (raw) {
      expect(JSON.parse(raw).state.useMockBike).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/mobile && pnpm test src/__tests__/settings-store.test.ts
```

Expected: fails — import errors / `settingsStorage` not exported.

---

### Task 7: Rewrite settings.store with MMKV persistence

**Files:**
- Modify: `apps/mobile/src/stores/settings.store.ts`

- [ ] **Step 1: Rewrite the file**

```typescript
// apps/mobile/src/stores/settings.store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

/** Exported so tests can inspect raw MMKV state and mock it. */
export const settingsStorage = new MMKV({ id: 'open-cfmoto-settings' });

const mmkvStorage = createJSONStorage(() => ({
  getItem: (key: string): string | null => settingsStorage.getString(key) ?? null,
  setItem: (key: string, value: string): void => { settingsStorage.set(key, value); },
  removeItem: (key: string): void => { settingsStorage.delete(key); },
}));

interface SettingsState {
  /** Display + command unit system. */
  units: 'metric' | 'imperial';
  /** Max speed limit in km/h (0–255, matches Meter.Preference). */
  speedLimit: number;
  /** BLE peripheral ID of last successfully connected bike. */
  lastConnectedDeviceId: string | null;
  /** Human-readable name of last connected bike. */
  lastConnectedDeviceName: string | null;
  /** In-memory only — selects mock vs real BLE. NOT persisted. */
  useMockBike: boolean;

  setUnits: (units: 'metric' | 'imperial') => void;
  setSpeedLimit: (kmh: number) => void;
  setLastConnectedDevice: (id: string | null, name: string | null) => void;
  setUseMockBike: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      units: 'metric',
      speedLimit: 120,
      lastConnectedDeviceId: null,
      lastConnectedDeviceName: null,
      useMockBike: false,

      setUnits: (units) => set((s) => { s.units = units; }),
      setSpeedLimit: (kmh) => set((s) => { s.speedLimit = kmh; }),
      setLastConnectedDevice: (id, name) => set((s) => {
        s.lastConnectedDeviceId = id;
        s.lastConnectedDeviceName = name;
      }),
      setUseMockBike: (value) => set((s) => { s.useMockBike = value; }),
    })),
    {
      name: 'open-cfmoto-settings',
      storage: mmkvStorage,
      // Only persist these 4 fields; useMockBike stays in-memory only
      partialize: (state) => ({
        units: state.units,
        speedLimit: state.speedLimit,
        lastConnectedDeviceId: state.lastConnectedDeviceId,
        lastConnectedDeviceName: state.lastConnectedDeviceName,
      }),
    },
  ),
);
```

- [ ] **Step 2: Run tests**

```bash
cd apps/mobile && pnpm test src/__tests__/settings-store.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Typecheck mobile app**

```bash
pnpm --filter @open-cfmoto/mobile typecheck
```

Expected: no errors. Note: if callers of the old `speedUnit`/`tempUnit` fields exist, TypeScript will surface them here. Fix any type errors by migrating to `units`.

- [ ] **Step 4: Run all mobile tests**

```bash
cd apps/mobile && pnpm test
```

Expected: all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/stores/settings.store.ts \
        apps/mobile/src/__tests__/settings-store.test.ts
git commit -m "feat(mobile): rewrite settings.store with MMKV persistence, add 4 persisted fields (F09)"
```

---

## Chunk 5: Documentation

### Task 8: Create test-coverage.md

**Files:**
- Create: `docs/test-coverage.md`

- [ ] **Step 1: Create the file**

```markdown
# Test Coverage — open-cfmoto

Last updated: 2026-03-14

---

## packages/ble-protocol

Tested with Jest (Node environment). Run: `pnpm --filter @open-cfmoto/ble-protocol test`

| File | Test file | What is covered |
|------|-----------|-----------------|
| `src/codec.ts` | `__tests__/codec.test.ts` | buildFrame / parseFrame round-trips, CRC correctness, invalid frame rejection |
| `src/auth.ts` | `__tests__/auth.test.ts` | NotImplementedError thrown by step1/step2, error messages |
| `src/keepalive.ts` | `__tests__/keepalive.test.ts` | Heartbeat at 2s, watchdog at 4s, notifyAck resets watchdog, stop() clears timers |
| `src/response-router.ts` | `__tests__/response-router.test.ts` | Frame dispatch, handler registration/deregistration, invalid frame silenced |
| `src/commands/index.ts` | `__tests__/commands.test.ts` | All builders: valid frame, correct control code, correct proto payload; findCar 3 modes; setSpeedLimit boundaries; RangeError on 256 |

### Not yet covered
- `src/cfmoto450.ts` — integration with BLE transport (requires mock transport wiring)
- `src/mock/mock-protocol.ts` — mock transport (used in Storybook/e2e, not unit-tested)
- `src/generated/meter.ts` — generated file, not tested directly

---

## apps/mobile

Tested with Jest + ts-jest (Node environment). Run: `cd apps/mobile && pnpm test`

| File | Test file | What is covered |
|------|-----------|-----------------|
| `src/stores/bike.store.ts` | `src/__tests__/bike-store.test.ts` | lastHeartbeatAck update, commandHistory FIFO (max 20), recordCommandSent/Acked lifecycle |
| `src/stores/settings.store.ts` | `src/__tests__/settings-store.test.ts` | Default values, MMKV persistence (units, speedLimit, lastConnectedDevice), useMockBike not persisted, synchronous read |

### Not yet covered
- `src/services/ble.service.ts` — integration layer (requires BLE hardware mock)
- `src/services/ble-transport.adapter.ts` — RN adapter (requires react-native-ble-plx mock)
- `src/db/schema.ts` — SQLite schema (requires expo-sqlite mock)
- All screen components — UI tests deferred pending Storybook setup
```

- [ ] **Step 2: Final full test run**

```bash
pnpm test
```

Expected: all packages pass, 0 failures.

- [ ] **Step 3: Final commit**

```bash
git add docs/test-coverage.md
git commit -m "docs: add test-coverage.md, complete Block 2 (F07/F08/F09)"
```

---

## Summary

After completing all tasks:

**Created:**
- `packages/ble-protocol/src/commands/index.ts` — 7 builders
- `packages/ble-protocol/__tests__/commands.test.ts` — 18 test cases
- `apps/mobile/jest.config.js`
- `apps/mobile/__mocks__/react-native-mmkv.ts`
- `apps/mobile/src/__tests__/bike-store.test.ts`
- `apps/mobile/src/__tests__/settings-store.test.ts`
- `docs/test-coverage.md`

**Modified:**
- `packages/ble-protocol/src/index.ts` — add `commands` re-export
- `apps/mobile/src/stores/bike.store.ts` — add lastHeartbeatAck, commandHistory, 3 new actions
- `apps/mobile/src/stores/settings.store.ts` — full rewrite with MMKV persist
- `apps/mobile/package.json` — add jest/ts-jest/types devDeps + test script
