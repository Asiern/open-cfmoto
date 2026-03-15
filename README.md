# open-cfmoto

Open-source alternative to the CFMoto Ride Android app (`com.cfmoto.cfmotointernational`).

Targets **CFMoto 450 series** (MT / SR / NK). MVP: BLE bike control + GPS trip recording.

> **Status:** BLE protocol layer complete and tested. Auth stub pending cloud API keys.
> Hardware validation in progress — see [`docs/hardware-validation.md`](docs/hardware-validation.md).

---

## Architecture

```
react-native-ble-plx
  └─ RNBleTransport          (apps/mobile/src/services/ble-transport.adapter.ts)
       └─ CFMoto450Protocol  (packages/ble-protocol/src/cfmoto450.ts)
            ├─ KeepAliveManager   2s heartbeat, 4s watchdog
            ├─ ResponseRouter     dispatches incoming frames by control code
            └─ AuthFlow           AES-256/ECB challenge-response (stub)
  └─ BleService              (apps/mobile/src/services/ble.service.ts)
       └─ Zustand stores     bike.store, settings.store
            └─ React hooks   useCFMoto, useBikeCommands, useHeartbeat, useRideRecording
```

**BLE is control-only.** Speed, RPM, and other telemetry come from the CFMoto cloud
API over MQTT (`VehicleNowInfoResp`), not from BLE. See [`docs/protocol.md`](docs/protocol.md).

---

## Installation

**Prerequisites:** Node 20+, pnpm 9+, Android SDK (for device builds).

```bash
git clone https://github.com/<you>/open-cfmoto
cd open-cfmoto
pnpm install
```

### Run tests (no hardware required)

```bash
pnpm test                                        # all packages
pnpm --filter @open-cfmoto/ble-protocol test     # protocol layer only
cd apps/mobile && pnpm test                      # mobile app + integration
```

### Run documentation site

```bash
pnpm docs:dev
```

Build static docs:

```bash
pnpm docs:build
```

### Build the mobile app (requires EAS account)

```bash
cd apps/mobile
eas build --platform android --profile development   # custom dev client APK
```

Connect a physical Android device (BLE requires real hardware — no emulator).

---

## API Reference

All hooks require `<CFMotoProvider>` in the React tree unless noted.

### `useCFMoto()`

```ts
const { connect, disconnect, connectionState, isConnected } = useCFMoto();

await connect('AA:BB:CC:DD:EE:FF', 'MT450 NK');
disconnect();
// connectionState: 'disconnected' | 'connecting' | 'connected' | 'scanning' | 'error'
```

### `useBikeCommands()`

```ts
const { lock, unlock, findCar, setIndicators, setUnits, setSpeedLimit } = useBikeCommands();

await findCar('horn');               // 'horn' | 'flash' | 'light'
await setIndicators('left');         // 'left' | 'right' | 'off'
await setUnits('metric');            // 'metric' | 'imperial'
await setSpeedLimit(100);            // 0–255 km/h (RangeError outside bounds)
await lock(encryptedPayload);        // requires cloud auth key
await unlock(encryptedPayload);
```

All commands throw `'No active BLE connection'` if `connectionState !== 'connected'`.

### `useHeartbeat()`

```ts
const { isAlive, lastAck } = useHeartbeat();
// isAlive: true if ACK received within last 6s (2s interval + 4s watchdog)
// lastAck: timestamp (ms) of last received ACK, or null
```

### `useRideRecording()`

```ts
const { isRecording, finalizeTrip } = useRideRecording();
// Recording starts automatically on connect, stops on disconnect.
// finalizeTrip() returns TripSummary | null and persists to MMKV.
```

### `useSettings()`

```ts
// Does NOT require <CFMotoProvider>
const { units, speedLimit, lastConnectedDevice, setUnits, setSpeedLimit } = useSettings();
```

---

## Known Limitations

| Limitation | Detail |
|---|---|
| No live telemetry over BLE | Speed/RPM/fuel come from cloud MQTT, not BLE |
| Auth not implemented | `AuthFlow` throws `NotImplementedError` — needs cloud API key from `VehicleNowInfoResp.encryptInfo` |
| Lock/unlock payload | Requires AES-256 encrypted payload from cloud — cannot be computed offline |
| iOS not tested | BLE permission path is wired; hardware validation pending |
| Keep-alive ACK code | `0xEC` vs `0xE7` TBD from live traffic — see hardware-validation.md §1 |

---

## Monorepo structure

```
packages/ble-protocol/   Pure TypeScript — codec, auth, keepalive, commands, router
apps/mobile/             Expo app (custom dev client) — screens, hooks, stores, services
apps/docs/               Docusaurus docs site (packages docs + RE findings + project notes)
tools/apk-analysis/      RE tooling: jadx output, btsnoop scripts, findings docs
docs/                    Protocol findings, test coverage, hardware validation
```

---

## Protocol

The BLE protocol was reverse-engineered from `com.cfmoto.cfmotointernational` via `jadx`
static analysis and HCI snoop log capture. All confirmed values are in
[`docs/protocol.md`](docs/protocol.md) and annotated in the source with `// CONFIRMED`.

**Frame format:**
```
[0xAB, 0xCD, controlCode, lenLo, lenHi, ...protobufPayload, crc_sum_mod256, 0xCF]
```
CRC is byte-addition sum of bytes[2..end-2] mod 256. Payload is Protocol Buffers
(`com.cfmoto.proto.Meter.*`).

---

## Contributing

Run `pnpm typecheck && pnpm test` before opening a PR. The ble-protocol package has
zero React Native dependencies and runs in plain Node — no device needed for protocol work.
