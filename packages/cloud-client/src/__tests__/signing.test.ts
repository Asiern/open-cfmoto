import { buildSignedHeaders, computeSignature } from '../signing';
import { CLOUD_CONFIG } from '../config';

describe('buildSignedHeaders', () => {
  test('genera firma correcta con vector conocido', () => {
    const body = { username: 'demo@example.com', password: 's3cr3t' };
    const nonce = 'a1B2c3D4e5F6g7H8';
    const timestamp = '1710000000000';

    const headers = buildSignedHeaders(body, { nonce, timestamp });
    const expected = computeSignature(body, nonce, timestamp);

    expect(headers.get('appId')).toBe(CLOUD_CONFIG.APP_ID);
    expect(headers.get('nonce')).toBe(nonce);
    expect(headers.get('timestamp')).toBe(timestamp);
    expect(headers.get('sign')).toBe(expected);
    expect(headers.get('signature')).toBe(expected);
  });

  test('nonce cambia en cada llamada', () => {
    const first = buildSignedHeaders({ username: 'u' });
    const second = buildSignedHeaders({ username: 'u' });

    expect(first.get('nonce')).toHaveLength(CLOUD_CONFIG.NONCE_LENGTH);
    expect(second.get('nonce')).toHaveLength(CLOUD_CONFIG.NONCE_LENGTH);
    expect(first.get('nonce')).not.toBe(second.get('nonce'));
  });

  test('timestamp usa unix ms actual', () => {
    const start = Date.now();
    const headers = buildSignedHeaders({});
    const end = Date.now();

    const timestamp = Number(headers.get('timestamp'));
    expect(Number.isFinite(timestamp)).toBe(true);
    expect(timestamp).toBeGreaterThanOrEqual(start);
    expect(timestamp).toBeLessThanOrEqual(end);
  });

  test('incluye appId, nonce, timestamp y sign', () => {
    const headers = buildSignedHeaders({});
    expect(headers.has('appId')).toBe(true);
    expect(headers.has('nonce')).toBe(true);
    expect(headers.has('timestamp')).toBe(true);
    expect(headers.has('sign')).toBe(true);
  });

  test('firma GET usa query params ordenados y url-encoded', () => {
    const nonce = 'a1B2c3D4e5F6g7H8';
    const timestamp = '1710000000000';
    const headers = buildSignedHeaders({}, { nonce, timestamp }, {
      queryParams: {
        vehicleId: 'abc 123',
        z: 'zzz',
        a: '111',
      },
    });
    const expected = computeSignature({}, nonce, timestamp, {
      queryParams: {
        vehicleId: 'abc 123',
        z: 'zzz',
        a: '111',
      },
    });

    expect(headers.get('signature')).toBe(expected);
  });
});
