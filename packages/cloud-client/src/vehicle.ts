import { CLOUD_CONFIG, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import { CloudAuthError, CloudErrorPayload, EncryptInfo, VehicleNowInfoResp } from './types';

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function isApiError(resp: Response, payload: CloudErrorPayload): boolean {
  if (!resp.ok) {
    return true;
  }
  if (typeof payload.code === 'number' && payload.code !== 0 && payload.code !== 200) {
    return true;
  }
  if (typeof payload.code === 'string' && payload.code !== '0' && payload.code !== '200') {
    return true;
  }
  if (typeof payload.success === 'boolean' && payload.success === false) {
    return true;
  }
  return false;
}

export class VehicleClient {
  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  async getEncryptInfo(vehicleId: string, token: string, userId?: string | null): Promise<EncryptInfo> {
    const signed = buildSignedHeaders({}, undefined, { queryParams: { vehicleId } });
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('user_id', userId ?? '');
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());

    const path = `${CLOUD_CONFIG.ENDPOINTS.VEHICLE_BY_ID}?vehicleId=${encodeURIComponent(vehicleId)}`;
    const url = joinUrl(this.baseUrl, path);

    const resp = await fetch(url, {
      method: 'GET',
      headers,
    });

    let payload: VehicleNowInfoResp | CloudErrorPayload;
    try {
      payload = (await resp.json()) as VehicleNowInfoResp | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Vehicle request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      const message = payload.msg ?? payload.message ?? 'Vehicle lookup rejected';
      throw new CloudAuthError(message, {
        code: typeof payload.code === 'number' ? payload.code : undefined,
        codeText: typeof payload.code === 'string' ? payload.code : undefined,
        status: resp.status,
        details: payload,
      });
    }

    const vehiclePayload = payload as VehicleNowInfoResp;
    const encryptInfo =
      vehiclePayload.data?.encryptInfo ?? vehiclePayload.data?.vehicleInfo?.encryptInfo;
    if (!encryptInfo?.encryptValue || !encryptInfo?.key || typeof encryptInfo.iv !== 'string') {
      throw new CloudAuthError('Vehicle response missing encryptInfo fields', {
        status: resp.status,
        details: payload,
      });
    }

    return {
      encryptValue: encryptInfo.encryptValue,
      key: encryptInfo.key,
      iv: encryptInfo.iv,
    };
  }
}
