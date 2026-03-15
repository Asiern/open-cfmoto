import CryptoJS from 'crypto-js';
import { CommandClient } from '../commands';
import { CloudAuthError } from '../types';

/** Re-derives the expected unlock secret independently of the implementation. */
function expectedUnlockSecret(vin: string): string {
  const key = CryptoJS.enc.Utf8.parse('3e00e648af874a93b193f6069a27762b');
  return CryptoJS.AES.encrypt(JSON.stringify({ vin }), key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

describe('CommandClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  // ─── remoteUnlock() ───────────────────────────────────────────────────────

  describe('remoteUnlock()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.remoteUnlock('tok-1', 'VIN123')).resolves.toBeUndefined();
    });

    test('sends POST to /vehicle/state/remote/unlock', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.remoteUnlock('tok-1', 'VIN123');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('POST');
      expect(url).toContain('/vehicle/state/remote/unlock');
    });

    test('body contains AES-ECB/PKCS7 secret — not raw vin', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.remoteUnlock('tok-1', 'VIN123');

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body).not.toHaveProperty('vin');
      expect(body).toHaveProperty('secret');
      expect(body.secret).toBe(expectedUnlockSecret('VIN123'));
    });

    test('secret changes with different VINs', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.remoteUnlock('tok-1', 'VIN_A');
      const secretA = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string).secret;

      fetchMock.mockReset();
      global.fetch = fetchMock as unknown as typeof fetch;
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);
      await client.remoteUnlock('tok-1', 'VIN_B');
      const secretB = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string).secret;

      expect(secretA).not.toBe(secretB);
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.remoteUnlock('tok-unlock', 'VIN123');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-unlock');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.remoteUnlock('expired', 'VIN123')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '50001', msg: 'command rejected' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      const err = await client.remoteUnlock('tok-1', 'VIN123').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('50001');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'vehicle offline' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.remoteUnlock('tok-1', 'VIN123')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.remoteUnlock('tok-1', 'VIN123')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── flashHorn() ──────────────────────────────────────────────────────────

  describe('flashHorn()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.flashHorn('tok-1', 'veh-1')).resolves.toBeUndefined();
    });

    test('sends POST to /vehicle/state/flash/horn with vehicleId body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.flashHorn('tok-1', 'veh-42');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(url).toContain('/vehicle/state/flash/horn');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ vehicleId: 'veh-42' });
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.flashHorn('tok-horn', 'veh-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-horn');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 403', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ code: 40300, msg: 'Forbidden' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.flashHorn('tok-1', 'veh-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '50002', msg: 'vehicle not reachable' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      const err = await client.flashHorn('tok-1', 'veh-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('50002');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'command failed' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.flashHorn('tok-1', 'veh-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.flashHorn('tok-1', 'veh-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── getKl15() ────────────────────────────────────────────────────────────

  describe('getKl15()', () => {
    test('returns true when data is true', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: true }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.getKl15('tok-1', 'VIN123')).resolves.toBe(true);
    });

    test('returns false when data is false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: false }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.getKl15('tok-1', 'VIN123')).resolves.toBe(false);
    });

    test('sends POST to /vehicle/state/vehicle/kl15 with vin body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: true }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.getKl15('tok-1', 'VIN456');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(url).toContain('/vehicle/state/vehicle/kl15');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ vin: 'VIN456' });
    });

    test('body contains vin — not vehicleId or secret', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: false }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.getKl15('tok-1', 'VIN789');

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body).toHaveProperty('vin', 'VIN789');
      expect(body).not.toHaveProperty('vehicleId');
      expect(body).not.toHaveProperty('secret');
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: true }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await client.getKl15('tok-kl15', 'VIN123');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-kl15');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.getKl15('expired', 'VIN123')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40401', msg: 'vehicle not found' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      const err = await client.getKl15('tok-1', 'VIN123').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40401');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'tbox offline' }),
      } as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.getKl15('tok-1', 'VIN123')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new CommandClient('https://example.test/v1.0');
      await expect(client.getKl15('tok-1', 'VIN123')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
