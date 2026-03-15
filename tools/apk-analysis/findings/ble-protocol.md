# BLE Protocol — CFMoto (com.cfmoto.cfmotointernational)

**Status: CONFIRMED from jadx decompilation. Values extracted directly from source.**

---

## 1. GATT UUIDs

All UUIDs are from `BleConstant.java` and related files.

### Primary "TBox" Service (used by 450-series / connected motorcycles)

| Role | UUID | Source |
|------|------|--------|
| Service | `0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `BleConstant.SERVICE_UUID` |
| Write Characteristic | `0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `BleConstant.CHARACTERISTIC_UUID_WRITE` |
| Notify Characteristic | `0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `BleConstant.CHARACTERISTIC_UUID_NOTIFY` |

### Navigation Service (BleNaviModule — used for HUD/mirror projection)

| Role | UUID | Source |
|------|------|--------|
| Service | `0000B360-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `BleNaviModule.SERVICE_UUID` |
| Characteristic | `0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `Cf110Utils.SERVICE_Cmd_UUID` (used as CHARACTERISTIC_UUID in BleNaviModule) |

### CF110 Youth/Child Bike Auth Service (different device type)

| Role | UUID | Source |
|------|------|--------|
| Auth Service | `0000b358-d6d8-c7ec-bdf0-eab1bfc6bcbc` | `Cf110Utils.SERVICE_Auth_UUID` |
| Auth Characteristic | `0000b360-d6d8-c7eC-bdf0-eab1bfc6bcbc` | `Cf110Utils.Char_Auth_UUID` |
| Cmd Service | `0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `Cf110Utils.SERVICE_Cmd_UUID` |
| Cmd Characteristic | `0000B364-D6D8-C7EC-BDF0-EAB1BFC6BCBC` | `Cf110Utils.Char_Cmd_UUID` |

### HH40 (another youth/child scooter variant)

| Role | UUID | Source |
|------|------|--------|
| SPP Service | `0783b03e-8535-b5a0-7140-a304d2495cb7` | `HH40Utils.BLE_SPP_Service` |
| Notify Characteristic | `0783b03e-8535-b5a0-7140-a304d2495cb8` | `HH40Utils.BLE_SPP_Notify_Characteristic` |
| Write Characteristic | `0783b03e-8535-b5a0-7140-a304d2495cba` | `HH40Utils.BLE_SPP_Write_Characteristic` |
| AT Characteristic | `0000fff6-0000-1000-8000-00805f9b34fb` | `HH40Utils.BLE_SPP_AT_Characteristic` |

> **Note**: The HH40 and CF110 UUIDs are for small electric child vehicles, NOT the 450-series motorcycle. The primary TBox UUIDs (`B354`/`B356`/`B357`) are the ones relevant to CFMoto 450 MT/SR/NK.

---

## 2. Packet Format

There are **two packet formats** depending on the connection path.

### 2a. TBox Frame (450-series motorcycle, `BleModel`)

Used for all communication on `SERVICE_UUID` / `CHARACTERISTIC_UUID_WRITE`. Assembled by `TboxMessageFrame.generateMessage()`.

```
Offset  Len   Description
------  ---   -----------
0       2     Header: 0xAB 0xCD  (bytes -85,-51 in signed = 0xAB,0xCD)
2       1     Control code (command byte)
3       2     Data length  (little-endian, low byte first)
5       N     Data payload (Protobuf-encoded)
5+N     1     CRC: sum of bytes[2..5+N-1] mod 256 (byte addition, truncated to byte)
6+N     1     End byte: 0xCF  (byte -49 in signed)
```

**Total frame size**: N + 7 bytes.

**CRC algorithm** (from `TBoxCrcFrame.calculateCrc()`): sum of control-code byte + both length bytes + all data bytes, result truncated to `byte` (i.e., mod 256, signed).

**Decoding** (from `TboxFrameDecoder.decode()`):
- Validate `bArr[0] == 0xAB` and `bArr[1] == 0xCD`
- Read length: `(bArr[3] & 0xFF) | (bArr[4] << 8)` (little-endian)
- Data payload at offsets `[5 .. 5+len-1]`
- CRC at `[5+len]`, end byte at `[5+len+1]`
- Payload is **Protobuf** (parsed via `com.cfmoto.proto.Meter.*`)

### 2b. CFBleMsg / HH40 Frame (youth bikes, `BleModelYouth`)

