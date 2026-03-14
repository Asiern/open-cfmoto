# CFMoto MT450 BLE Protocol — Reverse Engineering Findings

> **Status**: Block 0 analysis — static analysis of `jadx` decompilation of `com.cfmoto.cfmotointernational`
> **Sources**: `com/cfmoto/ble/`, `com/cfmoto/proto/`, `com/cfmoto/oilmoto/`, `com/cfmoto/cfmotointernational/`
> **Scope**: MT450 series (NK/SR/MT) — gasoline TBox. Does NOT apply to HH40/youth electric bikes.

---

## 1. CRITICAL FINDING: BLE Does NOT Stream Telemetry

The MT450 TBox BLE interface is **control-only**. It does **not** send continuous telemetry
(speed, RPM, fuel level, gear, engine temperature) over BLE.

**Architecture reality:**
```
MT450 TBox (4G module)
    ↓ cellular
CFMoto cloud API
    ↓ MQTT or REST polling
App (VehicleNowInfoResp: speed, remainingOil, kl, deviceState, ...)
```

BLE is used exclusively for **proximity-based control**:
- Authenticate with the TBox
- Lock / unlock / power on / power off
- Find car (horn, flash, headlight)
- Light control (turn signals)
- Keep-alive (heartbeat)
- Settings (display units, speed limit, charge)
- Operate 4G module commands

Real-time telemetry fields available from the **cloud API** (not BLE):
- `speed` — current speed (String)
- `remainingOil` — remaining fuel (int)
- `remainingOilStr/Display` — fuel display string
- `kl` — KL15 / ignition state
- `fireVoltage` — ignition voltage
- `headLockState`, `oilLockState`, `seatLockState` — lock states
- `deviceState` — vehicle online/offline state
- `gsmRxLev` — 4G signal strength

> The `BluetoothOuterClass.Bluetooth` proto (speed, mileage, gear, motor temp, GPS) is used
> exclusively by `BleModelYouth` for **electric HH40 bikes** — it is NOT part of the MT450 protocol.

---

## 1.1 MotoPlay Clarification (Map/Projection vs Bike Telemetry)

From JADX analysis of MotoPlay classes:

- `com.cfmoto.cfmotointernational.module.vehicle.motoplay.VehicleState`
- `com.cfmoto.cfmotointernational.module.vehicle.motoplay.SystemState`
- `com.cfmoto.cfmotointernational.module.vehicle.motoplay.MotoPlayTrackInfo`
- `com.cfmoto.motoplay.utils.ScreenCastManager`
- `com.cfmoto.motoplay.service.NavInfoReceivingService`

Current evidence indicates MotoPlay is a projection/navigation channel (phone ↔ display),
not the source of RPM/speed/fuel telemetry for MT450.

- `VehicleState` tracks connection-level fields (VIN, QR info, motoplay type/flag).
- `SystemState` tracks phone/system state (network, GPS, hotspot, top activity).
- `MotoPlayTrackInfo` carries navigation/projection context.
- No bike telemetry fields (RPM, fuel, engine temp) were found in this path.

Conclusion:
- Bike telemetry shown in app is cloud-backed (TBox → cloud → app), not transported through MotoPlay.

---

## 2. GATT UUIDs (CONFIRMED — `BleConstant.java`)

| Role | UUID |
|------|------|
| Service | `0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |
| Write characteristic | `0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |
| Notify characteristic | `0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |

Source: `BleConstant.java` — `SERVICE_UUID`, `CHARACTERISTIC_UUID_WRITE`, `CHARACTERISTIC_UUID_NOTIFY`

MTU: 185 bytes (set 50ms after notify registration)

---

## 3. Frame Format (CONFIRMED — `TboxFrameDecoder.java`, `TboxMessageFrame.java`)

```
Byte index  Field           Value / Notes
──────────  ──────────────  ──────────────────────────────────────────
[0]         Header[0]       0xAB (-85 signed)
[1]         Header[1]       0xCD (-51 signed)
[2]         ControlCode     1 byte — identifies command type
[3]         LenLo           payload length, low byte (little-endian)
[4]         LenHi           payload length, high byte (little-endian)
[5..5+N-1] Payload         Protobuf-encoded message (N bytes)
[5+N]       CRC             byte-addition sum of bytes[2..5+N-1], truncated to 8 bits
[6+N]       End             0xCF (-49 signed)
```

**CRC algorithm** (`TBoxCrcFrame.calculateCrc()`):
```
crc = 0
for b in controlCode_bytes + lenLo_lenHi_bytes + payload_bytes:
    crc = (crc + b) & 0xFF
