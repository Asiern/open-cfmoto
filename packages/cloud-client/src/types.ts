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

export interface GeoLocation {
  lat?: number;
  lon?: number;
  speed?: number;
  altitude?: number;
  [key: string]: unknown;
}

/**
 * Response data from GET /fuel-vehicle/servervehicle/app/vehicle?vehicleId=<id>
 * Fields sourced from VehicleNowInfoResp.java in APK decompilation.
 */
export interface VehicleNowInfoData {
  // Identity
  vehicleId?: string;
  btMac?: string;
  vin?: string;
  // BLE auth keys (may be absent for virtual/non-TBox vehicles)
  encryptInfo?: EncryptInfo;
  vehicleInfo?: VehicleInfo;
  // Connectivity
  isOnline?: boolean;
  deviceState?: string;
  vehicleState?: string;
  tboxIsActive?: boolean | null;
  supportRemoteUnlock?: boolean;
  // Ignition & lock states (string values from TBox, e.g. "0"/"1")
  kl?: string;
  batteryLockState?: string;
  headLockState?: string;
  seatLockState?: string;
  oilLockState?: string;
  vcuLockState?: boolean;
  // Telemetry / ride stats
  speed?: string;
  totalRideMile?: string;
  rideMileageMonth?: string;
  bmsSoc?: string;
  chargeState?: string;
  remainingOil?: string;
  remainingOilStr?: string;
  // Location
  geoLocation?: GeoLocation;
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

/**
 * User profile data from GET /auth/user/user_info and PUT /auth/user/update_info.
 * Fields sourced from LoginBean.java in APK decompilation.
 */
export interface UserProfile {
  userId?: string;
  nickName?: string;
  firstName?: string;
  lastName?: string;
  realName?: string;
  email?: string;
  phone?: string;
  photo?: string;
  /** 0 = unknown, 1 = male, 2 = female (APK default: 2) */
  gender?: number;
  /** Unix timestamp in ms */
  birthday?: number;
  areaCode?: string;
  areaNo?: string;
  region?: string;
  noticeEnabled?: number;
  isDealer?: boolean;
  isVip?: number;
  cancelStatus?: number;
  [key: string]: unknown;
}

export interface UserProfileResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: UserProfile;
  success?: boolean;
  [key: string]: unknown;
}

/**
 * Request body for PUT /auth/user/update_info.
 * Fields sourced from UpdateUserInfoReq.java in APK decompilation.
 */
/**
 * Request body for POST /auth/user/register.
 * Sourced from RegisteReq.java + BaseAccountReq.java in APK decompilation.
 * `password` is accepted as plaintext and MD5-hashed before sending.
 */
/**
 * Single ride entry returned by GET /ridehistory/list_v2.
 * Sourced from HistoryTravelResp.java in APK decompilation.
 */
export interface RideHistoryItem {
  id: string;
  /** Unix timestamp ms */
  startTime: number;
  /** Unix timestamp ms */
  endTime: number;
  startAddr?: string;
  endAddr?: string;
  /** Trip distance */
  rideMileage: number;
  /** Trip duration (int seconds in list view) */
  ridingTime: number;
  maxSpeed: number;
  accelerationTimes: number;
  bendingTimes: number;
  brakesTimes: number;
  /** Date bucket for grouping, format yyyy-MM-dd */
  dayTime?: string;
  /** Sum of mileage for the day this ride belongs to */
  dayRideMileage?: number;
  /** Running total mileage across all rides */
  totalRideMileage?: number;
  trajectory?: string;
  trajectoryImageUrl?: string;
  trackThumbnailsUrl?: string;
  virtualTrackImage?: string;
  powerConsumption?: string;
  [key: string]: unknown;
}

/**
 * Full ride detail returned by GET /ridehistory?id=<id>&month=<month>.
 * Sourced from RideHistoryDetail.java in APK decompilation.
 */
export interface RideHistoryDetail {
  id?: string;
  /** Unix timestamp ms */
  startTime?: number;
  /** Unix timestamp ms */
  endTime?: number;
  startAddr?: string;
  endAddr?: string;
  rideMileage?: number;
  /** Fractional seconds/hours depending on server version */
  ridingTime?: number;
  ridingTimeSeconds?: string;
  maxSpeed?: number;
  accelerationTimes?: number;
  bendingTimes?: number;
  brakesTimes?: number;
  /** GeoJSON LineString or encoded polyline */
  trajectory?: string;
  virtualTrackImage?: string;
  [key: string]: unknown;
}

export interface RideHistoryListResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: RideHistoryItem[];
  success?: boolean;
  [key: string]: unknown;
}

export interface RideHistoryDetailResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: RideHistoryDetail;
  success?: boolean;
  [key: string]: unknown;
}

/**
 * Query parameters for GET /ridehistory/list_v2.
 * Sourced from RideHistoryReq.java in APK decompilation.
 */
export interface RideHistoryListParams {
  vehicleId: string;
  /** 1-indexed page number, default 1 */
  pageStart?: number;
  /** Items per page, default 20 */
  pageSize?: number;
  /** Filter start date, format yyyy-MM-dd */
  startDate?: string;
  /** Filter end date, format yyyy-MM-dd */
  endDate?: string;
  startPositionName?: string;
}

export interface RegisterRequest {
  /** Email address or phone number */
  idcard: string;
  /** Accepted as plaintext — MD5-hashed before the network request is made. */
  password: string;
  /** SMS or email verification code obtained via sendCode() */
  verifyCode: string;
  /** Country dial code, e.g. '+34' */
  areaCode?: string;
  /** ISO region code, e.g. 'ES' */
  areaNo?: string;
  emailMarketingAlarm?: boolean;
}

export interface RegisterResult {
  token: string;
  userId?: string;
  profile: UserProfile;
}

/**
 * Request body for POST /common/code/send_code.
 * Sourced from BaseAccountReq.java in APK decompilation.
 */
export interface SendCodeRequest {
  /** Email address or phone number */
  idcard: string;
  areaCode?: string;
  areaNo?: string;
}

/**
 * Request body for POST /common/code/check_code.
 * Sourced from BaseAccountReq.java in APK decompilation.
 */
export interface CheckCodeRequest {
  /** Email address or phone number */
  idcard: string;
  /** Code received via SMS or email */
  verifyCode: string;
  areaCode?: string;
  areaNo?: string;
}

/**
 * Request body for POST /auth/user/update_password.
 * Sourced from UpdatePswReq.java in APK decompilation.
 * Both passwords are accepted as plaintext and MD5-hashed before sending.
 */
export interface UpdatePasswordRequest {
  /** Current password — MD5-hashed before sending, not persisted. */
  oldPassword: string;
  /** New password — MD5-hashed before sending, not persisted. */
  newPassword: string;
}

export interface UpdateUserInfoRequest {
  nickName?: string;
  firstName?: string;
  lastName?: string;
  realName?: string;
  email?: string;
  phone?: string;
  photo?: string;
  gender?: number;
  birthday?: number;
  noticeEnabled?: number;
}
