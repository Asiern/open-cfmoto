import { CLOUD_CONFIG, COMMON_HEADERS } from './config';
import { buildSignedHeaders } from './signing';
import { CloudAuthError, CloudErrorPayload, LoginResponse } from './types';

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function mergeHeaders(a: Headers, b: Record<string, string>): Headers {
  const merged = new Headers(a);
  for (const [key, value] of Object.entries(b)) {
    merged.set(key, value);
  }
  return merged;
}

function isApiError(resp: Response, payload: CloudErrorPayload): boolean {
  if (!resp.ok) {
    return true;
  }
  if (typeof payload.code === 'number' && payload.code !== 0 && payload.code !== 200) {
    return true;
  }
  if (typeof payload.success === 'boolean' && payload.success === false) {
    return true;
  }
  return false;
}

export class CloudAuthClient {
  private token: string | null = null;

  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  async login(username: string, password: string): Promise<string> {
    const body = { username, password };
    const signed = buildSignedHeaders(body);
    const headers = mergeHeaders(signed, COMMON_HEADERS);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.LOGIN);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let payload: LoginResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as LoginResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Cloud login failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      const message = payload.msg ?? payload.message ?? 'Cloud login rejected';
      throw new CloudAuthError(message, {
        code: payload.code,
        status: resp.status,
        details: payload,
      });
    }

    const token = (payload as LoginResponse).data?.token;
    if (!token) {
      throw new CloudAuthError('Cloud login response missing token', {
        status: resp.status,
        details: payload,
      });
    }

    this.token = token;
    return token;
  }

  async refreshToken(token: string): Promise<string> {
    // No refresh endpoint was found in APK analysis docs.
    // Caller must perform a fresh login flow.
    if (this.token === token) {
      this.token = null;
    }
    throw new CloudAuthError(
      'Token refresh endpoint is not available; call login() again with user credentials.',
    );
  }

  getToken(): string | null {
    return this.token;
  }
}