```
CRC is NOT XOR — it is byte addition modulo 256.

**Payload format**: Protocol Buffers (`com.cfmoto.proto.Meter.*`)

---

## 4. Control Codes (CONFIRMED — `TboxControlCode.java`, `TboxFrameFactory.java`, `TboxFrameDecoder.java`)

### App → Bike (outgoing)

| Hex  | Dec | Name                 | Proto message         | Notes |
|------|-----|----------------------|-----------------------|-------|
| 0x0A | 10  | operate_4g           | `Meter.Operate4g`     | 4G module command |
| 0x0B | 11  | recharge             | `Meter.ChargeStatus`  | Enable charging |
| 0x0C | 12  | operate_4g_complex   | `Meter.Operate4gComplex` | Complex 4G command |
| 0x15 | 21  | patch_obtain_info    | `Meter.PatchObtainInfoControl` | Get charger info |
| 0x5A | 90  | auth_package         | `Meter.AuthPackage`   | Auth step 1: send encryptValue |
| 0x5C | 92  | random_num           | `Meter.RandomNum`     | Auth step 3: send decrypted sn |
| 0x65 | 101 | THEME                | `Meter.Theme`         | Display theme |
| 0x66 | 102 | NAVI                 | `Meter.Navi`          | Navigation direction/distance |
| 0x67 | 103 | lock_control         | `Meter.Lock` OR `Meter.Heartbeat` | Lock/unlock/power AND heartbeat |
| 0x68 | 104 | PREFERENCE           | `Meter.Preference`    | Max speed limit |
| 0x69 | 105 | DISPLAY_UNITS        | `Meter.Display`       | Distance/temperature/time units |
| 0x6A | 106 | find_car             | `Meter.FindCar`       | Flash/horn/headlight |
| 0x6B | 107 | light_conrtol        | `Meter.LightControl`  | Turn signals |
| 0x6C | 108 | keep_auth            | —                     | Auth keep-alive during auth |
| 0x71 | 113 | charge_opt           | `Meter.ChargeSetting` | Charge power setting |
| 0x79 | 121 | kl15                 | `Meter.KL15`          | Ignition control |

### Bike → App (incoming notifications, decoded in `TboxFrameDecoder.decode()`)

| Hex  | Dec (signed) | DecoderData const | Proto message           | Notes |
|------|--------------|-------------------|-------------------------|-------|
| 0x5B | 91           | `TboxRandomNum`   | `Meter.TboxRandomNum`   | Auth step 2: bike random challenge (codec field) |
| 0x5D | 93           | `TboxAuthResult`  | `Meter.TboxAuthResult`  | Auth result (result=0 → success) |
| 0x8A | -118         | `OPERATE_4G`      | `Meter.CommandResult2`  | 4G command result |
| 0x8B | -117         | `RECHARGE`        | `Meter.CommandResult`   | Recharge result |
| 0x8C | -116         | `OPERATE_4G_COMPLEX` | `Meter.CommandResult2` | Complex 4G result |
| 0x95 | -107         | `PATCH_OBTAIN_INFO` | `Meter.PatchObtainInfoResult` | Charger info (chargerConnState + chargState) |
| 0xE7 | -25          | `LockControll`    | `Meter.CommandResult`   | Lock/unlock/powerOn/powerOff ACK |
| 0xEA | -22          | `FindCar`         | `Meter.CommandResult`   | Find car result |
| 0xEB | -21          | `LightControll`   | `Meter.CommandResult`   | Light control result |
| 0xEC | -20          | `KEEP_ALIVE`      | `Meter.CommandResult`   | Keep-alive ACK (`DecoderData.KEEP_ALIVE`) |
| 0xF1 | -15          | `CHARGE_OPT`      | —                       | Charge opt result |
| 0xF9 | -7           | `KL15`            | `Meter.CommandResult`   | KL15 result |

---

## 5. Meter.proto Messages

All protobuf messages are in `com.cfmoto.proto.Meter`. Field numbers from decompiled code:

### `AuthPackage` (0x5A outgoing)
| Field # | Name   | Type       | Notes |
|---------|--------|------------|-------|
| 1       | info   | bytes      | encryptValue from cloud API, as ByteString |

### `TboxRandomNum` (0x5B incoming)
| Field # | Name   | Type   | Notes |
|---------|--------|--------|-------|
| 1       | codec  | bytes  | Random challenge from bike (hex string) |

### `RandomNum` (0x5C outgoing)
| Field # | Name | Type   | Notes |
|---------|------|--------|-------|
| 1       | sn   | string | AES-256/ECB/PKCS7 decrypt of codec using `key` from cloud |

### `TboxAuthResult` (0x5D incoming)
| Field # | Name   | Type  | Notes |
|---------|--------|-------|-------|
| 1       | result | int32 | 0 = success |

### `Heartbeat` (0x67, keep-alive)
| Field # | Name | Type  | Notes |
|---------|------|-------|-------|
| 1       | ping | int32 | always 1 |

### `Lock` (0x67, lock/unlock/power)
| Field # | Name  | Type | Values |
|---------|-------|------|--------|
| 1       | type  | enum | 0=UNUSE1, 1=MOTORCYCLE, 2=SADDLE, 3=MAIN_STAND, 4=STORAGE_BOX, 5=SIDE_BOX, 6=TAIL_BOX, 7=POWER_ON_OFF |
| 2       | state | enum | 0=UNUSE2, 1=UNLOCKED, 2=LOCKED, 3=POWER_ON, 4=POWER_OFF |

**Known commands:**
```
Lock motorcycle:  type=1, state=2
Unlock motorcycle: type=1, state=1
Power on:         type=7, state=3
Power off:        type=7, state=4
```

### `CommandResult` (generic response)
| Field # | Name   | Type  | Notes |
|---------|--------|-------|-------|
| 1       | result | int32 | Operation result code |
| 2       | errRes | int32 | Error sub-code (on LockControll: 0/1=unlock, 16/17=lock, 32/33=powerOn, 48/49=powerOff) |

### `CommandResult2` (4G operation response)
| Field # | Name      | Type  |
|---------|-----------|-------|
| 1       | result    | int32 |
| 2       | errorCode | int32 |

### `FindCar` (0x6A)
| Field # | Name              | Type | Notes |
|---------|-------------------|------|-------|
| 1       | headlightStatus   | bool | |
| 2       | doubleflashStatus | bool | |
| 3       | loudspeakerStatus | bool | |

### `LightControl` (0x6B)
| Field # | Name | Type | Enum values |
|---------|------|------|-------------|
| 1       | type | enum | NONE2=0, RIGHT_OPEN=1, RIGHT_CLOSE=2, LEFT_OPEN=3, LEFT_CLOSE=4 |

### `KL15` (0x79)
| Field # | Name | Type  |
|---------|------|-------|
| 1       | kL15 | int32 |

### `Operate4g` (0x0A)
| Field # | Name    | Type  | Notes |
|---------|---------|-------|-------|
| 1       | command | int32 | |
| 2       | body    | int32 | |
| 3       | msgId   | int32 | currentTimeMillis / 1000 |

### `Operate4gComplex` (0x0C)
| Field # | Name    | Type   | Notes |
|---------|---------|--------|-------|
| 1       | command | int32  | |
| 2       | body    | string | |
| 3       | msgId   | int32  | |

### `ChargeStatus` (0x0B)
| Field # | Name         | Type |
|---------|--------------|------|
| 1       | enableCharge | bool |

### `ChargeSetting` (0x71)
| Field # | Name        | Type  |
|---------|-------------|-------|
| 1       | chargePower | int32 |

### `Preference` (0x68)
| Field # | Name             | Type  |
|---------|------------------|-------|
| 1       | maximumSpeedLimit | int32 |

### `Display` (0x69)
| Field # | Name         | Type | Enum values |
|---------|--------------|------|-------------|
| 1       | distance     | enum | NONE1=0, KM=1, MILE=2 |
| 2       | temperature  | enum | NONE2=0, CELSIUS=1, FAHRENHEIT=2 |
| 3       | time         | enum | NONE3=0, H12=1, H24=2 |
| 4       | languageType | enum | NONE4=0, CN=1, EN=2 |

### `PatchObtainInfoControl` (0x15)
| Field # | Name    | Type  | Notes |
|---------|---------|-------|-------|
| 1       | groupId | int32 | always 1 |

### `PatchObtainInfoResult` (0x95 incoming)
| Field # | Name            | Type  | Notes |
|---------|-----------------|-------|-------|
| 1       | chargerConnState | int32 | |
| 2       | chargState      | int32 | |

---

## 6. Authentication Flow (CONFIRMED — `BleModel.java`, `AES256EncryptionUtil.java`)

### Pre-requisites
Auth keys come from the **cloud API** in `VehicleNowInfoResp.encryptInfo`:
- `encryptValue` — opaque blob sent to bike (auth package)
- `key` — AES-256 key used to decrypt the bike's challenge
- `iv` — present but not used in current ECB mode implementation

Keys are NOT hardcoded — they are vehicle-specific and fetched per session.

### Connection sequence
```
1. Fetch encryptInfo from cloud API (VehicleNowInfoResp.encryptInfo)
2. BLE scan by MAC address
3. GATT connect
4. Enable notify on characteristic 0000B357
5. Wait 50ms
6. Set MTU to 185 bytes
7. AUTH STEP 1 (App→Bike, control=0x5A):
   Frame payload: AuthPackage { info: ByteString.copyFrom(hex_decode(encryptValue)) }
