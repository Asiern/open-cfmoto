# Test Coverage — open-cfmoto

Last updated: 2026-03-14

---

## packages/cloud-client

Run: `pnpm --filter @open-cfmoto/cloud-client test`

75 tests total across 6 suites.

| File | Test file | Tests | Coverage |
|------|-----------|-------|----------|
| `src/signing.ts` | `src/__tests__/signing.test.ts` | 5 | MD5(SHA1) signature vector, nonce length/randomness, timestamp in unix ms, required headers, GET query signing (sorted + URL-encoded) |
| `src/auth.ts` | `src/__tests__/auth.test.ts` | 5 | Successful login token extraction, invalid credentials → `CloudAuthError`, `getToken()` pre-login null, login payload shape, MD5 password normalization |
| `src/vehicle.ts` | `src/__tests__/vehicle.test.ts` | 22 | `getEncryptInfo` parsing + errors, `getVehicleDetail` full data + virtual vehicle (no encryptInfo), signed headers, `getVehicles` position=2, `getUserVehicles` success + malformed response |
| `src/user.ts` | `src/__tests__/user.test.ts` | 13 | `getProfile` success + HTTP/API errors + invalid JSON, `updateProfile` body content + PUT method, `updateAreaNo` body + POST method + success=false |
| `src/account.ts` | `src/__tests__/account.test.ts` | 21 | `register` token extraction + MD5 password assertion + idcardType detection + missing-token error, `sendCode`/`checkCode` void + error paths, `updatePassword` both passwords MD5'd + Authorization header |
| `src/ride.ts` | `src/__tests__/ride.test.ts` | 19 | `listRides` pagination defaults (pageStart=1, pageSize=20) + optional filters in URL + empty list + data-not-array guard, `getRide` detail fields + id as query param (not path) + invalid JSON, `deleteRide` DELETE method + id in path + success=false |

Status: complete unit coverage for all implemented API surface. All 75 tests passing.

---

## packages/ble-protocol

Run: `pnpm --filter @open-cfmoto/ble-protocol test`

| File | Test file | Coverage |
|------|-----------|----------|
| `src/codec.ts` | `__tests__/codec.test.ts` | frame build/parse round-trips, CRC, header/end validation, invalid frame rejection |
| `src/auth.ts` | `__tests__/auth.test.ts` | full auth handshake behavior (0x5A -> 0x5B -> 0x5C -> 0x5D), success/failure paths, timeout paths, AES-256/ECB/PKCS7 round-trip helper validation |
| `src/keepalive.ts` | `__tests__/keepalive.test.ts` | 2s heartbeat interval, 4s watchdog timeout, `notifyAck()` watchdog reset, `stop()` timer cleanup |
| `src/response-router.ts` | `__tests__/response-router.test.ts` | dispatch by control code, handler register/unregister, invalid frames ignored |
| `src/commands/index.ts` | `__tests__/commands.test.ts` | command builders for lock/unlock/find-car/indicators/units/speed-limit + boundary checks |
| `src/cfmoto450.ts` | `src/__tests__/cfmoto450.test.ts` | cloud connect flow ordering (`login -> getEncryptInfo -> authenticate`), no-credentials dev mode, error propagation on login/encryptInfo failures |

Status: protocol unit coverage includes cloud-auth integration flow at connect-time.

---

## apps/mobile

Run: `cd apps/mobile && pnpm test`

| File | Test file | Coverage |
|------|-----------|----------|
| `src/stores/bike.store.ts` | `src/__tests__/bike-store.test.ts` | heartbeat ack state, command history FIFO + ack marking |
| `src/stores/settings.store.ts` | `src/__tests__/settings-store.test.ts` | defaults, MMKV persistence, non-persisted `useMockBike` |
| `src/providers/CFMotoProvider.tsx` | `src/__tests__/provider.test.tsx` | Android permission/init flow, iOS init path, cleanup destroy |
| `src/hooks/index.ts` | `src/__tests__/hooks.test.ts` | connect helpers, connection guards, command send helpers, heartbeat derived state, ride summary persistence |
| `src/services/ble.service.ts` + protocol integration | `src/__tests__/integration/ble-service.test.ts` | connect order, subscribe/write wiring, MTU request, disconnect cleanup, reconnect behavior, keepalive manager behavior (tested directly; protocol wiring pending) |

---

## Hardware-pending validation

Still requires real bike + real cloud-linked vehicle:

- Cloud `encryptInfo` populated with real VIN-linked vehicle (`vehicleId != -1`)
- End-to-end auth against TBox with real `encryptValue` + `key`
- Keep-alive ACK code confirmation on hardware (`0xEC` vs potential fallback observations)
- Lock/unlock encrypted payload acceptance by real TBox
- MotoPlay boundary confirmation vs cloud telemetry path

See: `docs/hardware-validation.md`.
