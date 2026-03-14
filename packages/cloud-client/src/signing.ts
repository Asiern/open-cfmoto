import CryptoJS from 'crypto-js';
import { CLOUD_CONFIG } from './config';

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomNonce(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * NONCE_CHARS.length);
    result += NONCE_CHARS[idx];
  }
  return result;
}

function serializeBody(body: object): string {
  if (Object.keys(body).length === 0) {
    return '';
  }
  return JSON.stringify(body);
}

export interface SignOverrides {
  nonce?: string;
  timestamp?: string;
}

export function computeSignature(body: object, nonce: string, timestamp: string): string {
  const payload = serializeBody(body);
  const params = `appId=${CLOUD_CONFIG.APP_ID}&nonce=${nonce}&timestamp=${timestamp}`;
  const input = `${payload}${params}${CLOUD_CONFIG.APP_SECRET}`;
  const sha1 = CryptoJS.SHA1(input).toString(CryptoJS.enc.Hex);
  return CryptoJS.MD5(sha1).toString(CryptoJS.enc.Hex);
}

export function buildSignedHeaders(body: object, overrides?: SignOverrides): Headers {
  const nonce = overrides?.nonce ?? randomNonce(CLOUD_CONFIG.NONCE_LENGTH);
  const timestamp = overrides?.timestamp ?? String(Date.now());
  const sign = computeSignature(body, nonce, timestamp);
  const xParam = `appId=${CLOUD_CONFIG.APP_ID}&nonce=${nonce}&timestamp=${timestamp}`;

  const headers = new Headers();
  headers.set('appId', CLOUD_CONFIG.APP_ID);
  headers.set('nonce', nonce);
  headers.set('timestamp', timestamp);
  headers.set('sign', sign);
  headers.set('signature', sign);
  headers.set('Cfmoto-X-Param', xParam);
  headers.set('Cfmoto-X-Sign', sign);
  headers.set('Cfmoto-X-Sign-Type', CLOUD_CONFIG.SIGN_TYPE);
  return headers;
}
