import { CLOUD_CONFIG, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CloudAuthError,
  CloudErrorPayload,
  OtaCheckResponse,
  OtaDetail,
  OtaDetailResponse,
  VehicleUpdateBean,
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

export class OtaClient {
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

  /**
   * GET /ota/check?deviceId=<deviceId>
   * Returns pending firmware update entries for a device.
   * Source: VehicleService.java — BaseResp<ArrayList<VehicleUpdateBean>>
   */
  async checkUpdates(token: string, deviceId: string): Promise<VehicleUpdateBean[]> {
    const query = { deviceId };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.OTA_CHECK)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: OtaCheckResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as OtaCheckResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('OTA check request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'OTA check request rejected');
    }

    const data = (payload as OtaCheckResponse).data;
    if (!Array.isArray(data)) {
      throw new CloudAuthError('OTA check response missing data array', {
        status: resp.status,
        details: payload,
      });
    }

    return data;
  }

  /**
   * GET /ota?deviceId=<deviceId>
   * Returns OTA detail for a device including version, status, and scheduling info.
   * Source: VehicleService.java — BaseResp<OtaDetailRsp>
   */
  async getOtaDetail(token: string, deviceId: string): Promise<OtaDetail> {
    const query = { deviceId };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.OTA_DETAIL)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: OtaDetailResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as OtaDetailResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('OTA detail request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'OTA detail request rejected');
    }

    return (payload as OtaDetailResponse).data;
  }
}
