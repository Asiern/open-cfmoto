import { CLOUD_CONFIG, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CloudAuthError,
  CloudErrorPayload,
  UpdateUserInfoRequest,
  UserProfile,
  UserProfileResponse,
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

export class UserClient {
  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  private buildGetHeaders(token: string): Headers {
    const signed = buildSignedHeaders({}, undefined, {});
    const headers = new Headers(signed);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  private buildBodyHeaders(token: string, body: object): Headers {
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', 'application/json; charset=UTF-8');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  private throwApiError(resp: Response, payload: CloudErrorPayload, fallback: string): never {
    const message = payload.msg ?? payload.message ?? fallback;
    throw new CloudAuthError(message, {
      code: typeof payload.code === 'number' ? payload.code : undefined,
      codeText: typeof payload.code === 'string' ? payload.code : undefined,
      status: resp.status,
      details: payload,
    });
  }

  async getProfile(token: string): Promise<UserProfile> {
    const headers = this.buildGetHeaders(token);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.USER_INFO);

    const resp = await fetch(url, { method: 'GET', headers });

    let payload: UserProfileResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as UserProfileResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('User info request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      this.throwApiError(resp, payload, 'User info request rejected');
    }

    return (payload as UserProfileResponse).data;
  }

  async updateProfile(token: string, req: UpdateUserInfoRequest): Promise<UserProfile> {
    const body = req as Record<string, unknown>;
    const headers = this.buildBodyHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.UPDATE_INFO);

    const resp = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    let payload: UserProfileResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as UserProfileResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Update profile request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      this.throwApiError(resp, payload, 'Update profile request rejected');
    }

    return (payload as UserProfileResponse).data;
  }

  async updateAreaNo(token: string, areaNo: string): Promise<void> {
    const body = { areaNo };
    const headers = this.buildBodyHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.UPDATE_AREA_NO);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Update area request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      this.throwApiError(resp, payload, 'Update area request rejected');
    }
  }
}
