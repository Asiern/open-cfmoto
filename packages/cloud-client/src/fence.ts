import { CLOUD_CONFIG, COMMON_HEADERS, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CloudAuthError,
  CloudErrorPayload,
  CreateElectricFenceRequest,
  ElectricFence,
  ElectricFenceListResponse,
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

export class FenceClient {
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

  private buildBodyHeaders(token: string, body: object): Headers {
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', COMMON_HEADERS['Content-Type']);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  private buildDeleteHeaders(token: string): Headers {
    const signed = buildSignedHeaders({}, undefined, {});
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  /**
   * GET /electricFence/list?vehicleId=<vehicleId>
   * Returns all electric fences for a vehicle.
   * Source: VehicleService.java lines 180-181 (official-v126-2.2.5)
   */
  async listFences(token: string, vehicleId: string): Promise<ElectricFence[]> {
    const query = { vehicleId };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ELECTRIC_FENCE_LIST)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: ElectricFenceListResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as ElectricFenceListResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Electric fence list request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Electric fence list request rejected');
    }

    const data = (payload as ElectricFenceListResponse).data;
    if (!Array.isArray(data)) {
      throw new CloudAuthError('Electric fence list response missing data array', {
        status: resp.status,
        details: payload,
      });
    }

    return data;
  }

  /**
   * POST /electricFence
   * Creates a new electric fence for a vehicle.
   * Source: VehicleService.java line 113 (official-v126-2.2.5)
   */
  async createFence(token: string, req: CreateElectricFenceRequest): Promise<ElectricFence> {
    const body = { ...req };
    const headers = this.buildBodyHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ELECTRIC_FENCE);

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    let payload: { code: number | string; data: ElectricFence } & CloudErrorPayload;
    try {
      payload = (await resp.json()) as typeof payload;
    } catch {
      throw new CloudAuthError('Create electric fence request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Create electric fence request rejected');
    }

    return payload.data;
  }

  /**
   * DELETE /electricFence/{id}
   * Deletes an electric fence by id.
   * Source: VehicleService.java line 144 (official-v126-2.2.5)
   */
  async deleteFence(token: string, id: string): Promise<void> {
    const headers = this.buildDeleteHeaders(token);
    const url = joinUrl(
      this.baseUrl,
      `${CLOUD_CONFIG.ENDPOINTS.ELECTRIC_FENCE}/${encodeURIComponent(id)}`,
    );

    const resp = await fetch(url, { method: 'DELETE', headers });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Delete electric fence request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Delete electric fence request rejected');
    }
  }
}
