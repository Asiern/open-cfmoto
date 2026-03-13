# Connection and Session Flow — CFMoto App

**Status: CONFIRMED from jadx decompilation of `BleModel.java` and `BleModelYouth.java`.**

There are two distinct BLE connection paths in the app. The **TBox path** is used for connected motorcycles (including 450 MT/SR/NK). The **Youth path** is for small electric child vehicles.

---

## Path 1: TBox — 450-series Motorcycles (`BleModel`)

### Connection Status Codes

| Code | Description |
|------|-------------|
| -8 | Connection error (long reconnect delay) |
| -7 | Connection data error (disconnect + stop) |
| -6 | No permission |
| -5 | Authentication failed |
| -4 | Passively disconnected |
| -3 | Actively disconnected |
| -2 | Connection failed |
| -1 | Not connected (idle) |
| 0 | Connecting |
| 1 | BLE connected (GATT layer) |
| 2 | Authenticating step 1 |
| 3 | Authenticating step 2 |
| 6 | Authenticated — fully operational |

### Full Connection Sequence

```
1. App receives MAC address + EncryptInfoBean (from cloud server)
   EncryptInfoBean contains:
     - encryptValue  (hex string of encrypted auth bytes)
     - key           (AES key for decrypting bike's challenge)
     - iv            (not used in ECB mode, stored for reference)

2. BleModel.initConnect(mac, callback)
   - If BLE disabled → stop
   - If same MAC already connected → invoke callback (skip scan)
   - Otherwise: disconnect any existing device, set currentMac = mac

3. Scan phase
   - scannerAndConnect(true) → start BLE scan filtering by MAC address
   - ScanMode: SCAN_MODE_LOW_LATENCY (2), reportDelay=0
   - On scan result matching MAC → stopAllScan + delay 2000ms → connect

4. GATT connect
   - BleManager.connect(mac, mBleGattCallback)
   - setConnectStatus(0) → starts 200ms watchdog before calling connect

5. onConnectSuccess (status = 1)
   - connectFailCount = 0
   - Delay 100ms → setNotify()

6. setNotify()
   - BleManager.notify(device, SERVICE_UUID, CHARACTERISTIC_UUID_NOTIFY, callback)

7. setMtu()
   - BleManager.setMtu(device, 185)

8. Auth step 1 — authPkg()
   - setConnectStatus(2)
   - Build Meter.AuthPackage { info = ByteString.copyFrom(hex_decode(encryptValue)) }
   - Encode as TBox frame with control code 0x5A (90)
   - Write to CHARACTERISTIC_UUID_WRITE

9. Bike responds with TBox frame control code 0x5B (91)
   - TboxFrameDecoder.decode() → DecoderData { controll=91, data=TboxRandomNum.codec }
   - codec is an encrypted string (random challenge from bike)

10. Auth step 2 — authPkg2(codec)
    - setConnectStatus(3)
    - decryptedSn = AES256EncryptionUtil.decrypt(codec, key)
      → AES/ECB/PKCS7Padding, BouncyCastle, key from EncryptInfoBean
    - Build Meter.RandomNum { sn = decryptedSn }
    - Encode as TBox frame with control code 0x5C (92)
    - Write to CHARACTERISTIC_UUID_WRITE

11. Bike responds with TBox frame control code 0x5D (93)
    - TboxAuthResult.result → 0 = success
    - setConnectStatus(6) → AUTHENTICATED

12. Authenticated state (status = 6)
    - rssiRead() scheduled (RSSI polling for proximity-based auto-unlock)
    - keepAlive() loop: ping every 2000ms, timeout at 4000ms
    - Commands now accepted

13. Keep-alive loop (while authenticated)
    - Every 2000ms: send Meter.Heartbeat{ping=1} via lock_control frame (0x67)
    - 4000ms watchdog: if no response → disconnect

14. Auto-unlock (proximity)
    - Reads RSSI periodically
    - RSSI > -70 dBm + AUTO_UNLOCK flag → call unLock()
    - RSSI < -95 dBm → re-enable AUTO_UNLOCK
```

### Reconnection Logic

| Trigger | Delay | Action |
|---------|-------|--------|
| Connection failed (normal) | 2000ms | scannerAndConnect(false) |
| Connection failed (error 103) | 5500ms | scannerAndConnect (long time) |
| Passive disconnect (-4) | 2000ms | connect() |
| Auth failed (-5) | 3000ms | connect() |
| Auth timeout | immediate | setConnectStatus(-5) |
| DELATED_SCAN (handler 160) | on check | disconnect + scannerAndConnect |
| DELATED_CONNECTED (handler 170) | on check | disconnect + connect after 2000ms |
| Screen ON | 2000ms | scannerAndConnect(true) |
| Bluetooth re-enabled | — | scannerAndConnect |

**Max reconnect attempts**: tracked via `connectFailCount`, no hard limit visible in code.

---

## Path 2: Youth/CF110 — Child Bikes (`BleModelYouth`)

### Connection Status Codes (same values as TBox)
- `-2`: Connect failed
- `-1`: Disconnected
- `0`: Idle
- `1`: Connecting
- `2`: GATT connected
- `3+`: (not exposed, auth tracks internally)

### Full Connection Sequence

