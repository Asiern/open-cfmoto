# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Open-source alternative to the CFMoto Ride Android app (com.cfmoto.cfmotointernational). Targets CFMoto 450 series (MT/SR/NK). MVP: BLE bike connection + GPS trip recording. The BLE protocol has been reverse-engineered from the APK — core values in `packages/ble-protocol/` are now **CONFIRMED** from static analysis of `jadx` decompilation and dynamic MitM capture. See `tools/apk-analysis/findings/` and `docs/cloud-auth.md` for full documentation.

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
packages/cloud-client/   Pure TypeScript cloud API client (login, vehicle lookup, signing)
apps/mobile/             Expo app (custom dev client), React Native
tools/apk-analysis/      RE tooling: jadx output, btsnoop logs, Burp exports, findings docs
docs/                    Protocol docs: cloud-auth.md, auth-protocol.md, protocol.md
```

### Data Flow

```
CloudAuthClient (packages/cloud-client/)
  → login() + getEncryptInfo(vehicleId)   # fetches encryptValue + key from cloud
  ↓
react-native-ble-plx
  → RNBleTransport (apps/mobile/src/services/ble-transport.adapter.ts)
  → CFMoto450Protocol (packages/ble-protocol/) ← cloudCredentials passed here
  → bleService singleton  (apps/mobile/src/services/ble.service.ts)
  → Zustand stores  (bike.store, ride.store, settings.store)
  → React screens via hooks
```

The `BleTransport` interface in `packages/ble-protocol/src/types.ts` is the seam between hardware and protocol. `RNBleTransport` implements it with `react-native-ble-plx`; `MockBleTransport`/`MockBikeProtocol` implement it with synthetic data. `bleService.initialize(useMock)` selects which path to use — `RNBleTransport` is lazily `require()`d so mock mode works without BLE hardware.

`CFMoto450Protocol.connect(peripheralId, cloudCredentials?)` — when `cloudCredentials` are provided it calls `CloudAuthClient.login()` → `VehicleClient.getEncryptInfo()` → BLE auth (0x5A–0x5D). Without credentials it skips auth (dev/mock mode, logs a warning).

### Key Files

- `packages/ble-protocol/src/types.ts` — All core interfaces (`BikeData`, `BleTransport`, `IBikeProtocol`). Lock these down before changing anything else.
- `packages/ble-protocol/src/uuids.ts` — Single source of truth for GATT UUIDs. Values updated with **CONFIRMED** UUIDs from APK RE.
- `packages/ble-protocol/src/codec.ts` — Packet encode/decode. **Confirmed format**: `[0xAB, 0xCD, controlCode, lenLo, lenHi, ...protobuf_payload, checksum_byte_sum, 0xCF]`. Checksum is byte-addition sum (NOT XOR) of bytes[2..end-2]. Payload is Protocol Buffers.
- `packages/cloud-client/src/config.ts` — Cloud API constants: base URL, all endpoints, hardcoded APPID/APPSECRET from APK.
- `packages/cloud-client/src/auth.ts` — `CloudAuthClient`: login, token storage, refresh stub.
- `packages/cloud-client/src/vehicle.ts` — `VehicleClient`: `getVehicleDetail()`, `getEncryptInfo()`, `getVehicles()`.
- `packages/cloud-client/src/user.ts` — `UserClient`: `getProfile()`, `updateProfile()`, `updateAreaNo()`.
- `packages/cloud-client/src/account.ts` — `AccountClient`: `register()`, `sendCode()`, `checkCode()`, `updatePassword()`. Passwords MD5-hashed before send, never persisted.
- `packages/cloud-client/src/ride.ts` — `RideClient`: `listRides()`, `getRide()`, `deleteRide()`.
- `packages/cloud-client/src/signing.ts` — Request signing: `MD5(SHA1(body + params + APPSECRET))`.
- `apps/mobile/metro.config.js` — Critical monorepo Metro config (`watchFolders` + `nodeModulesPaths`). Breaking this means nothing builds.
- `apps/mobile/src/services/ble.service.ts` — BLE singleton that bridges protocol → Zustand stores.
- `apps/mobile/src/services/cloud-auth.service.ts` — Mobile-side cloud auth integration.

### SQLite Schema

Two tables: `trips` (summary row + GeoJSON LineString in `route_geojson` for map rendering without joins) and `trip_telemetry` (raw per-second samples for stats/charts). WAL mode enabled. See `apps/mobile/src/db/schema.ts`.

### Confirmed BLE Protocol (450-series / TBox)

All values confirmed from `jadx` decompilation of `com.cfmoto.cfmotointernational`. Full docs in `tools/apk-analysis/findings/`.

**GATT UUIDs** (source: `BleConstant.java`):
- Service: `0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC`
- Write characteristic: `0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC`
- Notify characteristic: `0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC`

**Frame format** (source: `TboxMessageFrame.java`, `TBoxCrcFrame.java`, `TboxFrameDecoder.java`):
```
[0xAB, 0xCD, controlCode, lenLo, lenHi, ...protobufPayload, crc, 0xCF]
```
- Header: `0xAB 0xCD` (NOT `0xAA`)
- CRC: byte-addition sum of bytes[2..end-2], truncated to 8 bits (NOT XOR)
- Payload: Protocol Buffers (`com.cfmoto.proto.Meter.*`)
- MTU: 185 bytes

**Key control codes** (source: `TboxControlCode.java`):
| Hex | Description |
|-----|-------------|
| `0x5A` | Auth step 1: send encrypted auth package |
| `0x5B` | Auth step 1 response: bike random number |
| `0x5C` | Auth step 2: send decrypted random number |
| `0x5D` | Auth result (0 = success) |
| `0x67` | Lock/unlock/power-on/power-off + heartbeat |
| `0x6A` | Find car (flash/horn/headlight) |
| `0x6B` | Turn signal control |
| `0x6C` | Keep-alive |
| `0x68` | Preferences (max speed limit) |
| `0x69` | Display units settings |
| `0x71` | Charge configuration |
| `0x79` | KL15 (ignition) |

**Authentication** (source: `BleModel.java`, `AES256EncryptionUtil.java`):
3-step challenge-response: App→Bike `AuthPackage` (0x5A) → Bike→App random challenge (0x5B) → App decrypts with AES-256/ECB/PKCS7 (BouncyCastle) using server-supplied key → App→Bike `RandomNum` (0x5C) → Bike confirms (0x5D). Keys (`encryptValue`, `key`) come from cloud API endpoint `GET /fuel-vehicle/servervehicle/app/vehicle?vehicleId=<id>` → `data.encryptInfo`.

**Connection sequence**: Scan by MAC → GATT connect → enable notify → set MTU 185 → auth (3 steps) → keep-alive every 2s (4s timeout). Auto-unlock triggers at RSSI > -70 dBm.

### Confirmed Cloud API (tapi-flkf.cfmoto-oversea.com)

Full docs in `docs/cloud-auth.md`. Key facts for implementation:

- **No certificate pinning** — TrustManager accepts everything, MitM works out of the box.
- **Base URL**: `https://tapi.cfmoto-oversea.com/v1.0/` (regional subdomain determined at login, e.g. `tapi-flkf.cfmoto-oversea.com` for EU).
- **Login**: `POST /fuel-user/serveruser/app/auth/user/login_by_idcard` — `password` as MD5 hex, token in `data.tokenInfo.accessToken`, TTL ≈ 100 days.
- **BLE keys**: `GET /fuel-vehicle/servervehicle/app/vehicle?vehicleId=<id>` → `data.encryptInfo.{encryptValue, key, iv}`.
- **Vehicle list**: `GET /fuel-vehicle/servervehicle/app/vehicle/mine?position=2` → `data[]` (position=2 returns full garage, confirmed in `VehicleGarageActivity.java`).
- **User profile**: `GET /fuel-user/serveruser/app/auth/user/user_info` → `UserProfile`. Update via `PUT /update_info`.
- **Account creation**: `POST /register`, `POST /common/code/send_code`, `POST /common/code/check_code`, `POST /update_password`.
- **Ride history**: `GET /ridehistory/list_v2?vehicleId=&pageStart=&pageSize=` → `RideHistoryItem[]`. Detail: `GET /ridehistory?id=&month=`. Delete: `DELETE /ridehistory/{id}`.
- **Request signing** (every request): `MD5(SHA1(body + "appId=rRrIs3ID&nonce=<16chars>&timestamp=<ms>" + APPSECRET))` — credentials hardcoded in APK (`APPID=rRrIs3ID`, `APPSECRET=6c1936f85ecb23508c02ceb7a6e3fd0e33eb8bd2`).
- **Headers**: `Authorization: Bearer <token>`, `user_id`, `lang`, `ZoneId`, `Cfmoto-X-Sign`, `Cfmoto-X-Param`, `Cfmoto-X-Sign-Type: 0`, `appId`, `nonce`, `signature`, `timestamp`.

