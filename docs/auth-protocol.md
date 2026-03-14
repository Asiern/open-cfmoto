# BLE Authentication Protocol — CFMoto 450-Series TBox

> **Status:** Confirmed from static analysis of `com.cfmoto.cfmotointernational` (jadx decompilation).
> Sources: `BleModel.kt`, `AES256EncryptionUtil.java`, `EncryptInfo.java`, `EncryptInfoBean.java`,
> `BleModel$bleMtuChangedCallback$1.java`, `BleModel$bleNotifyCallback$1.java`, `TboxFrameFactory.java`,
> `DecoderData.java`, `VehicleNowInfoResp.java`, `BleControler.java`, `VehicleService.java`

---

## 1. Full Connection Sequence (Confirmed Timing)

```
App                                     TBox (Bike)
 |                                          |
 |  Cloud API: GET /fuel-vehicle/…/vehicle  |
 |  ← VehicleNowInfoResp.encryptInfo        |
 |    { encryptValue, key, iv }             |
 |                                          |
 |─── GATT connect ──────────────────────►  |
 |◄── onConnectSuccess ──────────────────── |  status = 1
 |                                          |
 |  (100ms delay)                           |
 |─── enable notify (0xB357) ────────────►  |
 |◄── onNotifySuccess ───────────────────── |
 |                                          |
 |  (50ms delay)                            |
 |─── requestMtu(185) ───────────────────►  |
 |◄── onMtuChanged (or onSetMTUFailure) ─── |  ← Auth proceeds BOTH paths
 |                                          |
 |  (2000ms delay, arm 3s auth timeout)     |
 |                                          |
 |─── AUTH STEP 1 (0x5A) ────────────────►  |  status = 2
 |    AuthPackage { info: hex_decode(encryptValue) }
 |                                          |
 |◄── AUTH STEP 2 (0x5B) ────────────────── |
 |    TboxRandomNum { codec: hex_string_bytes }
 |                                          |
 |  decrypt: AES-256/ECB/PKCS7(hex_decode(codec), key.getBytes())
 |                                          |
 |─── AUTH STEP 3 (0x5C) ────────────────►  |  status = 3
 |    RandomNum { sn: decrypted_string }    |
 |                                          |
 |◄── AUTH RESULT (0x5D) ─────────────────  |
 |    TboxAuthResult { result: 0 }          |  status = 6 (CONNECTED)
 |                                          |
 |─── Heartbeat (0x67) every 2000ms ─────►  |  keepAlive loop starts
 |◄── ACK (0xEC or 0xE7, TBD) ───────────── |  watchdog reset
```

**Total connection time (no failures):** ~2150ms to first authPkg after connect
(100ms + 50ms + 2000ms = 2150ms minimum before auth step 1 is sent)

---

## 2. Per-Step Breakdown

### Step 0 — Fetch keys from cloud (prerequisite)

- **Who:** App
- **When:** Before initiating BLE scan (triggered by UI or auto-connect)
- **Endpoint:** `GET fuel-vehicle/servervehicle/app/vehicle?vehicleId={vehicleId}`
  (source: `VehicleService.java:392`)
- **Response:** `VehicleNowInfoResp` containing `encryptInfo: EncryptInfo`
- **EncryptInfo fields** (source: `EncryptInfo.java`):
  | Field | Type | Usage |
  |-------|------|-------|
  | `encryptValue` | String | Hex string → raw bytes → `AuthPackage.info` |
  | `key` | String | UTF-8 encoded → AES-256 key bytes |
  | `iv` | String | Present but **NOT USED** (ECB mode has no IV) |

- **Data flow** (source: `BleControler.java:268-271`):
  ```java
  EncryptInfoBean encryptInfoBean = new EncryptInfoBean();
  encryptInfoBean.setEncryptValue(vehicleInfo.encryptInfo.encryptValue);
  encryptInfoBean.setIv(vehicleInfo.encryptInfo.iv);
  encryptInfoBean.setKey(vehicleInfo.encryptInfo.key);
  ```
  The `EncryptInfoBean` is passed to `BleModel.currentEncryptInfoBean` and
  held for the duration of the session.

