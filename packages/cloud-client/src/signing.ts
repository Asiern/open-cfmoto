import CryptoJS from 'crypto-js';
import { CLOUD_CONFIG } from './config';

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    return 0;
  }
  const cryptoLike = globalThis.crypto;
  if (cryptoLike && typeof cryptoLike.getRandomValues === 'function') {
    const bytes = new Uint32Array(1);
    cryptoLike.getRandomValues(bytes);
    return bytes[0]! % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function randomNonce(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const kind = randomInt(3);
    if (kind === 0) {
      result += String(randomInt(10));
    } else if (kind === 1) {
      // Mirrors APK behavior: SecureRandom.nextInt(25) + 'A' => A..Y
      result += String.fromCharCode(randomInt(25) + 65);
    } else {
      // Mirrors APK behavior: SecureRandom.nextInt(25) + 'a' => a..y
      result += String.fromCharCode(randomInt(25) + 97);
    }
  }
  return result;
}

function serializeBody(body: object): string {
  if (Object.keys(body).length === 0) {
    return '';
  }
  return JSON.stringify(body);
}

export interface QueryParams {
  [key: string]: string;
}

function encodeQueryValue(value: string): string {
  // Java URLEncoder behavior for spaces uses '+'
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function serializeQueryParams(queryParams: QueryParams): string {
  const entries = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}=${encodeQueryValue(value)}`).join('&');
}

export interface SignOverrides {
  nonce?: string;
  timestamp?: string;
}

export interface SignPayloadOptions {
  queryParams?: QueryParams;
}

function buildSignPayload(body: object, options?: SignPayloadOptions): string {
  if (options?.queryParams) {
    return serializeQueryParams(options.queryParams);
  }
  return serializeBody(body);
}

export function computeSignature(
  body: object,
  nonce: string,
  timestamp: string,
  options?: SignPayloadOptions,
): string {
  const payload = buildSignPayload(body, options);
  const params = `appId=${CLOUD_CONFIG.APP_ID}&nonce=${nonce}&timestamp=${timestamp}`;
  const input = `${payload}${params}${CLOUD_CONFIG.APP_SECRET}`;
  const sha1 = CryptoJS.SHA1(input).toString(CryptoJS.enc.Hex);
  return CryptoJS.MD5(sha1).toString(CryptoJS.enc.Hex);
}

export function buildSignedHeaders(
  body: object,
  overrides?: SignOverrides,
  options?: SignPayloadOptions,
): Headers {
  const nonce = overrides?.nonce ?? randomNonce(CLOUD_CONFIG.NONCE_LENGTH);
  const timestamp = overrides?.timestamp ?? String(Date.now());
  const sign = computeSignature(body, nonce, timestamp, options);
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
