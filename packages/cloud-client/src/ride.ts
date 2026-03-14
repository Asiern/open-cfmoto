import { CLOUD_CONFIG, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CloudAuthError,
  CloudErrorPayload,
  RideHistoryDetail,
  RideHistoryDetailResponse,
  RideHistoryItem,
  RideHistoryListParams,
  RideHistoryListResponse,
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

function buildError(resp: Response, payload: CloudErrorPayload, fallback: string): CloudAuthError {
  const message = payload.msg ?? payload.message ?? fallback;
  return new CloudAuthError(message, {
    code: typeof payload.code === 'number' ? payload.code : undefined,
    codeText: typeof payload.code === 'string' ? payload.code : undefined,
    status: resp.status,
    details: payload,
  });
}

export class RideClient {
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

  private buildDeleteHeaders(token: string): Headers {
    const signed = buildSignedHeaders({}, undefined, {});
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  /**
   * GET /ridehistory/list_v2
   * Returns paginated list of rides for a vehicle. Page is 1-indexed.
   */
  async listRides(token: string, params: RideHistoryListParams): Promise<RideHistoryItem[]> {
    const query: Record<string, string> = {
      vehicleId: params.vehicleId,
      pageStart: String(params.pageStart ?? 1),
      pageSize: String(params.pageSize ?? 20),
    };
    if (params.startDate) query.startDate = params.startDate;
    if (params.endDate) query.endDate = params.endDate;
    if (params.startPositionName) query.startPositionName = params.startPositionName;

    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.RIDE_HISTORY_LIST)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: RideHistoryListResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as RideHistoryListResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Ride history list request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Ride history list request rejected');
    }

    const data = (payload as RideHistoryListResponse).data;
    if (!Array.isArray(data)) {
      throw new CloudAuthError('Ride history list response missing data array', {
        status: resp.status,
        details: payload,
      });
    }

    return data;
  }

  /**
   * GET /ridehistory?id=<id>&month=<month>
   * `month` is required by the API to partition the query (format: yyyy-MM).
   */
  async getRide(token: string, id: string, month: string): Promise<RideHistoryDetail> {
    const query = { id, month };
    const headers = this.buildGetHeaders(token, query);
    const qs = new URLSearchParams(query).toString();
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.RIDE_HISTORY)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: RideHistoryDetailResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as RideHistoryDetailResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Ride history detail request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Ride history detail request rejected');
    }

    return (payload as RideHistoryDetailResponse).data;
  }

  /**
   * DELETE /ridehistory/{id}
   */
  async deleteRide(token: string, id: string): Promise<void> {
    const headers = this.buildDeleteHeaders(token);
    const url = joinUrl(this.baseUrl, `${CLOUD_CONFIG.ENDPOINTS.RIDE_HISTORY}/${encodeURIComponent(id)}`);

    const resp = await fetch(url, { method: 'DELETE', headers });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Delete ride request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Delete ride request rejected');
    }
  }
}