---

### Step 1 — AUTH STEP 1: App → Bike (control code `0x5A`)

- **Who:** App (`BleModel.authPkg()`, source: `BleModel.java:1179-1203`)
- **Triggered by:** MTU callback (2000ms after MTU success or failure)
- **State guard:** If `connectStatus == 2` already, duplicate suppressed
- **Proto message:** `Meter.AuthPackage { info: ByteString }`
- **Encoding:**
  ```java
  byte[] raw = HexUtil.hexStringToBytes(encryptInfoBean.getEncryptValue());
  AuthPackage pkg = AuthPackage.newBuilder()
      .setInfo(ByteString.copyFrom(raw))
      .build();
  byte[] frame = TboxFrameFactory.getAuthPackageFrame(pkg.toByteArray()).encode();
  ```
- **`encryptValue` is a hex string** (e.g., `"A1B2C3..."`) — hex-decoded to raw bytes
  before being placed in the proto `bytes` field.
- **Write:** `BleManager.write(device, SERVICE_UUID, CHAR_WRITE, frame, split=false, callback)`
  (`split=false` = send as single BLE packet, no MTU chunking)
- **Status → 2** (`"认证中1"`)

---

### Step 2 — AUTH STEP 2: Bike → App (control code `0x5B`)

- **Who:** Bike (TBox)
- **Proto message:** `Meter.TboxRandomNum { codec: bytes }`
- **`codec` field encoding:** The `bytes` proto field contains the **ASCII bytes of a hex string**
  (e.g., UTF-8 bytes of `"F1A2B3C4..."`). NOT raw binary — it is human-readable hex.
- **Received via:** `BleModel$bleNotifyCallback$1.onCharacteristicChanged(byte[] data)`,
  which calls `BleModel.notifyResult(data)` (source: `bleNotifyCallback$1.java:24-32`)
- **`notifyResult` note:** This method is 615 bytecode instructions and was not decompiled
  by jadx (`throw new UnsupportedOperationException(...)`). The dispatch is inferred from
  the state machine: status=2 + incoming 0x5B → extract `codec` string → call `authPkg2(codec)`.
- **`codec` extraction (inferred):** `TboxRandomNum.parseFrom(payload).getCodec().toStringUtf8()`
  yields the hex string passed to `authPkg2`.

---

### Step 3 — AUTH STEP 3: App → Bike (control code `0x5C`)

- **Who:** App (`BleModel.authPkg2(String authNum)`, source: `BleModel.java:1205-1229`)
- **`authNum`** = the hex string from `TboxRandomNum.codec` (Step 2)
- **State guard:** If `connectStatus == 3` already, duplicate suppressed
- **Crypto operation:**
  ```java
  String decrypted = AES256EncryptionUtil.decrypt(authNum, key);
  // Where:
  //   authNum = hex string of bike's challenge (e.g., "F1A2B3...")
  //   key     = encryptInfoBean.getKey() (the AES key string from cloud)
  ```
- **Proto message:** `Meter.RandomNum { sn: decrypted }` — the decrypted string directly
- **Encoding:**
  ```java
  byte[] frame = TboxFrameFactory.getRandomNumFrame(
      RandomNum.newBuilder().setSn(decrypted).build().toByteArray()
  ).encode();
  ```
- **Write:** Same write call pattern as Step 1 (`split=false`)
- **Status → 3** (`"认证中2"`)
- **Log line** (from source): `"认证92：密钥:" + key + " 随机数:" + authNum + " 传输最终数据:" + hex(frame)`

---

### Step 4 — AUTH RESULT: Bike → App (control code `0x5D`)

- **Who:** Bike (TBox)
- **Proto message:** `Meter.TboxAuthResult { result: int32 }`
  - `result = 0` → success → `setConnectStatus(6)` → keepAlive loop starts
  - `result ≠ 0` → failure (exact handling in `notifyResult`, not decompiled)
- **Status → 6** (`"认证成功"`)

---

### Step 5 — Keep-alive loop (after auth success)