8. AUTH STEP 2 (Bike→App, control=0x5B):
   Frame payload: TboxRandomNum { codec: <random_hex_string> }
9. AUTH STEP 3 (App→Bike, control=0x5C):
   decrypted = AES256_ECB_PKCS7_decrypt(codec, key)
   Frame payload: RandomNum { sn: decrypted }
10. AUTH RESULT (Bike→App, control=0x5D):
    Frame payload: TboxAuthResult { result: 0 }  ← 0 = success
11. CONNECTED — status = 6 (auth success)
12. Send Heartbeat every 2000ms (timeout = 4000ms if no response)
    Frame: control=0x67, payload: Heartbeat { ping: 1 }
```

### Crypto details
- Algorithm: `AES/ECB/PKCS7Padding` (BouncyCastle)
- Provider: `BC` (BouncyCastle)
- Key: raw bytes of `encryptInfo.key` string (UTF-8)
- Input: hex-decode the bike's `TboxRandomNum.codec` field
- Output: decrypted string → set as `RandomNum.sn`

---

## 7. Auto-unlock

RSSI-based auto-unlock is enabled by default (`AUTO_UNLOCK = true`):
- If RSSI > -70 dBm → trigger unlock
- If RSSI < -95 dBm → re-enable auto-unlock flag

---

## 8. Telemetry NOT Available via BLE

The following fields are **not** available over BLE on the MT450:

| Field | Source | Notes |
|-------|--------|-------|
| Speed | Cloud MQTT/API | `VehicleNowInfoResp.speed` |
| RPM | N/A | Not exposed in any proto message |
| Fuel level | Cloud API | `VehicleNowInfoResp.remainingOil` (int) |
| Gear position | N/A | Not exposed for gas bike (only in electric HH40 proto) |
| Engine temperature | N/A | Not exposed in any proto message |
| Odometer | Cloud API | Via ride history endpoints |
| GPS position | Cloud MQTT | TBox sends to cloud; app reads from API |

The `BluetoothOuterClass.Bluetooth` proto has `transGearPos`, `speed`, `mileage`, `motorActTemp`
— but these are used exclusively by `BleModelYouth` for **HH40 electric bikes**. They do not
appear in any MT450 code path.

---

## 9. Comparison with `uuids.ts`

Current `packages/ble-protocol/src/uuids.ts` — matches perfectly:

| Field | uuids.ts | APK (BleConstant.java) | Match? |
|-------|----------|------------------------|--------|
| Service UUID | `0000B354-...` | `0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | ✅ |
| Write UUID | `0000B356-...` | `0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | ✅ |
| Notify UUID | `0000B357-...` | `0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | ✅ |

