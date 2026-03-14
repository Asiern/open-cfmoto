export interface EncryptInfo {
  encryptValue: string;
  key: string;
  /**
   * Returned by cloud API, but BLE auth uses AES/ECB.
   * Kept for completeness and potential future CBC flows.
   */
  iv: string;
}

export interface VehicleInfo {
  vehicleId?: string;
  btMac?: string;
  encryptInfo: EncryptInfo;
  [key: string]: unknown;
}

export interface VehicleNowInfoData {
  vehicleInfo: VehicleInfo;
  [key: string]: unknown;
}

export interface VehicleNowInfoResp {
  code: number;
  msg?: string;
  message?: string;
  data: VehicleNowInfoData;
  success?: boolean;
  [key: string]: unknown;
}

export interface LoginData {
  token: string;
  userId?: number | string;
  [key: string]: unknown;
}

export interface LoginResponse {
  code: number;
  msg?: string;
  message?: string;
  data: LoginData;
  success?: boolean;
  [key: string]: unknown;
}

export interface CloudErrorPayload {
  code?: number;
  msg?: string;
  message?: string;
  success?: boolean;
  [key: string]: unknown;
}

export class CloudAuthError extends Error {
  readonly code?: number;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options?: { code?: number; status?: number; details?: unknown }) {
    super(message);
    this.name = 'CloudAuthError';
    this.code = options?.code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export interface CloudCredentials {
  username: string;
  password: string;
  vehicleId: string;
}