Used by CF110 and HH40 child bikes. Assembled by `CFBleMsg.getSendCmdData()` and `HH40Utils.getSendData()`.

```
Offset  Len   Description
------  ---   -----------
0       2     Header: 0xAB 0xCD
2       1     Command byte
3       1     Data length (low byte)
4       1     Data length (high byte, always 0)
5       N     Data payload (Protobuf-encoded)
5+N     1     CRC: sum of bytes[2..5+N-1] mod 256
6+N     1     End byte: 0xCF
```

CRC algorithm (from `CFBleMsg.cfCrc()`): sum of `bArr[2]` through `bArr[len-3]` (i.e., bytes after header through before CRC+end), masked to 8 bits.

**Receiver framing** (`HH40Utils.receiver()`):
- Buffer accumulates bytes
- Sync on 0xAB then 0xCD
- Length read from bytes[3] and bytes[4] (little-endian short)
- Packet complete when `size == length + 5` and last byte is 0xCF

### 2c. Navigation Frame (`MessageFrame`, used by `BleNaviModule`)

Same outer structure as TBox frame but includes a **sequence byte** for multi-frame messages:

```
Offset  Len   Description
------  ---   -----------
0       2     Header: 0xAB 0xCD
1       1     Control code (NaviCode byte)
3       2     Data length (little-endian)
5       1     Sequence byte (see below)
6       N     Data payload
6+N     1     CRC: sum of control + len-bytes + seq + data bytes, mod 256
7+N     1     End byte: 0xCF
```

