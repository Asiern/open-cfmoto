import { CLOUD_CONFIG, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CloudAuthError,
  CloudErrorPayload,
  EncryptInfo,
  UserVehicle,
  UserVehiclesResponse,
  VehicleNowInfoData,
  VehicleNowInfoResp,
} from './types';

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

  private buildCommonGetHeaders(
    token: string,
    userId: string | null | undefined,
    queryParams: Record<string, string>,
  ): Headers {
    const signed = buildSignedHeaders({}, undefined, { queryParams });
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('user_id', userId ?? '');
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  private async fetchVehicleNowInfo(
    vehicleId: string,
    token: string,
    userId?: string | null,
  ): Promise<VehicleNowInfoData> {
    const headers = this.buildCommonGetHeaders(token, userId, { vehicleId });
    const path = `${CLOUD_CONFIG.ENDPOINTS.VEHICLE_BY_ID}?vehicleId=${encodeURIComponent(vehicleId)}`;
    const url = joinUrl(this.baseUrl, path);

    const resp = await fetch(url, { method: 'GET', headers });

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

    return (payload as VehicleNowInfoResp).data;
  }

  async getVehicleDetail(
    vehicleId: string,
    token: string,
    userId?: string | null,
  ): Promise<VehicleNowInfoData> {
    return this.fetchVehicleNowInfo(vehicleId, token, userId);
  }

  async getEncryptInfo(vehicleId: string, token: string, userId?: string | null): Promise<EncryptInfo> {
    const data = await this.fetchVehicleNowInfo(vehicleId, token, userId);
    const encryptInfo = data.encryptInfo ?? data.vehicleInfo?.encryptInfo;
    if (!encryptInfo?.encryptValue || !encryptInfo?.key || typeof encryptInfo.iv !== 'string') {
      throw new CloudAuthError('Vehicle response missing encryptInfo fields', {
        details: data,
      });
    }
    return {
      encryptValue: encryptInfo.encryptValue,
      key: encryptInfo.key,
      iv: encryptInfo.iv,
    };
  }

  private async fetchVehicleList(
    token: string,
    userId: string | null | undefined,
    position: number,
  ): Promise<UserVehicle[]> {
    const query = { position: String(position) };
    const headers = this.buildCommonGetHeaders(token, userId, query);
    const path = `${CLOUD_CONFIG.ENDPOINTS.VEHICLES_MINE}?position=${encodeURIComponent(query.position)}`;
    const url = joinUrl(this.baseUrl, path);

    const resp = await fetch(url, {
      method: 'GET',
      headers,
    });

    let payload: UserVehiclesResponse | UserVehicle[] | CloudErrorPayload;
    try {
      payload = (await resp.json()) as UserVehiclesResponse | UserVehicle[] | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('User vehicles request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (Array.isArray(payload)) {
      if (!resp.ok) {
        throw new CloudAuthError('User vehicles request failed', {
          status: resp.status,
          details: payload,
        });
      }
      return payload;
    }

    if (isApiError(resp, payload)) {
      const message = payload.msg ?? payload.message ?? 'User vehicles lookup rejected';
      throw new CloudAuthError(message, {
        code: typeof payload.code === 'number' ? payload.code : undefined,
        codeText: typeof payload.code === 'string' ? payload.code : undefined,
        status: resp.status,
        details: payload,
      });
    }

    const vehiclesPayload = payload as UserVehiclesResponse;
    if (!Array.isArray(vehiclesPayload.data)) {
      throw new CloudAuthError('User vehicles response missing data array', {
        status: resp.status,
        details: payload,
      });
    }
    return vehiclesPayload.data;
  }

  // APK uses position=2 for full vehicle list (VehicleGarageActivity, OtaActivity).
  // position=1 appears to return only the current/primary vehicle.
  async getVehicles(token: string): Promise<UserVehicle[]> {
    return this.fetchVehicleList(token, null, 2);
  }

  /**
   * @deprecated Use getVehicles() for the simple case. This overload remains
   * for callers that need to pass userId or a specific page position.
   */
  async getUserVehicles(
    token: string,
    userId?: string | null,
    position = 1,
  ): Promise<UserVehicle[]> {
    return this.fetchVehicleList(token, userId, position);
  }
}
