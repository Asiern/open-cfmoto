import CryptoJS from 'crypto-js';
import { CLOUD_CONFIG, COMMON_HEADERS, resolveAreaNo, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import {
  CheckCodeRequest,
  CloudAuthError,
  CloudErrorPayload,
  LoginResponse,
  RegisterRequest,
  RegisterResult,
  SendCodeRequest,
  UpdatePasswordRequest,
  UserProfile,
} from './types';

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function detectIdcardType(idcard: string): string {
  return idcard.includes('@') ? 'email' : 'phone';
}

function normalizeAreaCode(areaCode?: string): string {
  if (!areaCode) {
    return '';
  }
  // APK strips leading "+" from country code before sending.
  return areaCode.trim().replace(/^\+/, '');
}

function normalizePassword(password: string): string {
  const trimmed = password.trim();
  if (/^[0-9a-f]{32}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return CryptoJS.MD5(password).toString(CryptoJS.enc.Hex);
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

export class AccountClient {
  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  private buildUnauthHeaders(body: object): Headers {
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', COMMON_HEADERS['Content-Type']);
    headers.set('Authorization', `Bearer ${CLOUD_CONFIG.VIRTUAL_VEHICLE_TOKEN}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  private buildAuthHeaders(token: string, body: object): Headers {
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', COMMON_HEADERS['Content-Type']);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  async register(req: RegisterRequest): Promise<RegisterResult> {
    const body = {
      idcard: req.idcard,
      idcardType: detectIdcardType(req.idcard),
      password: normalizePassword(req.password),
      verifyCode: req.verifyCode,
      areaCode: normalizeAreaCode(req.areaCode),
      areaNo: req.areaNo ?? resolveAreaNo(),
      emailMarketingAlarm: req.emailMarketingAlarm ?? false,
    };

    const headers = this.buildUnauthHeaders(body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.REGISTER);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let payload: LoginResponse | CloudErrorPayload;
    try {
      payload = (await resp.json()) as LoginResponse | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Register request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Registration rejected');
    }

    const loginPayload = payload as LoginResponse;
    const token = loginPayload.data?.tokenInfo?.accessToken ?? loginPayload.data?.token;
    if (!token) {
      throw new CloudAuthError('Register response missing token', {
        status: resp.status,
        details: payload,
      });
    }

    const { tokenInfo: _tokenInfo, token: _token, ...profileFields } = loginPayload.data;
    const profile: UserProfile = profileFields as UserProfile;

    return { token, userId: loginPayload.data.userId, profile };
  }

  async sendCode(req: SendCodeRequest): Promise<void> {
    const body = {
      idcard: req.idcard,
      idcardType: detectIdcardType(req.idcard),
      verifyCode: '',
      areaCode: normalizeAreaCode(req.areaCode),
      areaNo: req.areaNo ?? resolveAreaNo(),
      emailMarketingAlarm: false,
    };

    const headers = this.buildUnauthHeaders(body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.SEND_CODE);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Send code request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Send code rejected');
    }
  }

  async checkCode(req: CheckCodeRequest): Promise<void> {
    const body = {
      idcard: req.idcard,
      idcardType: detectIdcardType(req.idcard),
      verifyCode: req.verifyCode,
      areaCode: normalizeAreaCode(req.areaCode),
      areaNo: req.areaNo ?? resolveAreaNo(),
      emailMarketingAlarm: false,
    };

    const headers = this.buildUnauthHeaders(body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.CHECK_CODE);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Check code request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Code verification rejected');
    }
  }

  async updatePassword(token: string, req: UpdatePasswordRequest): Promise<void> {
    const body = {
      oldPassword: normalizePassword(req.oldPassword),
      newPassword: normalizePassword(req.newPassword),
    };

    const headers = this.buildAuthHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.UPDATE_PASSWORD);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Update password request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Password update rejected');
    }
  }
}
