import { CLOUD_CONFIG, COMMON_HEADERS, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  AlarmSetting,
  AlarmSettingResponse,
  AppUnitSetResp,
  AppUnitSetResponse,
  CloudAuthError,
  CloudErrorPayload,
  VehicleFunListResponse,
  VehicleFunResp,
} from './types';

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function isApiError(resp: Response, payload: CloudErrorPayload): boolean {
  if (!resp.ok) return true;
  if (typeof payload.code === 'number' && payload.code !== 0 && payload.code !== 200) return true;
  if (typeof payload.code === 'string' && payload.code !== '0' && payload.code !== '200') return true;
  if (typeof payload.success === 'boolean' && payload.success === false) return true;
  return false;
}

function buildError(resp: Response, payload: CloudErrorPayload, fallback: string): CloudAuthError {
  const message = payload.msg ?? payload.message ?? fallback;
  return new CloudAuthError(message, {
    code: typeof payload.code === 'number' ? payload.code : undefined,
    codeText: typeof payload.code === 'string' ? payload.code : undefined,
    status: resp.status,
    details: payload,
  });
}

export class SettingsClient {
  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  private buildGetHeaders(token: string, queryParams: Record<string, string>): Headers {
    const signed = buildSignedHeaders({}, undefined, { queryParams });
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('user_id', '');
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  private buildPutHeaders(token: string, body: object): Headers {
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', COMMON_HEADERS['Content-Type']);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  /**
   * GET /setting
   * Returns app unit/display settings.
   * Source: VehicleService.java — BaseResp<AppUnitSetResp>
   */
  async getSettings(token: string): Promise<AppUnitSetResp> {
    const headers = this.buildGetHeaders(token, {});
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.SETTING_GET);

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: AppUnitSetResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as AppUnitSetResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Get settings request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Get settings request rejected');
    }

    return (payload as AppUnitSetResponse).data;
  }

  /**
   * GET /vehicle/set/list/compatibility/ele-v2?deviceId=<deviceId>
   * Returns vehicle function/feature compatibility list for a device.
   * Source: VehicleService.java — BaseResp<ArrayList<VehicleFunResp>>
   */
  async getVehicleFuncCompatibility(token: string, deviceId: string): Promise<VehicleFunResp[]> {
    const query = { deviceId };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.VEHICLE_FUNCS_COMPAT_ELE_V2)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: VehicleFunListResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as VehicleFunListResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Vehicle func compatibility request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Vehicle func compatibility request rejected');
    }

    const data = (payload as VehicleFunListResponse).data;
    if (!Array.isArray(data)) {
      throw new CloudAuthError('Vehicle func compatibility response missing data array', {
        status: resp.status,
        details: payload,
      });
    }

    return data;
  }

  /**
   * GET /setting/alarm/compatibility/ele
   * Returns alarm/notification settings.
   * Source: UserService.java — BaseResp<AlarmSetting>
   */
  async getAlarmCompatibility(token: string): Promise<AlarmSetting> {
    const headers = this.buildGetHeaders(token, {});
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ALARM_COMPAT_ELE);

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: AlarmSettingResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as AlarmSettingResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Get alarm settings request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Get alarm settings request rejected');
    }

    return (payload as AlarmSettingResponse).data;
  }

  /**
   * PUT /setting/alarm/compatibility/ele
   * Updates alarm/notification settings.
   * Source: UserService.java — body: AlarmSetting, BaseResp<Object>
   */
  async updateAlarmCompatibility(token: string, alarmSetting: AlarmSetting): Promise<void> {
    const body = { ...alarmSetting };
    const headers = this.buildPutHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ALARM_COMPAT_ELE);

    const resp = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Update alarm settings request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Update alarm settings request rejected');
    }
  }
}
