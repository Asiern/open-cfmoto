# App Architecture — com.cfmoto.cfmotointernational

**Status: CONFIRMED from jadx decompilation.**

---

## Package Structure

```
com.cfmoto.ble/                       BLE module (separate library)
  BleConstant                         Global constants, UUIDs, timeouts
  BleAction                           Intent action strings
  BleConnectDevice                    Stores current MAC + EncryptInfoBean
  BleConnectManager                   Connect manager entry point
  BleConnectStatus                    Connection status constants
  BleLog                              BLE logging
  UserToken                           User token storage
  LockStatusResp                      Lock status response model
  event/                              EventBus events
    BindKeyEvent                      Key bind result
    ConnectStatusEvent                Connection status change
    HH40DistanceChangeEvent           HH40 distance change
    HH40FaultCodeEvent                HH40 fault code
    HH40GpsEvent                      HH40 GPS location
    KeyInfoYouthEvent                 Key info for youth bikes
    LockRespEvent                     Lock response
    VehicleBaseInfoYouthEvent         Basic vehicle data
    VehicleRemindEvent                Vehicle reminder
    WriteDataFailureEvent / SuccessEvent
  frame/
    TboxControlCode                   Control code constants (0x5A–0x79 etc.)
    base/
      IFrame                          Frame interface
      AbstractFrame                   Base implementation
      HeaderFrame                     0xAB 0xCD header (2 bytes)
      EndFrame                        0xCF end byte (1 byte)
      ControlFrame                    Command byte (1 byte)
      RemainingLengthFrame            LE 2-byte length
      DataFrame                       Payload bytes
      CrcFrame                        Byte-sum CRC for navi frames
      SeqFrame                        Sequence byte for multi-frame navi
    control/
      TboxMessageFrame                Assembles TBox frames
      TboxFrameFactory                Factory for all TBox command frames
      TboxFrameDecoder                Decodes incoming TBox notify bytes
      TBoxCrcFrame                    Byte-sum CRC for TBox frames
      DecoderData                     Decoded result container
      EncryptInfoBean                 Auth keys (encryptValue, key, iv)
    navi/
      MessageFrame                    Assembles navi frames (with SeqFrame)
      FrameFactory                    Factory for all navi frames
      NaviCode                        Navi control code constants (120–126)
      NaviConnect                     Navi connect status constants
      DrectionCode                    Direction code constants
    cf110/
      CFBleMsg                        CF110 protocol parser/builder
      CommonTool                      Byte conversion utilities (LE)
      DeviceInfo                      GPS+status parsed struct (30 bytes)
      CarSettingInfo                  Geo-fence settings (26 bytes)
      BleCmdResult                    Command result (2 bytes)
      DevVersion                      Device firmware version
      DevUpdateInfo                   OTA update info
      AddDeviceBean                   Parcelable device info stored in MMKV
      FaultCodeBean                   Fault code model
    youth/
      HH40Utils                       HH40 frame build/parse + UUIDs
      Cf110Utils                      CF110 AES auth utilities + UUIDs
      CarFilter                       Device name → model type detection
      CFFParam                        CF110 name regex patterns
      EC30EParam                      EC30E name regex patterns
      ED20EParam                      ED20E name regex patterns
      YouthConnect                    Youth connection status constants
  service/
    BleModel                          TBox BLE singleton (motorcycle path)
    BleModelYouth                     Youth bike BLE singleton
    BleNaviModule                     Navigation HUD BLE singleton
    BleService                        Android foreground service wrapper
    AbsBleService                     Abstract BLE service base
    BleScannerBroadcastReceiver       Background scan result receiver
  utils/
    AES256EncryptionUtil              AES-256 ECB/PKCS7 via BouncyCastle
    AES256CBCwithPKCS5                AES-256 CBC/PKCS5 variant
    Base64Utils                       Base64 encode/decode
    BleNotificationUtils              Android notification helper
    BleUtils                          BLE state/permission checks
    HexUtil                           Hex conversion
    VehicleWarnType                   Warning type constants

com.cfmoto.proto/                     Protocol Buffer definitions
  Meter                               All TBox proto messages
  BluetoothOuterClass                 HH40/main telemetry proto
  Navi                                Navigation proto

com.cfmoto.cfmotointernational/       Main app
  App                                 Application class
  api/
    VehicleService                    Vehicle API (Retrofit)
    UserService                       User API
    CommunityService                  Community API
    ProtocolService                   Protocol/config API
    MapboxApi                         Mapbox integration
    OriginService                     Base URL service
  aliyun/                             Aliyun OSS file uploads
  awspush/                            AWS/Firebase push notifications
  BuildConfigHolder                   Build config

com.cfmoto.motoplay/                  Navigation HUD module
  routes/
    MotoPlayMapActivity               Map screen
    MotoPlaySearchActivity            Search screen
    MotoPlaySettingActivity           Settings screen
  service/
    LocationService                   GPS location service
    NavInfoReceivingService           Receives nav info from phone
  layer/                              UI layers (circle, landscape, vertical)
  mirror/                             Screen mirroring/projection
  utils/ext/MMKVKeys                  Persistent storage keys

com.cfmoto.mqtt/                      MQTT module (cloud connectivity)
  MqttManager                         MQTT client wrapper
  MqttOption                          MQTT connection options
  ActionType                          MQTT action types
```

