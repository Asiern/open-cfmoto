import { CLOUD_CONFIG, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CloudAuthError,
  CloudErrorPayload,
  MonthRideData,
  MonthRideDataResponse,
  RideReport,
  RideReportResponse,
  TotalRideMile,
  TotalRideMileResponse,
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

export class StatsClient {
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
   * GET /ride/report
   * Returns the driving score report for a vehicle on a given date.
   * @param date - Format yyyy-MM-dd
   */
  async getRideReport(token: string, vehicleId: string, date: string): Promise<RideReport> {
    const query = { vehicleId, date };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.RIDE_REPORT)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: RideReportResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as RideReportResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Ride report request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Ride report request rejected');
    }

    return (payload as RideReportResponse).data;
  }

  /**
   * GET /ride/report/list/month
   * Returns per-day ride data for a vehicle in a given month.
   * @param month - Format yyyy-MM
   */
  async getMonthRideData(token: string, vehicleId: string, month: string): Promise<MonthRideData> {
    const query = { vehicleId, month };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.RIDE_REPORT_MONTH)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: MonthRideDataResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as MonthRideDataResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Month ride data request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Month ride data request rejected');
    }

    return (payload as MonthRideDataResponse).data;
  }

  /**
   * GET /ride/TotalRideMile/get
   * Returns the total accumulated mileage for a vehicle.
   */
  async getTotalRideMile(token: string, vehicleId: string): Promise<TotalRideMile> {
    const query = { vehicleId };
    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.RIDE_TOTAL_MILE)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: TotalRideMileResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as TotalRideMileResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Total ride mile request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Total ride mile request rejected');
    }

    return (payload as TotalRideMileResponse).data;
  }
}