**Sequence byte values** (from `SeqFrame`):
| Value | Meaning |
|-------|---------|
| `0xC0` (-64) | Single frame |
| `0x80` (-128) | Start frame of multi-frame |
| `0x00` | Middle frame |
| `0x40` | End frame (OR'd with sequence number) |
| `0x20` | Need-confirm flag (OR'd in) |

Max single-frame data payload: 12 bytes (for road name fragmentation).

---

## 3. Control Codes / Commands

### TBox Control Codes (`TboxControlCode.java`)

These are the `controlCode` bytes in TBox frames. Sent App→Bike on `CHARACTERISTIC_UUID_WRITE`.

| Code (hex) | Code (dec) | Constant | Description |
|-----------|-----------|----------|-------------|
| `0x5A` | 90 | `auth_package` | Auth step 1: send encrypted auth package |
| `0x5B` | 91 | `tbox_num` | TBox device number (response) |
| `0x5C` | 92 | `random_num` | Auth step 2: send decrypted random number |
| `0x5D` | 93 | `tbox_auth_resule` | TBox auth result |
| `0x65` | 101 | `THEME` | Set display theme |
| `0x66` | 102 | `NAVI` | Navigation data |
| `0x67` | 103 | `lock_control` | Lock/unlock/power-on/power-off |
| `0x68` | 104 | `PREFERENCE` | Preferences (max speed limit) |
| `0x69` | 105 | `DISPLAY_UNITS` | Display unit settings |
| `0x6A` | 106 | `find_car` | Find car (flash/horn/headlight) |
| `0x6B` | 107 | `light_conrtol` | Turn signal control |
| `0x6C` | 108 | `keep_auth` | Keep-alive / auth keepalive |
| `0x71` | 113 | `charge_opt` | Charging configuration |
| `0x79` | 121 | `kl15` | KL15 (ignition key) |
| `0x0A` | 10 | `operate_4g` | 4G remote operation |
| `0x0B` | 11 | `recharge` | Start recharge |
| `0x0C` | 12 | `operate_4g_complex` | 4G complex operation |
| `0x15` | 21 | `patch_obtain_info` | Batch get info (charger state etc.) |

### Response Control Codes (Bike→App, received on NOTIFY)

Decoded in `TboxFrameDecoder.decode()`. Note: Java signed bytes, so negative values represent > 127 unsigned.

| Code (dec signed) | Code (hex unsigned) | Constant | Description |
|---|---|---|---|
| 90 | `0x5A` | `TboxAUTH` | Auth package from bike |
| 91 | `0x5B` | `TboxRandomNum` | Random number (codec string) |
| 92 | `0x5C` | `TboxSendNumRESULT` | Send number result |
| 93 | `0x5D` | `TboxAuthResult` | Auth result (int) |
| -107 | `0x95` | `PATCH_OBTAIN_INFO` | Charger connection state + charge state |
| -25 | `0xE7` | `LockControll` / `NAVIRES` | Lock control result (result + errRes) |
| -22 | `0xEA` | `FindCar` | Find car result |
| -21 | `0xEB` | `LightControll` | Light control result |
| -20 | `0xEC` | `KEEP_ALIVE` | Keep-alive response |
| -15 | `0xF1` | `CHARGE_OPT` | Charge option result |
| -7 | `0xF9` | `KL15` | KL15 result |
| -118 | `0x8A` | `OPERATE_4G` | 4G operation result (result + errorCode) |
| -117 | `0x8B` | `RECHARGE` | Recharge result |
| -116 | `0x8C` | `OPERATE_4G_COMPLEX` | Complex 4G result (result + errorCode) |

### Lock Control (`lock_control` = 0x67) — `Meter.Lock` protobuf

`type` and `state` fields in the Lock protobuf:

| Operation | type | state | Notes |
|-----------|------|-------|-------|
| Unlock | 1 | 1 | `unLock()` |
| Lock | 1 | 2 | `lock()` |
| Power ON | 7 | 3 | `powerOn()` |
| Power OFF | 7 | 4 | `powerOff()` |
| Keep-alive heartbeat | — | — | Uses `Heartbeat.setPing(1)` via `lock_control` code 103 |

**Lock response state codes** (from `bisRes()`):
| State value | Meaning |
|-------------|---------|
| 0 or 1 | Unlock success |
| 16 | Lock succeeded (maps to result 0) |
| 17 | Lock failed (maps to result 1) |
| 32 | Power-on succeeded (maps to result 0) |
| 33 | Power-on failed (maps to result 1) |
| 48 | Power-off succeeded (maps to result 0) |
| 49 | Power-off failed (maps to result 1) |

### Navigation Control Codes (`NaviCode.java`)

Sent via `BleNaviModule` on the Navi service.

| Byte | Constant | Description |
|------|----------|-------------|
| 120 | `state` | Navigation state |
| 121 | `direction` | Turn direction |
| 122 | `distance` | Distance |
| 123 | `nextRoadName` | Next road name (may fragment) |
| 124 | `remainDistance` | Remaining distance |
| 125 | `remainTime` | Remaining time |
| 126 | `time` | Current time |

### CFBleMsg Command Codes (CF110 child bike)

| Code | Constant | Description |
|------|----------|-------------|
| 10 | `CMD_LBS_Info` | Device location info |
| 11 | `CMD_Setting_Info` | Car setting info |
| 12 | `CMD_Write_Setting` | Write settings (returns 0/1 result) |
| 13 | `CMD_RF_dis_test` | RF distance test |
| 14 | `CMD_Cmd_Result` | Command result |
| 15 | `CMD_Get_Dev_Version` | Get device version |
| 16 | `CMD_Update_Dev` | Device OTA update |
| 91 | `Cmd_Dev_En` | Device challenge (encrypted random bytes) |
| 92 | `Cmd_Dev_De` | Device decryption step |
| 93 | `Cmd_Dev_AuthOK` | Device auth OK |
| 94 | `Cmd_App_En` | App challenge send |
| 95 | `Cmd_App_De` | App decryption step |
| 96 | `Cmd_App_AuthOK` | App auth OK |

### HH40 Command Codes (`HH40Utils.java`)

| Byte | Constant | Description |
|------|----------|-------------|
| 1 | `CMD_VEHICLE_CONFIG_INFO` | Vehicle configuration |
| 2 | `CMD_TRIP_EVENT` | Trip event |
| 3 | `CMD_VEHICLE_CYCLE_INFO` | Vehicle cycle info |
| 4 | `CMD_VEHICLE_SETTING` | Vehicle settings |
| 5 | `CMD_FAULT_INFO` | Fault info |
| 6 | `CMD_KEY_CYCLE_INFO` | Key cycle info |
| 7 | `CMD_POWER_MODE_MODIFY` | Power mode modify |
| 8 | `CMD_CYCLING_RANGE_MODIFY` | Cycling range modify |
| 9 | `CMD_CALL_VEHICLE` | Call vehicle (find) |
| 10 | `CMD_OVER_DISTANCE_REMINDER` | Over-distance reminder |
| 11 | `CMD_SOS_REMINDER` | SOS reminder |
| 15 | `CMD_VEHICLE_LOCATION_INFO` | Vehicle location info |
| 17 | `CMD_LOCK` | Lock/unlock (action 1=unlock, 2=lock) |
| 18 | `CMD_ELECTRIC_FENCE` | Electric fence |
| 19 | `CMD_UNIT_SETTING` | Unit settings |
| 20 | `CMD_SEND_LOCATION` | Send location |
| -111 | `CMD_REPLY_LOCK` | Lock reply |
| -110 | `CMD_REPLY_OVER_DISTANCE_SETTING` | Over-distance setting reply |
| -121 | `CMD_REPLY_FAULT_CODE` / `CMD_REPLY_POWER_MODE` | Fault code / power mode reply |
| -120 | `CMD_REPLY_CYCLING_RANGE` | Cycling range reply |
| -119 | `CMD_REPLY_CALL_VEHICLE` | Call vehicle reply |
| -118 | `CMD_REPLY_OVER_DISTANCE` | Over-distance reply |
| -117 | `CMD_REPLY_SOS` | SOS reply |
| -113 | `CMD_REPLY_GPS` | GPS reply |
| -109 | `CMD_REPLY_UNIT_SETTING` | Unit setting reply |

---

## 4. Protobuf Message Types (`com.cfmoto.proto`)

Payloads are encoded as Protocol Buffers. Key message types:

### `Meter.AuthPackage` — auth step 1
- `info` (ByteString): encrypted auth bytes (from `EncryptInfoBean.encryptValue`, hex-decoded)

### `Meter.TboxRandomNum` — auth step 1 response
- `codec` (string): random number string from bike

### `Meter.RandomNum` — auth step 2 send
- `sn` (string): decrypted random number (AES256/ECB/PKCS7 decrypt of `codec` using `key`)

### `Meter.TboxAuthResult` — auth result
- `result` (int): 0 = success

### `Meter.Lock` — lock/unlock/power
- `type` (int): operation category
- `state` (int): operation state

### `Meter.Heartbeat` — keep-alive
- `ping` (int): set to 1

### `Meter.FindCar` — find car
- `doubleflashStatus` (bool)
- `headlightStatus` (bool)
- `loudspeakerStatus` (bool)

### `Meter.LightControl` — turn signal
- `direction` (int): uses `LightType` enum (NONE2=0, RIGHT_OPEN=1, RIGHT_CLOSE=2, LEFT_OPEN=3, LEFT_CLOSE=4)

### `Meter.ChargeSetting` — charge power setting
- `chargePower` (int)

### `Meter.ChargeStatus` — recharge command
- `enableCharge` (bool): set true

### `Meter.PatchObtainInfoControl` — batch info request
- `groupId` (int): set to 1

### `Meter.PatchObtainInfoResult` — batch info response
- `chargerConnState` (int)
- `chargState` (int)
- `groupId` (int)

### `Meter.Operate4g` — 4G command
- `command` (int)
- `body` (int)
- `msgId` (int): `System.currentTimeMillis() / 1000`

### `Meter.Operate4gComplex` — 4G complex command
- `command` (int)
- `body` (string)
- `msgId` (int)

### `Meter.Preference` — preferences
- `maximumSpeedLimit` (int)

### `Meter.Display` — display units
- `distance` (DistanceUnit enum)
- `temperature` (TemperatureUnit enum)
- `time` (TimeUnit enum)
- `languageType` (LanguageType enum)

### `Meter.CommandResult` — generic command result
- `result` (int)
- `errRes` (int)

### `Meter.CommandResult2` — generic command result with error code
- `result` (int)
- `errorCode` (int)
- `command` (int)

### `BluetoothOuterClass.Bluetooth` — main telemetry (HH40/child bike)
Used for HH40 vehicle data (see `data-fields.md` for field list).

---

## 5. Authentication / Encryption

### TBox Auth (450-series motorcycle) — 3-step

1. **Step 1** (App → Bike, code `0x5A`): Send `Meter.AuthPackage` with `info` = hex-decoded `encryptValue` from server.
2. **Step 1 response** (Bike → App, code `0x5B`): Receive `Meter.TboxRandomNum.codec` (encrypted random number string).
3. **Step 2** (App → Bike, code `0x5C`): Send `Meter.RandomNum` with `sn` = AES-256/ECB/PKCS7 **decrypt** of `codec` using `key` from server. (Uses BouncyCastle provider.)
4. **Auth result** (Bike → App, code `0x5D`): `Meter.TboxAuthResult.result` — 0 = success.
5. On success, `connectStatus` advances to **6** (authenticated).

**Keys**: `encryptValue`, `key`, `iv` come from `EncryptInfoBean`, which is passed in from the server API (not hard-coded in BLE layer). AES algorithm: `AES/ECB/PKCS7Padding` via BouncyCastle.

### CF110 Auth (child bike) — 4-step challenge-response

1. App generates 16-char random string (`mRandomStr`).
2. App reads MAC+password from scan record (`Cf110Utils.getBleMacAndPsw()`): bytes [0..5] = MAC, bytes [6..12] = 7-char password.
3. **Auth step 1** (code `94`): Send `AES/ECB/NoPadding` encrypt of `mRandomStr` using key `"CFMOTOHTV" + password`.
4. Device replies with `code 91`: encrypted challenge bytes.
5. App decrypts with same AES key → `mDecryptByte`.
6. **Auth step 4** (code `92`): Send `mDecryptByte`.
7. Device replies with `code 95`: if decrypted content matches `mRandomStr`, send `code 96` with `[0x00]` → auth OK.
8. **Auth confirmed** (code `93`): device sends auth-OK notification.

---

## 6. Connection Flow Summary

See `connection-flow.md` for detailed sequence. Brief:

1. Scan by MAC address (stored from server binding).
2. On connection success: set notify on `CHARACTERISTIC_UUID_NOTIFY`.
3. Set MTU to 185.
4. Run auth sequence (steps above).
5. On `connectStatus == 6`: keep-alive loop begins (ping every 2s, 4s timeout).
6. Commands sent on `CHARACTERISTIC_UUID_WRITE`, responses received on notify.

---

## 7. Scan / Advertisement

- **Manufacturer Specific Data ID**: `53199` (decimal) = `0xCFCF` — used by CF110 device type. The scan record bytes contain MAC (6 bytes) + password (7 bytes).
- **Device name prefixes** (for CarFilter):
  - `9RH0N` → CF110-AY10
  - `EC30E` → CF1000DY
  - `ED20E` → CF650DY
  - Other devices scanned by MAC address directly.
- **Scan mode**: `SCAN_MODE_LOW_LATENCY` (mode 2), report delay 0, hardware batching enabled.
- **Scan timeout**: 15000 ms for youth devices.
- **Reconnect delay**: 5000 ms on passive disconnect, 10000 ms on connect fail (youth path). 2000–5500 ms on TBox path.

---

## 8. Control Code ↔ Protobuf Message Mapping (450-series TBox)

Confirmed from `TboxControlCode.java` and `BleModel.java`. All messages are in `com.cfmoto.proto.Meter`.

| Code | Direction | Protobuf Message |
|------|-----------|-----------------|
| `0x0A` | App→Bike | `Operate4g` |
| `0x0B` | App→Bike | `ChargeStatus` |
| `0x0C` | App→Bike | `Operate4gComplex` |
| `0x15` | App→Bike | `PatchObtainInfoControl` |
| `0x5A` | App→Bike | `AuthPackage` |
| `0x5B` | Bike→App | `TboxRandomNum` |
| `0x5C` | App→Bike | `RandomNum` |
| `0x5D` | Bike→App | `TboxAuthResult` |
| `0x65` | App→Bike | `Theme` |
| `0x66` | App→Bike | `Navi` |
| `0x67` | App→Bike | `Lock` or `Heartbeat` (ping=1 for heartbeat) |
| `0x68` | App→Bike | `Preference` |
| `0x69` | App→Bike | `Display` |
| `0x6A` | App→Bike | `FindCar` |
| `0x6B` | App→Bike | `LightControl` |
| `0x6C` | App→Bike | `Heartbeat` (keep-alive) |
| `0x71` | App→Bike | `ChargeSetting` |
| `0x79` | App→Bike | `KL15` |
| `0x8A` | Bike→App | `CommandResult2` |
| `0x8B` | Bike→App | `CommandResult` |
| `0x8C` | Bike→App | `CommandResult2` |
| `0x95` | Bike→App | `PatchObtainInfoResult` |
| `0xE7` | Bike→App | `CommandResult` |
| `0xEA` | Bike→App | `CommandResult` |
| `0xEB` | Bike→App | `CommandResult` |
| `0xF9` | Bike→App | `CommandResult` |
