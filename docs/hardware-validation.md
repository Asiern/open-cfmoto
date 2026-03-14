# Hardware Validation Checklist

Items that cannot be verified by unit or integration tests alone.
Run against a real CFMoto 450 MT/SR/NK + Android device with HCI snoop log enabled.

---

## How to capture live traffic

```bash
# Enable on device (Developer Options → Enable Bluetooth HCI snoop log)
adb shell setprop persist.bluetooth.btsnoopenable true
# Run the app, perform the action, then pull the log:
adb pull /data/misc/bluetooth/logs/btsnoop_hci.log
# Open in Wireshark (filter: btle) or decode with:
python3 tools/apk-analysis/scripts/decode-btsnoop.py btsnoop_hci.log
```

---

## Validation items

### 1. Keep-alive ACK control code

**Uncertainty:** `KeepAliveManager.notifyAck()` must be called from the ResponseRouter
handler for the correct incoming control code. OEM source suggests `0xEC`
(`KEEP_ALIVE_RESULT`) but `0xE7` (`LOCK_RESULT`) is also plausible for heartbeat ACKs.

**Validate:**
- Send a keep-alive heartbeat (LOCK_CONTROL `0x67`)
- Inspect the bike's reply frame — record `frame[2]` (control code)
- Update `KeepAliveManager` JSDoc and the handler registration in `CFMoto450Protocol`
  (once wired) to use the confirmed code

**Tests to update:**
- `packages/ble-protocol/__tests__/keepalive.test.ts` — add "ACK code is `0xEC`" assertion
  once confirmed
- `docs/test-coverage.md` — mark keepalive ACK code as confirmed

---

### 2. Lock/unlock encrypted payload structure

**Uncertainty:** `lock()` and `unlock()` builders in `packages/ble-protocol/src/commands/index.ts`
accept a raw `encryptedPayload: Uint8Array` and wrap it in a `Lock` protobuf. The exact
AES-256/ECB/PKCS7 encryption using the cloud-supplied key has not been validated end-to-end.

**Validate:**
- Complete the `AuthFlow` implementation (currently `NotImplementedError`)
- Obtain `VehicleNowInfoResp.encryptInfo.key` from the cloud API
- Send a lock command and confirm the bike responds with `LOCK_RESULT` (`0xE7`) `result=0`

**Code to update:**
- `packages/ble-protocol/src/auth.ts` — replace `NotImplementedError` stub with real
  AES-256 implementation
- `apps/mobile/src/services/ble.service.ts` — wire auth into connect sequence

---

### 3. DISPLAY_UNITS enum values

**Uncertainty:** `setUnits('metric')` encodes `Display_Units.METRIC = 1` and
`setUnits('imperial')` encodes `Display_Units.IMPERIAL = 2`. These values are from
the protobuf schema but have not been confirmed against live traffic.

**Validate:**
- Switch units in the OEM app while capturing HCI snoop
- Decode the outgoing `DISPLAY_UNITS` (`0x69`) frame payload with the Meter proto schema
- Confirm that `metric=1`, `imperial=2` (or correct values)

**Tests to update:**
- `packages/ble-protocol/__tests__/commands.test.ts` — add decoded-payload assertion for
  `setUnits` once enum values are confirmed

---

### 4. 100ms post-connect delay necessity

**Uncertainty:** `CFMoto450Protocol.connect()` waits 100ms after `transport.connect()`
before calling `transport.subscribe()`. This matches `BleModel.java onConnectSuccess()`.
Some devices may not need this delay; others may need more.

**Validate:**
- Connect without the delay → observe whether descriptor write fails on GATT
- Try with 50ms / 100ms / 200ms if issues occur
- Document the minimum safe delay on CFMoto 450 MT hardware

---

### 5. MTU 185 negotiation acceptance

**Uncertainty:** `requestMtu(185)` is confirmed from `BleModel.java` but the actual
negotiated MTU the TBox returns may differ. The mock transport always returns 185.

**Validate:**
- Log the return value of `transport.requestMtu(peripheralId, 185)` on a real device
- If granted MTU < 185, verify that all built frames fit within the negotiated MTU
  (largest command payload is `setSpeedLimit` at ~12 bytes — well within any reasonable MTU)

---

### 6. TD-04 — Provider race condition on Android

**Issue:** If the app unmounts (or screen rotates) while `requestBlePermissions()` is
still awaiting the system dialog, `runBleInit` may call `bleService.initialize()` after
`bleService.destroy()` has already run. The service ends up initialized with no cleanup
registered.

**Reproduce:**
1. Cold-launch the app on Android 12+ (permission dialog appears)
2. Immediately rotate the device or navigate away
3. Check `bleService` internal state — `protocol` should be null, but may not be

**Fix (when confirmed):** Add an `isMounted` ref guard in `CFMotoProvider` and check it
before calling `bleService.initialize()`.

---

### 7. TD-05 — Stale `isRecording` closure in `useRideRecording`

**Issue:** `useRideRecording` reads `isRecording` inside a `useEffect` that only lists
`connectionState` as a dependency. On the first `'connected'` transition `isRecording`
is correctly `false`; on subsequent reconnects it may read a stale `true` and skip
starting a new recording.

**Reproduce:**
1. Connect to bike → trip starts recording
2. Disconnect → trip stops
3. Reconnect → verify `isRecording` transitions to `true` (new trip starts)

**Fix (if confirmed):** Add `isRecording` to the `useEffect` dependency array, or replace
the `useState` with a `useRef` that does not trigger re-render.

---

### 8. TD-06 — `recordCommandAcked` never called (commandHistory `ackedAt` always null)

**Issue:** `useBikeStore.recordCommandAcked()` is defined and tested but never called in
the current codebase. Command history entries always show `ackedAt: null`.

**To complete:**
1. Confirm which incoming control codes are ACKs for each outgoing command:
   - `LOCK_RESULT` (`0xE7`) → ACK for `LOCK_CONTROL` (`0x67`)
   - `FIND_CAR_RESULT` (`0xEA`) → ACK for `FIND_CAR` (`0x6A`)
   - `LIGHT_CONTROL_RESULT` (`0xEB`) → ACK for `LIGHT_CONTROL` (`0x6B`)
2. Register ResponseRouter handlers for each ACK code in `CFMoto450Protocol`
3. Call `useBikeStore.getState().recordCommandAcked(sentCode)` in each handler

**Tests to add:** Once wired, add integration test asserting that after sending a command
and simulating the ACK frame, the matching `commandHistory` entry has `ackedAt` set.