- **Who:** App (`BleModel.keepAlive()`, source: `BleModel.java:1608-1611`)
- **Heartbeat frame:** `Lock control (0x67)` with payload `Heartbeat { ping: 1 }`
  - ⚠️ Same control code as lock/unlock — differentiated by proto message type
- **Interval:** 2000ms (`sendEmptyMessageDelayed(KEEP_ALIVE, 2000)`)
- **Watchdog:** 4000ms (`sendEmptyMessageDelayed(KEEP_ALIVE_TIMEOUT, 4000)`)
  - On timeout: `disconnect()` called
- **ACK incoming code:** `DecoderData.KEEP_ALIVE = -20 = 0xEC` (source: `DecoderData.java:7`)
  - `0xEC = KEEP_ALIVE_RESULT` is the **confirmed** heartbeat ACK code from DecoderData
  - `0xE7 = LockControll` is for lock/unlock commands, not heartbeat
  - ⚠️ Still needs live traffic verification — `notifyResult` not decompiled

---

## 3. Cryptography Specification

### AES256EncryptionUtil (source: `AES256EncryptionUtil.java`)

**Full decrypt method:**
```java
public static String decrypt(String str, String str2) {
    byte[] keyByte = getKeyByte(str2);                    // key → bytes
    byte[] hexStr2Byte = parseHexStr2Byte(str);           // hex-decode input
    Cipher cipher = Cipher.getInstance("AES/ECB/PKCS7Padding", "BC");
    cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyByte, "AES"));
    return new String(cipher.doFinal(hexStr2Byte));        // default charset
}

private static byte[] getKeyByte(String str) {
    return !TextUtils.isEmpty(str) ? str.getBytes() : new byte[24];
}
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| Algorithm | `AES/ECB/PKCS7Padding` |
| Provider | `BC` (BouncyCastle) |
| Mode | ECB — no IV |
| Padding | PKCS7 |
| Key source | `key.getBytes()` — UTF-8 bytes of the key string from cloud |
| Key fallback | `new byte[24]` (24 zeros) if key is null/empty — AES-192, never used in practice |
| Input | `parseHexStr2Byte(codec_hex_string)` — hex-decode of TboxRandomNum.codec |
| Output | `new String(decryptedBytes)` — decoded with default charset (UTF-8 on Android) |

**Key encoding detail:** `str.getBytes()` without charset uses the JVM platform default.
On Android this is UTF-8. The cloud `key` string must be interpreted as UTF-8 for decryption
to succeed. Key length (bytes) must be 16, 24, or 32 for AES-128/192/256 respectively.

**Input hex decoder** (`parseHexStr2Byte`):
```java
bArr[i] = (byte) (Integer.parseInt(hex, 16) high_nibble * 16 + low_nibble);
```
Standard hex decoding of uppercase or lowercase hex strings.

**`encrypt()` method** (reference, not used in auth flow):
- Input: UTF-8 bytes of plaintext string
- Key: same as decrypt
- Output: uppercase hex string of encrypted bytes

---

## 4. Key Origin — Cloud API

### Endpoint
```
GET fuel-vehicle/servervehicle/app/vehicle?vehicleId={vehicleId}
```
(source: `VehicleService.java:391-392`, Retrofit `@GET` annotation)

Base URL is not hardcoded in the decompiled sources (loaded from config/BuildConfig).

### Response structure
```
VehicleNowInfoResp {
    btMac: String           // Bike BLE MAC address for connection
    encryptInfo: {
        encryptValue: String // Hex string — auth package sent to bike (0x5A)
        key: String          // AES-256 key string — used to decrypt bike challenge
        iv: String           // Present, NOT USED (ECB mode)
    }
    vehicleId: String
    // ... many other telemetry/status fields
}
```

### Key characteristics (inferred)
- **Scope:** Per vehicle session — keys are fetched before each connection attempt
- **Scope per VIN or per user:** Unknown — not visible from client code
- **Rotation:** Unknown — whether keys change per-session or are static per vehicle
  is not visible from client-side code
- **Cannot be computed offline:** Both `encryptValue` and `key` come from the server
  — there is no derivation logic in the APK

### Dynamic capture status (2026-03-14)

From Burp export `tools/apk-analysis/mitm-logs/full-history`:

- Login + signed cloud traffic are confirmed in runtime.
- The observed vehicle requests were for `vehicleId=-1` (virtual vehicle mode).
- In that mode, server returned `encryptInfo: {}` (empty).
- Pending: capture with a real linked vehicle (`vehicleId` real) to obtain
  `encryptValue`, `key`, and `iv` for end-to-end BLE auth validation.

---

## 5. Hardcoded Keys

**Result: None found.**

Exhaustive search for hex strings ≥ 32 chars and AES-key-shaped constants in:
- `com/cfmoto/ble/` package tree
- `AES256EncryptionUtil.java`
- `BleModel.java`
- `TboxTestActivity.java`

Only hardcoded crypto material found: `new byte[24]` (24 zero bytes) — the fallback
in `getKeyByte()` when key is null/empty. This is an error path, not a real key.

The `TboxTestActivity` (a developer test activity) fetches keys from `VehicleNowInfoResp`
the same way as the main flow — no test credentials bundled.

---

## 6. Connection State Machine

| Code | String (from source) | Meaning |
|------|----------------------|---------|
| -8 | — | Connect fail (error code 103) → reconnect with long timeout |
| -7 | `"连接所需数据错误"` | Auth data missing (no encryptValue) → disconnect |
| -6 | `"无权限"` | No BLE permission |
| -5 | `"认证失败"` | Auth failed or key missing → disconnect + retry in 3s |
| -4 | `"被动断开"` | Passive disconnect (bike dropped) → reconnect in 2s |
| -3 | `"主动断开"` | Active disconnect (app initiated) |
| -2 | `"连接失败"` | GATT connect fail → reconnect |
| -1 | `"未连接"` | Idle / reset |
| 0  | `"连接中"` | BLE scan in progress |
| 1  | `"蓝牙连接成功"` | GATT connected → 100ms → setNotify() |
| 2  | `"认证中1"` | Auth step 1 sent (0x5A) |
| 3  | `"认证中2"` | Auth step 3 sent (0x5C) |
| 6  | `"认证成功"` | Auth complete → keepAlive loop starts |

---

## 7. Implementation status in open-cfmoto (2026-03-14)

Current `CFMoto450Protocol.connect()` behavior:

```
connect() → 100ms → subscribe → requestMtu(185) [continue on failure]
         → 2000ms delay → cloud login + getEncryptInfo → AuthFlow.authenticate()
