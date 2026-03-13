# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Open-source alternative to the CFMoto Ride Android app (com.cfmoto.cfmotointernational). Targets CFMoto 450 series (MT/SR/NK). MVP: BLE bike connection + GPS trip recording. The BLE protocol (UUIDs, packet structures, commands) is being reverse-engineered from the APK — many values in `packages/ble-protocol/` are **UNCONFIRMED scaffolding**.

## Commands

All commands run from the repo root via Turborepo:

```bash
pnpm install                    # install all workspace deps
pnpm typecheck                  # typecheck all packages
pnpm test                       # run all tests
pnpm build                      # build all packages
pnpm lint                       # lint all packages

# Scoped to ble-protocol package (no RN required):
pnpm --filter @open-cfmoto/ble-protocol typecheck
pnpm --filter @open-cfmoto/ble-protocol test

# Run a single Jest test file:
cd packages/ble-protocol && npx jest __tests__/codec.test.ts

# Mobile dev (requires custom dev client built via EAS):
cd apps/mobile && pnpm start    # starts Metro bundler
cd apps/mobile && pnpm android  # run on connected Android device
```

EAS builds:
```bash
cd apps/mobile
eas build --platform android --profile development   # custom dev client APK
eas build --platform android --profile preview       # preview APK
```

## Architecture

### Monorepo Structure

```
packages/ble-protocol/   Pure TypeScript, zero RN deps — runs in Node/Jest
apps/mobile/             Expo app (custom dev client), React Native
tools/apk-analysis/      RE tooling: jadx output, btsnoop logs, findings docs
```

### BLE Data Flow

```
react-native-ble-plx
  → RNBleTransport (apps/mobile/src/services/ble-transport.adapter.ts)
  → CFMoto450Protocol / MockBikeProtocol  (packages/ble-protocol/)
  → bleService singleton  (apps/mobile/src/services/ble.service.ts)
  → Zustand stores  (bike.store, ride.store, settings.store)
  → React screens via hooks
```

The `BleTransport` interface in `packages/ble-protocol/src/types.ts` is the seam between hardware and protocol. `RNBleTransport` implements it with `react-native-ble-plx`; `MockBleTransport`/`MockBikeProtocol` implement it with synthetic data. `bleService.initialize(useMock)` selects which path to use — `RNBleTransport` is lazily `require()`d so mock mode works without BLE hardware.

### Key Files

- `packages/ble-protocol/src/types.ts` — All core interfaces (`BikeData`, `BleTransport`, `IBikeProtocol`). Lock these down before changing anything else.
- `packages/ble-protocol/src/uuids.ts` — Single source of truth for GATT UUIDs. **All values currently UNCONFIRMED** — update from RE findings.
- `packages/ble-protocol/src/codec.ts` — Packet encode/decode. Assumed structure: `[0xAA, msgType, len, ...payload, XOR_checksum]`. Verify via btsnoop.
- `apps/mobile/metro.config.js` — Critical monorepo Metro config (`watchFolders` + `nodeModulesPaths`). Breaking this means nothing builds.
- `apps/mobile/src/services/ble.service.ts` — BLE singleton that bridges protocol → Zustand stores.

### SQLite Schema

Two tables: `trips` (summary row + GeoJSON LineString in `route_geojson` for map rendering without joins) and `trip_telemetry` (raw per-second samples for stats/charts). WAL mode enabled. See `apps/mobile/src/db/schema.ts`.

### Reverse Engineering Workflow

Discovered protocol info goes in `tools/apk-analysis/findings/` (living docs) **and** must be reflected in `packages/ble-protocol/src/uuids.ts` and `codec.ts`.

Static analysis:
```bash
jadx -d tools/apk-analysis/jadx-output/ --deobf tools/apk-analysis/apk/<apk>
tools/apk-analysis/scripts/extract-uuids.sh   # grep UUIDs from jadx output
```

Dynamic BLE sniffing: enable HCI snoop log on device, run OEM app, `adb pull /data/misc/bluetooth/logs/btsnoop_hci.log`, open in Wireshark or run `tools/apk-analysis/scripts/decode-btsnoop.py`.

Drop APK in `tools/apk-analysis/apk/` (gitignored). jadx output and snoop logs are also gitignored.

### Android Requirements

- minSdk 24 (Android 7). Configured via `expo-build-properties` plugin in `app.json`.
- `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission required (Android 12+) to maintain BLE in background. Already declared in `app.json`.
- BLE runtime permissions differ by API level — see `apps/mobile/src/utils/permissions.ts`.
- Custom dev client required (not Expo Go) because of native BLE/maps/MMKV modules.
