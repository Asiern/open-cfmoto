export const CLOUD_CONFIG = {
  APP_ID: 'rRrIs3ID',
  APP_SECRET: '6c1936f85ecb23508c02ceb7a6e3fd0e33eb8bd2',
  BASE_URL: 'https://tapi.cfmoto-oversea.com/v1.0',
  ENDPOINTS: {
    LOGIN: '/fuel-user/serveruser/app/auth/user/login',
    VEHICLE_BY_ID: '/fuel-vehicle/servervehicle/app/vehicle',
  },
  SIGN_TYPE: '0',
  NONCE_LENGTH: 8,
} as const;

export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
} as const;
