import { CLOUD_CONFIG, COMMON_HEADERS, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  AlarmMessage,
  AlarmMessageListParams,
  AlarmMessageListResponse,
  CloudAuthError,
  CloudErrorPayload,
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

export class AlertClient {
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

  private buildDeleteHeaders(token: string): Headers {
    const signed = buildSignedHeaders({}, undefined, {});
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  /**
   * GET /alarm/messagerecord
   * Returns a paginated list of alarm/alert messages.
   */
  async listAlerts(token: string, params: AlarmMessageListParams = {}): Promise<AlarmMessage[]> {
    const query: Record<string, string> = {
      pageStart: String(params.pageStart ?? 1),
      pageSize: String(params.pageSize ?? 20),
    };
    if (params.type) query.type = params.type;

    const qs = new URLSearchParams(query).toString();
    const headers = this.buildGetHeaders(token, query);
    const url = `${joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ALARM_MESSAGE_LIST)}?${qs}`;

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: AlarmMessageListResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as AlarmMessageListResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Alert list request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Alert list request rejected');
    }

    const data = (payload as AlarmMessageListResponse).data;
    if (!Array.isArray(data)) {
      throw new CloudAuthError('Alert list response missing data array', {
        status: resp.status,
        details: payload,
      });
    }

    return data;
  }

  /**
   * PUT /alarm/messagerecord/mark_read/v1
   * Marks all messages of the given types as read.
   * Source: VehicleService official-v126-2.2.5
   */
  async markRead(token: string, typeList: string[]): Promise<void> {
    const body = { typeList };
    const headers = this.buildPutHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ALARM_MESSAGE_MARK_READ);

    const resp = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Mark-read request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Mark-read request rejected');
    }
  }

  /**
   * DELETE /alarm/messagerecord/delete/{id}
   * Deletes a single alert message by id.
   * Source: VehicleService official-v126-2.2.5
   */
  async deleteAlert(token: string, id: string): Promise<void> {
    const headers = this.buildDeleteHeaders(token);
    const url = joinUrl(
      this.baseUrl,
      `${CLOUD_CONFIG.ENDPOINTS.ALARM_MESSAGE_DELETE}/${encodeURIComponent(id)}`,
    );

    const resp = await fetch(url, { method: 'DELETE', headers });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Delete alert request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Delete alert request rejected');
    }
  }

  /**
   * PUT /alarm/messagerecord/clear/v1
   * Clears all messages of the given types.
   * Source: VehicleService official-v126-2.2.5
   */
  async clearAlerts(token: string, typeList: string[]): Promise<void> {
    const body = { typeList };
    const headers = this.buildPutHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.ALARM_MESSAGE_CLEAR);

    const resp = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Clear alerts request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Clear alerts request rejected');
    }
  }
}
