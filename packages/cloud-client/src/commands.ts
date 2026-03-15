import CryptoJS from 'crypto-js';
import { CLOUD_CONFIG, COMMON_HEADERS, resolveLangHeader, resolveZoneId } from './config';
import { buildSignedHeaders } from './signing';
import { CloudAuthError, CloudErrorPayload, Kl15Response } from './types';

/** AES-256/ECB/PKCS7 key used for remote unlock — hardcoded in APK. */
const UNLOCK_AES_KEY = '3e00e648af874a93b193f6069a27762b';

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

/**
 * Encrypts `{"vin":"<vin>"}` with AES-ECB/PKCS7 using the hardcoded APK key
 * and returns the Base64 ciphertext (no line breaks) for use as `secret`.
 */
function buildUnlockSecret(vin: string): string {
  const key = CryptoJS.enc.Utf8.parse(UNLOCK_AES_KEY);
  const plaintext = JSON.stringify({ vin });
  return CryptoJS.AES.encrypt(plaintext, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

export class CommandClient {
  constructor(private readonly baseUrl: string = CLOUD_CONFIG.BASE_URL) {}

  private buildPostHeaders(token: string, body: object): Headers {
    const signed = buildSignedHeaders(body);
    const headers = new Headers(signed);
    headers.set('Content-Type', COMMON_HEADERS['Content-Type']);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('lang', resolveLangHeader());
    headers.set('ZoneId', resolveZoneId());
    return headers;
  }

  /**
   * POST /vehicle/state/remote/unlock
   * Sends a remote unlock command. VIN is AES-ECB/PKCS7-encrypted as `secret`.
   * Source: APK VehicleService — body is `{ secret }`, not `{ vin }`.
   */
  async remoteUnlock(token: string, vin: string): Promise<void> {
    const body = { secret: buildUnlockSecret(vin) };
    const headers = this.buildPostHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.REMOTE_UNLOCK);

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Remote unlock request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Remote unlock request rejected');
    }
  }

  /**
   * POST /vehicle/state/flash/horn
   * Triggers flash/horn on the vehicle. Body: `{ vehicleId }` (VehicleReq).
   * Source: APK VehicleService.
   */
  async flashHorn(token: string, vehicleId: string): Promise<void> {
    const body = { vehicleId };
    const headers = this.buildPostHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.FLASH_HORN);

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    let payload: CloudErrorPayload;
    try {
      payload = (await resp.json()) as CloudErrorPayload;
    } catch {
      throw new CloudAuthError('Flash/horn request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'Flash/horn request rejected');
    }
  }

  /**
   * POST /vehicle/state/vehicle/kl15
   * Returns the KL15 (ignition) state. Body: `{ vin }` (VinBean).
   * Response `data` is a boolean (BaseResp<Boolean>).
   * Source: APK VehicleService.
   */
  async getKl15(token: string, vin: string): Promise<boolean> {
    const body = { vin };
    const headers = this.buildPostHeaders(token, body);
    const url = joinUrl(this.baseUrl, CLOUD_CONFIG.ENDPOINTS.KL15);

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    let payload: Kl15Response | CloudErrorPayload;
    try {
      payload = (await resp.json()) as Kl15Response | CloudErrorPayload;
    } catch {
      throw new CloudAuthError('KL15 request failed: invalid JSON response', {
        status: resp.status,
      });
    }

    if (isApiError(resp, payload)) {
      throw buildError(resp, payload, 'KL15 request rejected');
    }

    return Boolean((payload as Kl15Response).data);
  }
}
