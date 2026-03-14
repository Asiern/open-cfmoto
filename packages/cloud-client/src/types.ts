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
  vehicleId?: string;
  btMac?: string;
  encryptInfo?: EncryptInfo;
  vehicleInfo?: VehicleInfo;
  [key: string]: unknown;
}

export interface VehicleNowInfoResp {
  code: number | string;
  msg?: string;
  message?: string;
  data: VehicleNowInfoData;
  success?: boolean;
  [key: string]: unknown;
}

export interface UserVehicle {
  vehicleId?: string;
  vehicleName?: string;
  vin?: string;
  btMac?: string;
  virtualFlag?: string | number;
  isCurrent?: number | boolean;
  [key: string]: unknown;
}

export interface UserVehiclesResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: UserVehicle[];
  success?: boolean;
  [key: string]: unknown;
}

export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  [key: string]: unknown;
}

export interface LoginData {
  token?: string;
  tokenInfo?: TokenInfo;
  userId?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: LoginData;
  success?: boolean;
  [key: string]: unknown;
}

export interface CloudErrorPayload {
  code?: number | string;
  msg?: string;
  message?: string;
  success?: boolean;
  [key: string]: unknown;
}

export class CloudAuthError extends Error {
  readonly code?: number;
  readonly codeText?: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options?: { code?: number; codeText?: string; status?: number; details?: unknown },
  ) {
    super(message);
    this.name = 'CloudAuthError';
    this.code = options?.code;
    this.codeText = options?.codeText;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export interface CloudCredentials {
  username: string;
  password: string;
  vehicleId: string;
}