---

## Key Classes and Roles

### `BleModel` (singleton, `com.cfmoto.ble.service`)
**The main BLE manager for 450-series motorcycles.**
- Implements `Handler.Callback`
- Manages: scan → connect → notify → auth → keepalive → command loop
- Contains `bleHandler` (main-thread Handler) for all state transitions
- Commands entered via Intent actions, results sent back via `Messenger` to client
- Status persisted to MMKV (`"ble_cf_mk"` store, key `"connect_status"`)

### `BleModelYouth` (singleton, `com.cfmoto.ble.service`)
**BLE manager for child bikes (CF110, HH40, EC30E, ED20E).**
- Handles two sub-paths: CF110 (GATT-level auth with AES) vs HH40 (simple notify)
- Uses EventBus to publish parsed data events

### `BleNaviModule` (singleton, `com.cfmoto.ble.service`)
**Separate BLE connection for navigation HUD display.**
- Connects to a display device (likely the motorcycle's instrument cluster)
- Pushes navigation data (direction, distance, road name, time) via navi frames
- Service UUID `0000B360-...`, characteristic `0000B362-...`

### `TboxFrameFactory` / `TboxFrameDecoder`
**Frame codec for TBox protocol.**
- Factory creates outgoing frames for each command type
- Decoder validates header/CRC and dispatches to Protobuf parsers

### `CFBleMsg`
**Frame codec for CF110 protocol.**
- Same 0xAB/0xCD/0xCF framing
- Payload parsed by `dealCmd()` dispatching to DeviceInfo, CarSettingInfo, etc.

### `HH40Utils`
**Static frame builder/parser for HH40 protocol.**
- `getSendData(cmd, payload)` builds outgoing frames
- `receiver(bytes)` reassembles complete frames from streaming bytes

### `EncryptInfoBean`
**Auth key container.**
- `encryptValue`: hex-encoded encrypted auth bytes to send to bike in step 1
- `key`: AES key to decrypt the bike's random number challenge
- `iv`: IV field (present but ECB mode ignores it)
- Passed as Parcelable extra in Intent `BleConstant.EncryptKey`

### `AES256EncryptionUtil`
**AES-256 ECB/PKCS7 implementation.**
- Algorithm: `AES/ECB/PKCS7Padding` via BouncyCastle provider
- `decrypt(cipherHex, keyStr)`: decodes hex → AES decrypt → returns plaintext string
- Used in TBox auth step 2 to decrypt bike's random challenge

### `Cf110Utils`
**CF110 auth helper.**
- Key: `"CFMOTOHTV"` prefix + 7-char device password from scan record
- Algorithm: `AES/ECB/NoPadding` (Java built-in, not BouncyCastle)
- `getBleMacAndPsw(scanRecord)`: extracts password from Manufacturer Specific Data

### `BleConstant`
**Global constants file.**
- Defines all UUIDs, timeouts, MMKV key names
- Initialised once via `BleConstant.init(application)`
- MMKV store ID: `"ble_cf_mk"` with multi-process mode (2)

---

## Data Flow (TBox / 450-series)

```
Server API
  → EncryptInfoBean (encryptValue, key, iv)
  → Intent(CONNECT_SCAN) + BleMacKey + EncryptKey extras
    ↓
BleService.onStartCommand()
  → BleModel.onStart(intent)
    ↓
BleModel.initConnect(mac) → Scan → GATT connect
  ↓ onConnectSuccess
setNotify() + setMtu(185)
  ↓ notify registered
authPkg() [status=2]
  → Write TBoxFrame(ctrl=0x5A, Meter.AuthPackage)
    ↓ NOTIFY
  → TboxFrameDecoder → ctrl=0x5B → TboxRandomNum.codec
  → authPkg2(codec) [status=3]
    → AES decrypt codec → Meter.RandomNum.sn
    → Write TBoxFrame(ctrl=0x5C, Meter.RandomNum)
      ↓ NOTIFY
    → ctrl=0x5D → TboxAuthResult.result=0 → status=6 ✓
      ↓
Keep-alive: Heartbeat every 2s via ctrl=0x67
RSSI polling → auto-unlock threshold
      ↓
Commands (lock/unlock/find/etc.):
  Intent action → BleModel.setAction() →
    TboxFrameFactory.get*Frame(Meter.*.build().toByteArray())
    → Write to CHARACTERISTIC_UUID_WRITE
      ↓ NOTIFY
    → TboxFrameDecoder → DecoderData → bisRes() → Messenger reply to UI
```

---

## Third-Party Libraries Used

| Library | Role |
|---------|------|
| `com.clj.fastble` (FastBLE) | BLE scan/connect/notify/write abstraction |
| `no.nordicsemi.android.support.v18.scanner` | Extended BLE scanner (API 18 compat) |
| `com.tencent.mmkv` (MMKV) | Persistent key-value storage (faster than SharedPreferences) |
| BouncyCastle | AES-256/PKCS7 crypto |
| Protocol Buffers (protobuf-lite) | BLE payload serialization |
| EventBus (GreenRobot) | In-process event distribution |
| RxJava/RxAndroid | Used in BleNaviModule for periodic timer |
| Mapbox Navigation SDK | Turn-by-turn navigation |
| Retrofit2 + OkHttp | HTTP API calls |
| Firebase Analytics/FCM | Analytics and push notifications |
