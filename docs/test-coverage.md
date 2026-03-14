# Test Coverage — open-cfmoto

Last updated: 2026-03-14 (Block 4 — final state)

---

## packages/ble-protocol

Pure TypeScript, zero React Native deps. Run: `pnpm --filter @open-cfmoto/ble-protocol test`

| File | Test file | Coverage |
|------|-----------|----------|
| `src/codec.ts` | `__tests__/codec.test.ts` | `buildFrame`/`parseFrame` round-trips, CRC correctness, header/end byte validation, invalid frame rejection |
| `src/auth.ts` | `__tests__/auth.test.ts` | `NotImplementedError` thrown by `step1`/`step2`, error message content |
| `src/keepalive.ts` | `__tests__/keepalive.test.ts` | Heartbeat at 2 s interval, 4 s watchdog fires on no ACK, `notifyAck()` resets watchdog, `stop()` clears all timers |
| `src/response-router.ts` | `__tests__/response-router.test.ts` | Frame dispatch by control code, handler registration/deregistration, invalid frames silently ignored; all `ControlCode` values can be registered and dispatched |
| `src/commands/index.ts` | `__tests__/commands.test.ts` | All 6 builders produce valid frames with correct control codes; `findCar` covers all 3 modes; `setIndicators` covers all 3 sides; `setUnits` covers both systems; `setSpeedLimit` boundary values (0, 120, 255); `RangeError` for 256 and −1. `heartbeat()` removed — owned by `KeepAliveManager` |

**Total: ~54 tests across 5 suites — all passing.**

### Coverage type: unit
All suites run in plain Node (Jest, no hardware). Fake timers cover all timing logic.

### Not yet tested

| File | Reason |
|------|--------|
| `src/cfmoto450.ts` | Requires real BLE transport or full mock wiring — hardware validation scope |
| `src/mock/mock-protocol.ts` | Used for integration / Storybook, not unit-tested |
| `src/generated/meter.ts` | Generated file — not tested directly |

---

## apps/mobile

No React Native renderer required. Run: `cd apps/mobile && pnpm test`

| File | Test file | Coverage |
|------|-----------|----------|
| `src/stores/bike.store.ts` | `src/__tests__/bike-store.test.ts` | `lastHeartbeatAck` updates on `recordHeartbeatAck()`; `commandHistory` FIFO cap at 20; `recordCommandSent` fields; `recordCommandAcked` targets most-recent unacked; already-acked entries not overwritten |
| `src/stores/settings.store.ts` | `src/__tests__/settings-store.test.ts` | Default values; `setUnits`/`setSpeedLimit`/`setLastConnectedDevice` update state and persist to MMKV; `lastConnectedDeviceId` available synchronously; `useMockBike` stays in-memory (not persisted) |
| `src/providers/CFMotoProvider.tsx` | `src/__tests__/provider.test.tsx` | `requestBlePermissions` called on Android; `bleService.initialize()` called after granted; `onPermissionDenied` called on denial; iOS skips permission request and initializes directly; `bleService.destroy()` called on cleanup |
| `src/hooks/index.ts` | `src/__tests__/hooks.test.ts` | `connectAndPersist` updates settings store; `isConnected` derived from store; `checkConnected` throws on non-connected states; `sendBikeCommand` routes frame + records command; throws before sending if not connected; `calcIsAlive` boundary values (null, old, recent, exact threshold); `buildTripSummary` durationMs calculation; `persistTrip` writes correct JSON to MMKV |

| `src/services/ble.service.ts` + `src/cfmoto450.ts` | `src/__tests__/integration/ble-service.test.ts` | Connect sequence call order (connect→subscribe→requestMtu); CHAR_NOTIFY / CHAR_WRITE / MTU 185 verified; store transitions (connecting→connected→disconnected); sendCommand routes to CHAR_WRITE with correct characteristic; findCar frame carries control code 0x6A; disconnect resets store + calls transport.disconnect; no auto-reconnect; manual reconnect succeeds; KeepAliveManager watchdog integration (4s fires onDisconnect, notifyAck resets, heartbeat frame 0x67, onDisconnect drives bleService.disconnect) |

**Jest config:** `ts-jest` + Node environment + inline tsconfig (`moduleResolution: node`) + `.tsx` support.
**MMKV mock:** per-instance `Map` at `__mocks__/react-native-mmkv.ts` — no filesystem I/O in tests.
**bleService mock:** `jest.mock('../services/ble.service')` with `jest.fn()` spies in provider/hooks tests.
**Integration transport:** spy object injected directly (no `react-native-ble-plx` required).

**Total: ~70 tests across 8 suites — all passing.**

### Coverage type summary

| Suite | Type | What's real |
|-------|------|-------------|
| `ble-protocol` unit suites (5) | Unit | Full protocol logic |
| `apps/mobile` store/provider/hooks suites (4) | Unit | Store + hook helpers; bleService mocked |
| `apps/mobile` integration suite (1) | Integration | Real CFMoto450Protocol + real codec/commands; transport mocked |

### Requires hardware to validate

| Item | See |
|------|-----|
| Keep-alive ACK control code (`0xEC` vs `0xE7`) | `docs/hardware-validation.md` §1 |
| Lock/unlock AES-256 encrypted payload | `docs/hardware-validation.md` §2 |
| DISPLAY_UNITS enum values | `docs/hardware-validation.md` §3 |
| 100ms post-connect delay necessity | `docs/hardware-validation.md` §4 |
| MTU 185 negotiation grant | `docs/hardware-validation.md` §5 |
| TD-04 race condition (provider unmount during permission prompt) | `docs/hardware-validation.md` §6 |
| TD-05 stale closure in `useRideRecording` (reconnect scenario) | `docs/hardware-validation.md` §7 |
| TD-06 `recordCommandAcked` wiring (ACK code mapping) | `docs/hardware-validation.md` §8 |

### Not yet tested (deferred)

| File | Reason |
|------|--------|
| `src/services/ble-transport.adapter.ts` | React Native adapter — requires `react-native-ble-plx` mock |
| `src/db/schema.ts` | SQLite — requires `expo-sqlite` mock |
| Screen components | UI tests deferred — Storybook setup pending |
