import {
  CLOUD_CONFIG,
  COMMON_HEADERS,
  resolveAppInfoHeader,
  resolveLangHeader,
  resolveUserAgentHeader,
  resolveZoneId,
} from './config';
import { buildSignedHeaders } from './signing';
import { CloudAuthError, CloudErrorPayload, LoginArea, LoginAreaListResponse } from './types';

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

function throwApiError(resp: Response, payload: CloudErrorPayload, fallback: string): never {
  const message = payload.msg ?? payload.message ?? fallback;
  throw new CloudAuthError(message, {
    code: typeof payload.code === 'number' ? payload.code : undefined,
    codeText: typeof payload.code === 'string' ? payload.code : undefined,
    status: resp.status,
    details: payload,
  });
}

export function resolveBaseUrlFromRegionDomain(domain?: string): string {
  const clean = (domain ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!clean) return CLOUD_CONFIG.BASE_URL;
  return `https://${clean}/v1.0`;
}

export class RegionClient {
  constructor(private readonly baseUrl: string = CLOUD_CONFIG.DISCOVERY_BASE_URL) {}

  async listLoginAreas(): Promise<LoginArea[]> {
    const body = {};
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', COMMON_HEADERS['Content-Type']);
    headers.set('Authorization', `Bearer ${CLOUD_CONFIG.VIRTUAL_VEHICLE_TOKEN}`);
    headers.set('user_id', '');
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    headers.set('X-App-Info', resolveAppInfoHeader());
    headers.set('User-Agent', resolveUserAgentHeader());

    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.LOGIN_AREA_LIST);
    const resp = await fetch(url, { method: 'GET', headers });

    let payload: LoginAreaListResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as LoginAreaListResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Get login area request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throwApiError(resp, payload, 'Get login area request rejected');
    }

    const list = (payload as LoginAreaListResponse).data ?? [];
    return Array.isArray(list) ? list : [];
  }
}
