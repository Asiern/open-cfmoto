import CryptoJS from 'crypto-js';
import {
  CLOUD_CONFIG,
  COMMON_HEADERS,
  resolveAppInfoHeader,
  resolveAreaNo,
  resolveLangHeader,
  resolveUserAgentHeader,
  resolveZoneId,
} from './config';
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

function detectIdcardType(username: string): string {
  return username.includes('@') ? 'email' : 'phone';
}

function normalizePassword(password: string): string {
  const trimmed = password.trim();
  if (/^[0-9a-f]{32}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return CryptoJS.MD5(password).toString(CryptoJS.enc.Hex);
}

function normalizeCode(payload: CloudErrorPayload): {
  codeNumber?: number;
  codeText?: string;
  isErrorCode: boolean;
} {
  if (typeof payload.code === 'number') {
    return {
      codeNumber: payload.code,
      codeText: String(payload.code),
      isErrorCode: payload.code !== 0 && payload.code !== 200,
    };
  }
  if (typeof payload.code === 'string') {
    return {
      codeText: payload.code,
      isErrorCode: payload.code !== '0' && payload.code !== '200',
    };
  }
  return { isErrorCode: false };
}

function isApiError(resp: Response, payload: CloudErrorPayload): boolean {
  if (!resp.ok) {
    return true;
  }
  const normalized = normalizeCode(payload);
  if (normalized.isErrorCode) {
    return true;
  }
  if (typeof payload.success === 'boolean' && payload.success === false) {
    return true;
  }
  return false;
}

export class CloudAuthClient {
  private token: string | null = null;
  private userId: string | null = null;

  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  async login(username: string, password: string, options?: { areaNo?: string }): Promise<string> {
    const areaNo = options?.areaNo ?? resolveAreaNo();
    const body = {
      idcard: username,
      idcardType: detectIdcardType(username),
      password: normalizePassword(password),
      thirdpartyId: '',
      thirdpartyType: '',
      areaCode: '',
      areaNo,
      emailMarketingAlarm: false,
      verifyCode: '',
    };
    const signed = buildSignedHeaders(body);
    const headers = mergeHeaders(signed, {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${CLOUD_CONFIG.VIRTUAL_VEHICLE_TOKEN}`,
      user_id: '',
      lang: resolveLangHeader(),
      ZoneId: resolveZoneId(),
      'X-App-Info': resolveAppInfoHeader(),
      'User-Agent': resolveUserAgentHeader(),
    });
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
      const codeInfo = normalizeCode(payload);
      throw new CloudAuthError(message, {
        code: codeInfo.codeNumber,
        codeText: codeInfo.codeText,
        status: resp.status,
        details: payload,
      });
    }

    const loginPayload = payload as LoginResponse;
    const token = loginPayload.data?.tokenInfo?.accessToken ?? loginPayload.data?.token;
    if (!token) {
      throw new CloudAuthError('Cloud login response missing token', {
        status: resp.status,
        details: payload,
      });
    }

    this.userId = loginPayload.data?.userId ?? null;
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

  getUserId(): string | null {
    return this.userId;
  }
}
