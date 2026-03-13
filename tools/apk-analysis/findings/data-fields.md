# Bike Data Fields — CFMoto App

**Status: CONFIRMED from jadx decompilation. Extracted from proto definitions and parsing code.**

---

## 1. TBox Telemetry — `BluetoothOuterClass.Bluetooth` Protobuf

This is the primary telemetry message used for HH40-type devices and potentially the 450-series. It is also parsed in `BleModelYouth.parseHH40()`. All fields are protobuf `int32` unless noted.

| Field Name | Proto Field# | Description | Notes |
|-----------|-------------|-------------|-------|
| `codec` | 1 | String field | Authentication/codec string |
| `sn` | 2 | String field | Serial number |
| `result` | 3 | Command result | 0 = success |
| `type` | 4 | Device/message type | Interpreted per command |
| `vin` | 5 | VIN number | |
| `speed` | 6 | Vehicle speed | Units: see `speedUnit` |
| `powerPer` | 7 | Battery percentage | 0–100% |
| `reMileage` | 8 | Remaining mileage | Units: see `mileUnit` |
| `mileage` | 9 | Total mileage / odometer | Units: see `mileUnit` |
| `batTmp` | 10 | Battery temperature | |
| `mileUnit` | 11 | Mileage unit | 0 = km, 1 = miles |
| `speedUnit` | 12 | Speed unit | |
| `value` | 13 | Generic value | Divided by 10 for speed limit |
| `dID` | 14 | Fault code DID | Diagnostic ID |
| `state` | 15 | Vehicle state | |
| `time` | 16 | Time value | |
| `distance` | 17 | Distance | |
| `call` | 18 | Call status | |
| `valid` | 19 | GPS validity | |
| `longitude` | 20 | GPS longitude | Scaled integer |
| `latitude` | 21 | GPS latitude | Scaled integer |
| `gPSRxLev` | 22 | GPS signal level | |
| `sos` | 23 | SOS status | |
| `transGearPos` | 24 | Transmission gear position | |
| `inverterActTemp` | 25 | Inverter actual temperature | |
| `motorActTemp` | 26 | Motor actual temperature | |
| `actTorq` | 27 | Actual torque | |
| `actHVCur` | 28 | HV actual current | High-voltage current |
| `actHVVolt` | 29 | HV actual voltage | High-voltage voltage |
| `serialNum` | 30 | Serial number (int) | |
| `hardwareVer` | 31 | Hardware version | |
| `softVer` | 32 | Software version | |
| `battCurr` | 33 | Battery current | |
| `battVolt` | 34 | Battery voltage | |
| `battVoltCelladd` | 35 | Battery cell voltage (address) | |
| `battSOH` | 36 | Battery state of health | |
| `tempSensorTempMaxNum` | 37 | Temp sensor max temp number | |
| `tempSensorMaxTemp` | 38 | Temp sensor maximum temp | |
| `tempSensorTempMinNum` | 39 | Temp sensor min temp number | |
| `tempSensorMinTemp` | 40 | Temp sensor minimum temp | |
| `altitude` | 41 | Altitude | |
| `angle` | 42 | Angle/heading | |
| `coordinateSystem` | 43 | GPS coordinate system | |
| `action` | 44 | Action/command | |
| `dID1` | 45 | Second fault code DID | |

---

## 2. HH40 Parsed Events

When a HH40 notification arrives (command byte `b` at `bArr[2]`), the payload is a `BluetoothOuterClass.Bluetooth` protobuf. Fields used per command:

| Command Byte | Event / Data |
|--------------|-------------|
| `1` | Vehicle type → `modelCar = from.getType()` |
| `3` | `VehicleBaseInfoYouthEvent(speed, batTmp, reMileage, mileage, powerPer)` |
| `4` | Unit settings: `mileUnit`, `speedUnit`, `value/10` = max speed |
| `5` | `HH40FaultCodeEvent(dID, dID1)` |
| `6` | `KeyInfoYouthEvent(state, time, powerPer)` |
| `10` | Vehicle over-distance reminder (SOS type 1) |
| `11` | Vehicle reminder stop (type 0) |
| `15` | GPS location: `longitude`, `latitude` → `HH40GpsEvent` |
| `-111` | Lock response: `result == 1` = success |
| `-110` | Over-distance setting reply |

---