---

## 10. Separate BLE Protocol for Youth/Electric Bikes

Not relevant for MT450 but documented for completeness:

`BleModelYouth` handles HH40/ED20E/EC30E electric bikes using a **completely separate** protocol:
- Service Auth UUID: `0000b358-d6d8-c7ec-bdf0-eab1bfc6bcbc`
- Service Cmd UUID: `0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC`
- Char Auth UUID: `0000b360-d6d8-c7eC-bdf0-eab1bfc6bcbc`
- Char Cmd UUID: `0000B364-D6D8-C7EC-BDF0-EAB1BFC6BCBC`
- Payload: `BluetoothOuterClass.Bluetooth` proto (contains speed, mileage, gear, GPS, battery)
- Auth: AES/ECB/NoPadding with hardcoded prefix `"CFMOTOHTV"` + device suffix
- Frame format: custom (via `HH40Utils.getSendData`)

---

## 11. Open Questions / TODOs

- [ ] **`notifyResult` full decode**: The method in `BleModel.java` (615 instructions) could not be
  decompiled by jadx. It handles all incoming BLE frames and dispatches them. A `--comments-level debug`
  jadx run or smali analysis may reveal additional response handling not captured in `TboxFrameDecoder`.

- [ ] **Operate4G command catalog**: The `operate_4g` (0x0A) and `operate_4g_complex` (0x0C) commands
  interact with the 4G module. The full list of `command` codes and what they trigger (e.g., force GPS
  upload, request telemetry snapshot) is unknown.

- [ ] **PatchObtainInfoType enum**: `Meter.PatchObtainInfoType` has values `NONE=0`, `CHARGER_INFO=1`.
  Unknown if additional types exist.

- [ ] **Live telemetry subscription via 4G**: It's unknown whether the app subscribes to an MQTT topic
  after BLE auth to get pushed telemetry, or if it polls the REST API. The MQTT module
  (`com.cfmoto.mqtt`) needs separate analysis.

- [ ] **KL15 full flow**: What the `Meter.KL15.kL15` values mean (on/off? ignition state codes?).

- [ ] **Operate4G error codes**: The `CommandResult2.errorCode` values for 4G operations.

- [ ] **Auth key rotation**: Whether `encryptInfo` changes per connection or per vehicle registration.