```
1. starScanYouth(mac)
   - Scan timeout: 15000ms (SCAN_TIMEOUT handler message 1)
   - Uses BluetoothLeScannerCompat with ScanFilter (by MAC or device name)
   - ScanSettings: legacy=false, mode=LOW_LATENCY, delay=0

2. onScanResult → if MAC matches:
   - If device name starts with "9RH0N" / "EC30E" / "ED20E" (CF110-type):
     - Read manufacturerSpecificData(53199) → connect(mac, scanRecord)
   - Otherwise:
     - connect(mac) [plain connection, no scan record]

3. onConnectSuccess:
   - postValue(2) on connectStatus
   - currentKeyVin = MMKV.decodeString("current_key_vin")
   - go2Auth(bleDevice, gatt)

4. go2Auth:
   - If CF110-type device name:
     - mRandomPsw = Cf110Utils.getBleMacAndPsw(scanRecord)
       → bytes[0..5] = MAC, bytes[6..12] = 7-char password string
     - setMtu(500)
     - delay 500ms → setCF110AuthNotify()
   - Else (HH40-type):
     - delay 200ms → setHH40AuthNotify()

──────────────── CF110 Auth Branch ────────────────

5a. setCF110AuthNotify():
    - getGattCharacteristic(SERVICE_Auth_UUID, Char_Auth_UUID) → mAuthChar
    - getGattCharacteristic(SERVICE_Cmd_UUID, Char_Cmd_UUID) → mCmdChar
    - bleAuth1()

6a. bleAuth1():
    - mRandomStr = generateRandomString(16) [alphanumeric, 62-char alphabet]
    - encryptedChallenge = AES/ECB/NoPadding encrypt of mRandomStr
        key = "CFMOTOHTV" + mRandomPsw  (= "CFMOTOHTV" + 7-char device password)
    - getSendCmdData(94, encryptedChallenge) → send on mAuthChar

7a. Device replies code 95 → authNotifyResult → CFBleMsg.parse → onMsgCb(95, obj):
    - Decrypt payload with same AES key → compare to mRandomStr
    - If match: getSendCmdData(96, [0x00]) → send on mAuthChar (auth OK step)

8a. Device replies code 91 → onMsgCb(91, encryptedBytes):
    - bleAuth4(encryptedBytes):
      - Decrypt with AES/ECB/NoPadding key "CFMOTOHTV" + mRandomPsw → mDecryptByte
      - getSendCmdData(92, mDecryptByte) → send on mAuthChar

9a. Device replies code 93 → onMsgCb(93):
    - Authentication success!
    - EventBus.post(BindKeyEvent(true, 2))
    - Send getSendCmdData(11, null) on mCmdChar → request CarSettingInfo

10a. On receipt of CarSettingInfo (cmd=11):
     - Store in mSettingInfo
     - If speed-limit update needed: write modified CarSettingInfo back (cmd=12)

──────────────── HH40 Auth Branch ────────────────

5b. setHH40AuthNotify():
    - BleManager.notify(device, BLE_SPP_Service, BLE_SPP_Notify_Characteristic, callback)

6b. onNotifySuccess:
    - EventBus.post(BindKeyEvent(true, 1))
    - setMtu(185)

7b. Normal operation — all data received via HH40 notify:
    - Parsed by parseHH40(bytes) using HH40Utils.receiver() framing
    - Payload = BluetoothOuterClass.Bluetooth protobuf
```

### Reconnect Logic (Youth path)
- Passive disconnect → reconnect after 5000ms
- Connect fail → reconnect after 10000ms (if `canReconnect` flag set)
- Bluetooth re-enabled → starScanYouth(mac)

---

## MTU Negotiation

| Path | MTU |
|------|-----|
| TBox (BleModel) | 185 bytes |
| CF110 auth | 500 bytes (initial), then 185 |
| HH40 | 185 bytes |

---

## Broadcast Receivers Registered During Session

| Action | Handler |
|--------|---------|
| `android.bluetooth.adapter.action.STATE_CHANGED` | Re-scan on BT re-enable, disconnect on BT disable |
| `android.intent.action.SCREEN_ON` | Trigger reconnect scan (2s delay) |
| `android.intent.action.SCREEN_OFF` | (monitored) |
| `android.intent.action.USER_PRESENT` | (monitored) |

---

## Intent Actions (App→BleService)

The BLE service is controlled by `Intent` actions from the rest of the app:

| Action | Description |
|--------|-------------|
| `com.cfmoto.connect_car_scan` | Start scan + connect to MAC |
| `com.cfmoto.auto_connect_car` | Auto-connect |
| `com.cfmoto.auto_connect_car_force` | Force connect |
| `com.cfmoto.dis` | Disconnect |
| `com.cfmoto.find_car` | Find car (flash/horn) |
| `com.cfmoto.lock_car` | Lock |
| `com.cfmoto.lock_car_un` | Unlock |
| `com.cfmoto.pause_connect_car` | Pause connection |
| `com.cfmoto.resume_connect_car` | Resume connection |
| `com.cfmoto.power_on` | Power on |
| `com.cfmoto.power_off` | Power off |
| `com.cfmoto.recharge` | Start recharge |
| `com.cfmoto.charger_info` | Get charger info |
| `com.cfmoto.car_charging_set` | Set charge power |
| `com.cfmoto.operate_4g` | 4G remote operation |
| `com.cfmoto.operate_4g_complex` | 4G complex operation |
| `com.cfmoto.bluetooth` | Unbind Bluetooth |
