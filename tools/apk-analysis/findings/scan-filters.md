# BLE Scan Filters — CFMoto App

**Status: CONFIRMED from jadx decompilation.**

---

## TBox Path (BleModel — 450-series motorcycles)

- Scans **by MAC address** only (stored from server after vehicle binding).
- `ScanFilter.Builder().setDeviceAddress(mac)`
- **Scan settings**: `ScanMode.LOW_LATENCY` (mode 2), `reportDelay = 0`, `useHardwareBatchingIfSupported = true`, `legacy = false`
- Scan scan initiated by `scannerAndConnect()`; stopped on first match.
- **No name-based filtering** for the 450-series.

Source: `BleModel.java`

---

## Youth Path (BleModelYouth — child bikes)

Two sub-cases depending on device:

### By MAC address (default)
- `BluetoothAdapter.checkBluetoothAddress(name)` → `ScanFilter.setDeviceAddress(mac)`

### By device name (if input is not a valid MAC)
- `ScanFilter.Builder().setDeviceName(name)`

### After scan result:
- If device name starts with `"9RH0N"` (CF110-AY10), `"EC30E"` (CF1000DY), or `"ED20E"` (CF650DY):
  - Read `ManufacturerSpecificData(53199)` from scan record
  - Bytes [0..5] = MAC address, bytes [6..12] = 7-char password
  - Use scan record bytes for auth during GATT connect
- Otherwise: plain GATT connect without scan record

**Scan timeout**: 15 000 ms (`SCAN_TIMEOUT` handler message 1).

Source: `BleModelYouth.java`, `CarFilter.java`, `Cf110Utils.java`

---

## Navigation/HUD Path (BleNaviModule)

- Scans by device name using `BleScanRuleConfig` (FastBLE API)
- No specific name pattern visible in public constants; set at runtime.

---

## Manufacturer ID

| ID (decimal) | ID (hex) | Used by |
|---|---|---|
| 53199 | `0xCFCF` | CF110-type devices (scan record contains MAC + password) |

---

## Device Name Patterns

| Prefix | Model | Protocol |
|--------|-------|----------|
| `9RH0N` | CF110-AY10 | CF110 GATT auth |
| `EC30E` | CF1000DY | CF110 GATT auth |
| `ED20E` | CF650DY | CF110 GATT auth |
| (any other) | Unknown youth | HH40 SPP protocol |
| (MAC only, 450-series) | CFMoto 450 MT/SR/NK | TBox protocol |
