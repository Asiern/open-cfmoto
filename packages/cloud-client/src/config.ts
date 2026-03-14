export const CLOUD_CONFIG = {
  APP_ID: 'rRrIs3ID',
  APP_SECRET: '6c1936f85ecb23508c02ceb7a6e3fd0e33eb8bd2',
  BASE_URL: 'https://tapi.cfmoto-oversea.com/v1.0',
  ENDPOINTS: {
    LOGIN: '/fuel-user/serveruser/app/auth/user/login_by_idcard',
    VEHICLE_BY_ID: '/fuel-vehicle/servervehicle/app/vehicle',
    VEHICLES_MINE: '/fuel-vehicle/servervehicle/app/vehicle/mine',
    USER_INFO: '/fuel-user/serveruser/app/auth/user/user_info',
    UPDATE_INFO: '/fuel-user/serveruser/app/auth/user/update_info',
    UPDATE_AREA_NO: '/fuel-user/serveruser/app/auth/user/updateUserAreaNo',
    REGISTER: '/fuel-user/serveruser/app/auth/user/register',
    SEND_CODE: '/fuel-user/serveruser/common/code/send_code',
    CHECK_CODE: '/fuel-user/serveruser/common/code/check_code',
    UPDATE_PASSWORD: '/fuel-user/serveruser/app/auth/user/update_password',
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

export function resolveAreaNo(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  const normalized = locale.replace('_', '-');
  const region = normalized.includes('-') ? normalized.split('-')[1] : '';
  if (region && /^[a-z]{2}$/i.test(region)) {
    return region.toUpperCase();
  }
  return CLOUD_CONFIG.DEFAULT_AREA_NO;
}
