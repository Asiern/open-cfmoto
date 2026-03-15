# `@open-cfmoto/ble-protocol`

Core BLE protocol package for CFMoto 450-series communication.

## Scope

- Frame codec (`0xAB 0xCD ... crc ... 0xCF`)
- Protobuf payload encode/decode (`Meter.*`)
- Control code routing and handlers
- Command builders (`lock`, `unlock`, `findCar`, `setIndicators`, etc.)
- Keepalive and auth flow state handling

## Key paths

- Source: `packages/ble-protocol/src`
- Protobuf source: `packages/ble-protocol/proto/meter.proto`
- Generated bindings: `packages/ble-protocol/src/generated/meter.ts`
- Tests: `packages/ble-protocol/__tests__`

## Typical development flow

1. Update protobuf (`proto/meter.proto`) from confirmed APK evidence.
2. Regenerate TS bindings (`pnpm --filter @open-cfmoto/ble-protocol proto:gen`).
3. Update command/auth callsites.
4. Add unit tests for frame control codes and payload decode behavior.

