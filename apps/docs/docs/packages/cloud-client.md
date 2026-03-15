# `@open-cfmoto/cloud-client` API

Typed TypeScript client for CFMoto cloud endpoints (`tapi.cfmoto-oversea.com`).

## Exports

Package entrypoint re-exports:

- config + signing utilities
- `CloudAuthClient`
- `VehicleClient`
- `UserClient`
- `AccountClient`
- `RideClient`
- `StatsClient`
- `AlertClient`
- `FenceClient`
- `CommandClient`
- `OtaClient`
- `SettingsClient`
- all request/response types from `types.ts`

Source: `packages/cloud-client/src/index.ts`

## Quick start

```ts
import { CloudAuthClient, VehicleClient, RideClient } from '@open-cfmoto/cloud-client';

const auth = new CloudAuthClient();
const token = await auth.login('user@example.com', 'plain-or-md5-password');

const vehicle = new VehicleClient();
const vehicles = await vehicle.getVehicles(token);

const rides = new RideClient();
const list = await rides.listRides(token, {
  vehicleId: vehicles[0]?.vehicleId ?? '',
  pageStart: 1,
  pageSize: 20,
});
```

## Shared behavior

- All clients throw `CloudAuthError` on:
  - non-2xx HTTP
  - cloud payload error code (`code` not `0/200` or `success=false`)
  - invalid/missing JSON contracts
- Auth and signature headers are generated with `buildSignedHeaders(...)`.
- Locale/timezone headers are auto-set (`lang`, `ZoneId`).

## Client reference

### `CloudAuthClient`

- `login(username, password): Promise<string>`
  - `POST /auth/user/login_by_idcard`
  - returns bearer token and caches it internally
- `refreshToken(token): Promise<string>`
  - no refresh endpoint available (throws)
- `getToken(): string | null`
- `getUserId(): string | null`

### `VehicleClient`

- `getVehicleDetail(vehicleId, token, userId?): Promise<VehicleNowInfoData>`
  - `GET /vehicle?vehicleId=...`
- `getEncryptInfo(vehicleId, token, userId?): Promise<EncryptInfo>`
  - extracts `encryptInfo` required for BLE auth flow
- `getVehicles(token): Promise<UserVehicle[]>`
  - `GET /vehicle/mine?position=2`
- `getUserVehicles(token, userId?, position=1): Promise<UserVehicle[]>`
  - compatibility overload

### `UserClient`

- `getProfile(token): Promise<UserProfile>`
  - `GET /auth/user/user_info`
- `updateProfile(token, req): Promise<UserProfile>`
  - `PUT /auth/user/update_info`
- `updateAreaNo(token, areaNo): Promise<void>`
  - `POST /auth/user/updateUserAreaNo`

### `AccountClient`

- `register(req): Promise<RegisterResult>`
  - `POST /auth/user/register`
  - plaintext password is MD5-normalized before sending
- `sendCode(req): Promise<void>`
  - `POST /common/code/send_code`
- `checkCode(req): Promise<void>`
  - `POST /common/code/check_code`
- `updatePassword(token, req): Promise<void>`
  - `POST /auth/user/update_password`

### `RideClient`

- `listRides(token, params): Promise<RideHistoryItem[]>`
  - `GET /ridehistory/list_v2`
- `getRide(token, id, month): Promise<RideHistoryDetail>`
  - `GET /ridehistory?id=...&month=yyyy-MM`
- `deleteRide(token, id): Promise<void>`
  - `DELETE /ridehistory/{id}`

### `StatsClient`

- `getRideReport(token, vehicleId, date): Promise<RideReport>`
  - `GET /ride/report?vehicleId=...&date=yyyy-MM-dd`
- `getMonthRideData(token, vehicleId, month): Promise<MonthRideData>`
  - `GET /ride/report/list/month?vehicleId=...&month=yyyy-MM`
- `getTotalRideMile(token, vehicleId): Promise<TotalRideMile>`
  - `GET /ride/TotalRideMile/get?vehicleId=...`

### `AlertClient`

- `listAlerts(token, params?): Promise<AlarmMessage[]>`
  - `GET /alarm/messagerecord`
- `markRead(token, typeList): Promise<void>`
  - `PUT /alarm/messagerecord/mark_read/v1`
- `deleteAlert(token, id): Promise<void>`
  - `DELETE /alarm/messagerecord/delete/{id}`
- `clearAlerts(token, typeList): Promise<void>`
  - `PUT /alarm/messagerecord/clear/v1`

### `FenceClient`

- `listFences(token, vehicleId): Promise<ElectricFence[]>`
  - `GET /electricFence/list?vehicleId=...`
- `createFence(token, req): Promise<ElectricFence>`
  - `POST /electricFence`
- `deleteFence(token, id): Promise<void>`
  - `DELETE /electricFence/{id}`

### `CommandClient`

- `remoteUnlock(token, vin): Promise<void>`
  - `POST /vehicle/state/remote/unlock`
  - VIN is encrypted as `secret` via AES-256-ECB/PKCS7 (APK-compatible)
- `flashHorn(token, vehicleId): Promise<void>`
  - `POST /vehicle/state/flash/horn`
- `getKl15(token, vin): Promise<boolean>`
  - `POST /vehicle/state/vehicle/kl15`

### `OtaClient`

- `checkUpdates(token, deviceId): Promise<VehicleUpdateBean[]>`
  - `GET /ota/check?deviceId=...`
- `getOtaDetail(token, deviceId): Promise<OtaDetail>`
  - `GET /ota?deviceId=...`

### `SettingsClient`

- `getSettings(token): Promise<AppUnitSetResp>`
  - `GET /setting`
- `getVehicleFuncCompatibility(token, deviceId): Promise<VehicleFunResp[]>`
  - `GET /vehicle/set/list/compatibility/ele-v2?deviceId=...`
- `getAlarmCompatibility(token): Promise<AlarmSetting>`
  - `GET /setting/alarm/compatibility/ele`
- `updateAlarmCompatibility(token, alarmSetting): Promise<void>`
  - `PUT /setting/alarm/compatibility/ele`

## Useful types

Most-used contracts from `types.ts`:

- Auth: `LoginResponse`, `TokenInfo`, `CloudAuthError`
- Vehicle: `VehicleNowInfoData`, `UserVehicle`, `EncryptInfo`
- Ride: `RideHistoryItem`, `RideHistoryDetail`, `RideReport`, `MonthRideData`
- Alerts/Fence/OTA/Settings:
  - `AlarmMessage`, `ElectricFence`, `VehicleUpdateBean`, `AlarmSetting`

## Files

- Source: `packages/cloud-client/src`
- Tests: `packages/cloud-client/src/__tests__`
