# `@open-cfmoto/mobile`

Expo React Native app that consumes `ble-protocol` and `cloud-client`.

## Scope

- BLE connection lifecycle and command dispatch
- User-facing controls (lock/find car/settings)
- Trip recording and persistence
- Hook-based public API over provider/store layers

## Key paths

- App routes: `apps/mobile/app`
- Hooks: `apps/mobile/src/hooks`
- Provider: `apps/mobile/src/providers/CFMotoProvider.tsx`
- Services: `apps/mobile/src/services`
- Tests: `apps/mobile/src/__tests__`

## Integration model

- App layer builds user intent.
- BLE package builds protocol frames.
- Service writes bytes to BLE characteristic.
- Router + store update local state from responses.