## 3. CF110 Parsed Data

Command byte at `bArr[2]` in CF110 format, payload starts at `bArr[5]`:

### DeviceInfo (cmd = 10)

Parsed from 30-byte payload at offset `i`:

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 8 | double LE | `lat` | Latitude (IEEE 754 double, little-endian) |
| 8 | 8 | double LE | `lng` | Longitude (IEEE 754 double, little-endian) |
| 16 | 4 | float LE | `speed` | Speed (IEEE 754 float, little-endian) |
| 20 | 2 | uint16 LE | `age` | GPS age |
| 24 | 1 | uint8 | `updateId` | Update sequence ID |
| 25 | 1 | int8 | `uSize` | Number of satellites |
| 26 | 1 | int8 | `isCross` | Geo-fence status (2 = crossed) |
| 27 | 1 | int8 | `isOverSpeed` | Over-speed status |
| 28 | 1 | int8 | `rOnOffState` | Unlock state |
| 29 | 1 | int8 | `lOnOffState` | Power state |

**Limit/fence state values** for `isCross` and `isOverSpeed`:
| Value | Meaning |
|-------|---------|
| 0 | Normal |
| 1 | First alarm |
| 2 | Stop limiting |
| 3 | Temporarily running |
| 4 | GPS timeout |

### CarSettingInfo (cmd = 11)

26-byte payload:

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 8 | double LE | `lat` | Geo-fence center latitude |
| 8 | 8 | double LE | `lng` | Geo-fence center longitude |
| 16 | 4 | float LE | `speed` | Speed limit (km/h) |
| 20 | 2 | uint16 LE | `radius` | Geo-fence radius (meters / 10 for display) |
| 22 | 1 | uint8 | `alarmT` | Alarm time (seconds) |
| 23 | 1 | uint8 | `stopT` | Stop time (seconds), default 30 |
| 24 | 1 | uint8 | `runT` | Run time (seconds), default 30 |
| 25 | 1 | uint8 | `rOnOffState` | 0 = locked, 1 = unlocked |

### BleCmdResult (cmd = 14)

2-byte payload:

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 1 | uint8 | `cmd` | Command being ack'd |
| 1 | 1 | uint8 | `result` | 0 = success |

### DevVersion (cmd = 15)

(Fields not fully exposed but parsed from `DevVersion.update(bArr, i2)`)

### DevUpdateInfo (cmd = 16)

(Fields not fully exposed but parsed from `DevUpdateInfo.update(bArr, i2)`)

---

## 4. TBox Telemetry Fields (Meter.proto — non-Bluetooth)

From `Meter.java` protobuf interfaces:

### `Meter.Response`
- `success` (int)

### `Meter.KL15`
- `kL15` (int) — ignition line status

### `Meter.Navi` / `NaviOrBuilder`
- `direction` (Navi.Direction enum)
- `distance` (int)

### `Meter.Route`
- `direction` (int)
- `distance` (int)

### `Meter.Display`
Units settings:
- `distance` (DistanceUnit enum)
- `distanceValue` (int)
- `temperature` (TemperatureUnit enum)
- `temperatureValue` (int)
- `time` (TimeUnit enum)
- `timeValue` (int)
- `languageType` (LanguageType enum)
- `languageTypeValue` (int)

### `Meter.LightType` enum
| Value | Name | Description |
|-------|------|-------------|
| 0 | `NONE2` | No light operation |
| 1 | `RIGHT_OPEN` | Right turn on |
| 2 | `RIGHT_CLOSE` | Right turn off |
| 3 | `LEFT_OPEN` | Left turn on |
| 4 | `LEFT_CLOSE` | Left turn off |

---

## 5. Encoding Conventions

- **Multi-byte integers**: Little-endian (`bytes2Int`, `bytes2Int32` in `CommonTool.java`).
- **Float**: IEEE 754 little-endian (4 bytes).
- **Double**: IEEE 754 little-endian (8 bytes).
- **2-byte int read**: `(bArr[i] & 0xFF) | (bArr[i+1] << 8)` in `CommonTool.bytes2Int`.
- **4-byte int read**: similar LE pattern.
- **GPS coordinates**: stored as raw `double` (degrees), not scaled integers.
- **Speed**: raw `float` km/h (CF110 path) or raw int (HH40 protobuf path, divide by unit).
