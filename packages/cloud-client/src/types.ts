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

// ─── Driving Score / Statistics ──────────────────────────────────────────────

/**
 * Driving score report returned by GET /ride/report.
 * Sourced from RideReportResp.java in APK decompilation.
 */
export interface RideReport {
  /** Total composite driving score */
  scoreTotal?: number;
  /** Score for speed control */
  scoreMaxSpeed?: number;
  /** Score for mileage efficiency */
  scoreMileage?: number;
  /** Score for acceleration behaviour */
  scoreRapidAcceleration?: number;
  /** Score for deceleration behaviour */
  scoreRapidDeceleration?: number;
  /** Score for turning behaviour */
  scoreTurn?: number;
  /** Score for driving duration */
  scoreDriveSeconds?: number;
  /** Percentage related to max speed */
  percentMaxSpeed?: number;
  /** Percentage of mileage metric */
  percentMileage?: number;
  /** Percentage of rapid-acceleration events */
  percentRapidAcceleration?: number;
  /** Percentage of rapid-deceleration events */
  percentRapidDeceleration?: number;
  /** Percentage of rapid-turn events */
  percentRapidTurn?: number;
  /** Percentage of drive time */
  percentDriveSeconds?: number;
  /** Maximum speed recorded */
  maxSpeed?: number;
  /** Average daily ride mileage */
  avgRideMileageDay?: number;
  /** Monthly ride mileage */
  rideMileageMonth?: number;
  /** Monthly riding time (fractional hours or minutes depending on server) */
  ridingTimeMonth?: number;
  /** Monthly riding time in seconds (string form) */
  ridingTimeMonthSeconds?: string;
  /** Rapid-acceleration event count for the month */
  accelerationTimesMonth?: string;
  /** Hard-braking event count for the month */
  brakesTimesMonth?: string;
  /** Sharp-turn event count for the month */
  bendingTimesMonth?: string;
  /** Report generation timestamp */
  reportTime?: string;
  /** UI: description label for mileage visualization */
  mileageVisualizationDes?: string;
  /** UI: reference value for mileage visualization */
  mileageVisualizationReference?: string;
  /** UI: unit label for mileage visualization */
  mileageVisualizationUnit?: string;
  /** UI: numeric value for mileage visualization */
  mileageVisualizationValue?: number;
  /** UI: action verb for mileage visualization */
  mileageVisualizationVerb?: string;
  [key: string]: unknown;
}

export interface RideReportResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: RideReport;
  success?: boolean;
  [key: string]: unknown;
}

/**
 * Per-day ride data entry within a monthly summary.
 * Sourced from RideDataBean.java in APK decompilation.
 */
export interface RideDayData {
  /** Report date as Unix timestamp (ms) */
  reportTime?: number;
  rideMileage?: number;
  /** Riding time (fractional hours or minutes) */
  ridingTime?: number;
  /** Riding time in seconds (string form) */
  ridingTimeSeconds?: string;
  maxSpeed?: number;
  /** Rapid-acceleration event count */
  accelerationTimes?: number;
  /** Hard-braking event count */
  brakesTimes?: number;
  /** Sharp-turn event count */
  bendingTimes?: number;
  powerConsumption?: string;
  [key: string]: unknown;
}

/**
 * Monthly ride data summary returned by GET /ride/report/list/month.
 * Sourced from RideDataResp.java in APK decompilation.
 */
export interface MonthRideData {
  /** Month timestamp */
  date?: number;
  /** Total mileage for the month */
  rideMileage?: number;
  /** Per-day breakdown */
  list?: RideDayData[];
  [key: string]: unknown;
}

export interface MonthRideDataResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: MonthRideData;
  success?: boolean;
  [key: string]: unknown;
}

/**
 * Total mileage data returned by GET /ride/TotalRideMile/get.
 * Sourced from NavMileageData.java in APK decompilation.
 */
export interface TotalRideMile {
  /** Accumulated total ride mileage (string, unit depends on server config) */
  totalRideMile?: string;
  /** True when the server has detected an abnormal mileage value */
  abnormalValue?: boolean;
  /** K-line chart indicator */
  isKline?: boolean;
  [key: string]: unknown;
}

export interface TotalRideMileResponse {
  code: number | string;
  msg?: string;
  message?: string;
  data: TotalRideMile;
  success?: boolean;
  [key: string]: unknown;
}
