# Test Coverage — open-cfmoto

Last updated: 2026-03-14

---

## packages/ble-protocol

Pure TypeScript, zero React Native deps. Run: `pnpm --filter @open-cfmoto/ble-protocol test`

| File | Test file | Coverage |
|------|-----------|----------|
| `src/codec.ts` | `__tests__/codec.test.ts` | `buildFrame`/`parseFrame` round-trips, CRC correctness, header/end byte validation, invalid frame rejection |
| `src/auth.ts` | `__tests__/auth.test.ts` | `NotImplementedError` thrown by `step1`/`step2`, error message content |
| `src/keepalive.ts` | `__tests__/keepalive.test.ts` | Heartbeat at 2 s interval, 4 s watchdog fires on no ACK, `notifyAck()` resets watchdog, `stop()` clears all timers |
| `src/response-router.ts` | `__tests__/response-router.test.ts` | Frame dispatch by control code, handler registration/deregistration, invalid frames silently ignored |
| `src/commands/index.ts` | `__tests__/commands.test.ts` | All 7 builders produce valid frames with correct control codes; `findCar` covers all 3 modes; `setIndicators` covers all 3 sides; `setUnits` covers both systems; `setSpeedLimit` boundary values (0, 120, 255); `RangeError` for 256 and −1; `heartbeat` payload decodes to `ping=1` |

**Total: 55 tests across 5 suites — all passing.**

### Not yet tested

| File | Reason |
|------|--------|
| `src/cfmoto450.ts` | Requires mock BLE transport wiring (Block 3 scope) |
| `src/mock/mock-protocol.ts` | Used for integration / Storybook, not unit-tested |
| `src/generated/meter.ts` | Generated file — not tested directly |

---

## apps/mobile

Zustand store unit tests. No React Native renderer required. Run: `cd apps/mobile && pnpm test`

| File | Test file | Coverage |
|------|-----------|----------|
| `src/stores/bike.store.ts` | `src/__tests__/bike-store.test.ts` | `lastHeartbeatAck` updates on `recordHeartbeatAck()`; `commandHistory` FIFO cap at 20; `recordCommandSent` fields; `recordCommandAcked` targets most-recent unacked; already-acked entries not overwritten |
| `src/stores/settings.store.ts` | `src/__tests__/settings-store.test.ts` | Default values; `setUnits`/`setSpeedLimit`/`setLastConnectedDevice` update state and persist to MMKV; `lastConnectedDeviceId` available synchronously; `useMockBike` stays in-memory (not persisted) |

**Jest config:** `ts-jest` + Node environment + inline tsconfig (`moduleResolution: node`) to avoid Expo's `bundler` resolution in Jest context.
**MMKV mock:** per-instance `Map` at `__mocks__/react-native-mmkv.ts` — no filesystem I/O in tests.

### Not yet tested

| File | Reason |
|------|--------|
| `src/services/ble.service.ts` | Integration layer — requires BLE hardware mock |
| `src/services/ble-transport.adapter.ts` | React Native adapter — requires `react-native-ble-plx` mock |
| `src/db/schema.ts` | SQLite — requires `expo-sqlite` mock |
| Screen components | UI tests deferred — Storybook setup pending |
