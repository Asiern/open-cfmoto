# GATT Services — CFMoto App

**Status: CONFIRMED from jadx decompilation. All values extracted directly from source.**

See `ble-protocol.md` for full details. This file is a quick-reference summary.

---

## Primary TBox Service (450-series motorcycles)

| Role | UUID |
|------|------|
| Service | `0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |
| Write Characteristic | `0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |
| Notify Characteristic | `0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |

Source: `BleConstant.java` (SERVICE_UUID, CHARACTERISTIC_UUID_WRITE, CHARACTERISTIC_UUID_NOTIFY)

## Navigation/HUD Service

| Role | UUID |
|------|------|
| Service | `0000B360-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |
| Characteristic | `0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |

Source: `BleNaviModule.java`, `Cf110Utils.SERVICE_Cmd_UUID`

## CF110 Child Bike Services

| Role | UUID |
|------|------|
| Auth Service | `0000b358-d6d8-c7ec-bdf0-eab1bfc6bcbc` |
| Auth Characteristic | `0000b360-d6d8-c7ec-bdf0-eab1bfc6bcbc` |
| Cmd Service | `0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |
| Cmd Characteristic | `0000B364-D6D8-C7EC-BDF0-EAB1BFC6BCBC` |

Source: `Cf110Utils.java`

## HH40 Child Bike Services

| Role | UUID |
|------|------|
| SPP Service | `0783b03e-8535-b5a0-7140-a304d2495cb7` |
| Notify Characteristic | `0783b03e-8535-b5a0-7140-a304d2495cb8` |
| Write Characteristic | `0783b03e-8535-b5a0-7140-a304d2495cba` |
| AT Characteristic | `0000fff6-0000-1000-8000-00805f9b34fb` |

Source: `HH40Utils.java`