### Reverse Engineering Workflow

Discovered protocol info goes in `tools/apk-analysis/findings/` (living docs) **and** must be reflected in `packages/ble-protocol/src/uuids.ts` and `codec.ts`. Cloud API findings go in `docs/cloud-auth.md`.

Static analysis:
```bash
jadx -d tools/apk-analysis/jadx-output/ --deobf tools/apk-analysis/apk/<apk>
tools/apk-analysis/scripts/extract-uuids.sh   # grep UUIDs from jadx output
```

Dynamic HTTP MitM (no cert pinning — plain mitmproxy/Burp works):
- Configure Android WiFi proxy → mitmproxy/Burp on port 8080.
- No Frida or APK patch needed. Works on Android 14 (TrustManager bypass in APK).
- Export Burp history as XML → `tools/apk-analysis/mitm-logs/` (gitignored, sanitize before commit).
- If app ignores system proxy: use `tools/apk-analysis/frida/burp-override.js` to force it.

Dynamic BLE sniffing: enable HCI snoop log on device, run OEM app, `adb pull /data/misc/bluetooth/logs/btsnoop_hci.log`, open in Wireshark or run `tools/apk-analysis/scripts/decode-btsnoop.py`.

Drop APK in `tools/apk-analysis/apk/` (gitignored). jadx output, snoop logs, and mitm-logs are also gitignored.

### Android Requirements

- minSdk 24 (Android 7). Configured via `expo-build-properties` plugin in `app.json`.
- `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission required (Android 12+) to maintain BLE in background. Already declared in `app.json`.
- BLE runtime permissions differ by API level — see `apps/mobile/src/utils/permissions.ts`.
- Custom dev client required (not Expo Go) because of native BLE/maps/MMKV modules.
