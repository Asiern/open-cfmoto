const envBaseUrl =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_CLOUD_BASE_URL ??
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.CLOUD_BASE_URL;
const envAppInfo =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_CLOUD_APP_INFO ??
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.CLOUD_APP_INFO;
const envUserAgent =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_CLOUD_USER_AGENT ??
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.CLOUD_USER_AGENT;

export const CLOUD_CONFIG = {
  APP_ID: 'rRrIs3ID',
  APP_SECRET: '6c1936f85ecb23508c02ceb7a6e3fd0e33eb8bd2',
  BASE_URL: (envBaseUrl?.trim().replace(/\/$/, '') || 'https://tapi.cfmoto-oversea.com/v1.0'),
  ENDPOINTS: {
    LOGIN: '/fuel-user/serveruser/app/auth/user/login_by_idcard',
    VEHICLE_BY_ID: '/fuel-vehicle/servervehicle/app/vehicle',
    VEHICLES_MINE: '/fuel-vehicle/servervehicle/app/vehicle/mine',
    USER_INFO: '/fuel-user/serveruser/app/auth/user/user_info',
    UPDATE_INFO: '/fuel-user/serveruser/app/auth/user/update_info',
    UPDATE_AREA_NO: '/fuel-user/serveruser/app/auth/user/updateUserAreaNo',
    RIDE_HISTORY_LIST: '/fuel-vehicle/servervehicle/app/ridehistory/list_v2',
    RIDE_HISTORY: '/fuel-vehicle/servervehicle/app/ridehistory',
    REGISTER: '/fuel-user/serveruser/app/auth/user/register',
    SEND_CODE: '/fuel-user/serveruser/common/code/send_code',
    CHECK_CODE: '/fuel-user/serveruser/common/code/check_code',
    UPDATE_PASSWORD: '/fuel-user/serveruser/app/auth/user/update_password',
    RIDE_REPORT: '/fuel-vehicle/servervehicle/app/ride/report',
    RIDE_REPORT_MONTH: '/fuel-vehicle/servervehicle/app/ride/report/list/month',
    RIDE_TOTAL_MILE: '/fuel-vehicle/servervehicle/app/ride/TotalRideMile/get',
    SETTING_GET: '/fuel-vehicle/servervehicle/app/setting',
    VEHICLE_FUNCS_COMPAT_ELE_V2: '/fuel-vehicle/servervehicle/app/vehicle/set/list/compatibility/ele-v2',
    ALARM_COMPAT_ELE: '/fuel-vehicle/servervehicle/app/setting/alarm/compatibility/ele',
    OTA_CHECK: '/fuel-vehicle/servervehicle/app/ota/check',
    OTA_DETAIL: '/fuel-vehicle/servervehicle/app/ota',
    REMOTE_UNLOCK: '/fuel-vehicle/servervehicle/app/vehicle/state/remote/unlock',
    FLASH_HORN: '/fuel-vehicle/servervehicle/app/vehicle/state/flash/horn',
    KL15: '/fuel-vehicle/servervehicle/app/vehicle/state/vehicle/kl15',
    ELECTRIC_FENCE_LIST: '/fuel-vehicle/servervehicle/app/electricFence/list',
    ELECTRIC_FENCE: '/fuel-vehicle/servervehicle/app/electricFence',
    ALARM_MESSAGE_LIST: '/fuel-vehicle/servervehicle/app/alarm/messagerecord',
    ALARM_MESSAGE_MARK_READ: '/fuel-vehicle/servervehicle/app/alarm/messagerecord/mark_read/v1',
    ALARM_MESSAGE_DELETE: '/fuel-vehicle/servervehicle/app/alarm/messagerecord/delete',
    ALARM_MESSAGE_CLEAR: '/fuel-vehicle/servervehicle/app/alarm/messagerecord/clear/v1',
  },
  SIGN_TYPE: '0',
  NONCE_LENGTH: 16,
  VIRTUAL_VEHICLE_TOKEN: 'cfmoto_virtual_vehicle_token',
  DEFAULT_AREA_NO: '',
} as const;

export const COMMON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
} as const;

export function resolveZoneId(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz || 'UTC';
}

export function resolveLangHeader(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  return locale.replace('-', '_');
}

export function resolveAppInfoHeader(): string {
  if (envAppInfo?.trim()) {
    return envAppInfo.trim();
  }
  return 'MOBILE|Android|16|CFMOTO_INTERNATIONAL_APP|2.2.5';
}

export function resolveUserAgentHeader(): string {
  if (envUserAgent?.trim()) {
    return envUserAgent.trim();
  }
  return resolveAppInfoHeader();
}

export function resolveAreaNo(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  const normalized = locale.replace('_', '-');
  const region = normalized.includes('-') ? normalized.split('-')[1] : '';
  if (region && /^[a-z]{2}$/i.test(region)) {
    return region.toUpperCase();
  }
  return CLOUD_CONFIG.DEFAULT_AREA_NO;
}
