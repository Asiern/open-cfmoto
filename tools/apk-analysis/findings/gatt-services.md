# GATT Services — CFMoto 450 Series

**Status: UNCONFIRMED — scaffold UUIDs only. Update from jadx/btsnoop analysis.**

## Known / Suspected Services

| UUID | Name | Confidence | Source |
|------|------|-----------|--------|
| `0000fff0-0000-1000-8000-00805f9b34fb` | Main telemetry service | LOW | Common Chinese OEM pattern |
| `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | Nordic UART Service (NUS) | LOW | Common BLE stack default |

## Characteristics

| Service UUID | Char UUID | Properties | Description | Confidence |
|---|---|---|---|---|
| fff0 | `0000fff1-...` | NOTIFY | Bike → App telemetry | LOW |
| fff0 | `0000fff2-...` | WRITE | App → Bike commands | LOW |
| NUS | `6e400002-...` | WRITE NO RESPONSE | NUS RX | LOW |
| NUS | `6e400003-...` | NOTIFY | NUS TX | LOW |

## Next Steps

1. Run `tools/apk-analysis/scripts/extract-uuids.sh` after jadx decompile
2. Capture btsnoop_hci.log during bike connection session
3. Update this file with confirmed UUIDs
4. Update `packages/ble-protocol/src/uuids.ts`