```

This now matches the critical OEM timing/flow expectations:

- 100ms delay before notify registration.
- Auth still proceeds if MTU negotiation fails.
- 2000ms delay after MTU callback before starting auth.
- Full 0x5A → 0x5B → 0x5C → 0x5D flow implemented in `packages/ble-protocol/src/auth.ts`.

Current intentional deviations:

- OEM auth timeout watchdog is 3s (`KEEP_AUTH_CONNECT_TIMEOUT`), while open-cfmoto uses
  5s per wait step in `AuthFlow` to reduce false negatives during testing.
- `notifyResult` in OEM app is not fully decompiled, so codec handling remains based on
  validated inference (`TboxRandomNum.codec` interpreted as UTF-8 hex string).

---

## 8. Open Questions

| # | Question | How to Answer |
|---|----------|---------------|
| 1 | Exact format of `TboxRandomNum.codec` (hex string bytes confirmed?) | Live BLE snoop — capture 0x5B frame, decode proto |
| 2 | `TboxAuthResult.result` values for auth failure | Live snoop or intentional auth fail |
| 3 | Does `key` string length always equal AES-256 (32 chars)? | Request `VehicleNowInfoResp` from cloud API |
| 4 | Does `encryptValue` length vary by vehicle? | Same |
| 5 | Key rotation: same keys across sessions or new per connect? | Compare `VehicleNowInfoResp` across multiple sessions |
| 6 | `notifyResult` dispatch: exact extraction of codec from proto | jadx `--comments-level debug` or smali analysis |
| 7 | Keep-alive ACK: `0xEC` vs `0xE7` (DecoderData says `KEEP_ALIVE=-20=0xEC`) | Live snoop — observe 0x67 → reply |
