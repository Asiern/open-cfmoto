import { FenceClient } from '../fence';
import { CloudAuthError, ElectricFence, CreateElectricFenceRequest } from '../types';

describe('FenceClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const fence: ElectricFence = {
    id: 'fence-1',
    rideRangeName: 'Home zone',
    rideRangeRule: '0',
    address: 'Calle Mayor 1, Madrid',
    addrPosition: '40.416775,-3.70379',
    latitude: 40.416775,
    longitude: -3.70379,
    radius: 500,
    scalingRatio: 1,
    state: '1',
  };

  const createReq: CreateElectricFenceRequest = {
    vehicleId: 'veh-1',
    rideRangeName: 'Home zone',
    address: 'Calle Mayor 1, Madrid',
    latitude: 40.416775,
    longitude: -3.70379,
    radius: '500',
    scalingRatio: 1,
    state: 1,
  };

  // ─── listFences() ─────────────────────────────────────────────────────────

  describe('listFences()', () => {
    test('returns ElectricFence array on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [fence] }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      const result = await client.listFences('tok-1', 'veh-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'fence-1',
        rideRangeName: 'Home zone',
        latitude: 40.416775,
        radius: 500,
        state: '1',
      });
    });

    test('returns empty array when data is []', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.listFences('tok-1', 'veh-1')).resolves.toEqual([]);
    });

    test('sends GET to /electricFence/list with vehicleId query param', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.listFences('tok-1', 'veh-42');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('GET');
      expect(url).toContain('/electricFence/list');
      expect(url).toContain('vehicleId=veh-42');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.listFences('tok-list', 'veh-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-list');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('throws CloudAuthError when data is not an array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.listFences('tok-1', 'veh-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.listFences('expired', 'veh-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'no access' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      const err = await client.listFences('tok-1', 'veh-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.listFences('tok-1', 'veh-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── createFence() ────────────────────────────────────────────────────────

  describe('createFence()', () => {
    test('returns created ElectricFence on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: fence }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      const result = await client.createFence('tok-1', createReq);

      expect(result).toMatchObject({
        id: 'fence-1',
        rideRangeName: 'Home zone',
        latitude: 40.416775,
        radius: 500,
      });
    });

    test('sends POST to /electricFence with request body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: fence }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.createFence('tok-1', createReq);

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(url).toMatch(/\/electricFence$/);
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        vehicleId: 'veh-1',
        rideRangeName: 'Home zone',
        latitude: 40.416775,
        longitude: -3.70379,
        radius: '500',
        state: 1,
      });
    });

    test('radius is sent as string in request body (APK type)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: fence }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.createFence('tok-1', { ...createReq, radius: '300' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(typeof body.radius).toBe('string');
      expect(body.radius).toBe('300');
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: fence }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.createFence('tok-create', createReq);

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-create');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 400', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 40000, msg: 'bad request' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.createFence('tok-1', createReq)).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'fence limit reached' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.createFence('tok-1', createReq)).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.createFence('tok-1', createReq)).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── deleteFence() ────────────────────────────────────────────────────────

  describe('deleteFence()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.deleteFence('tok-1', 'fence-1')).resolves.toBeUndefined();
    });

    test('sends DELETE to /electricFence/{id}', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.deleteFence('tok-1', 'fence-99');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('DELETE');
      expect(url).toMatch(/\/electricFence\/fence-99$/);
    });

    test('URL-encodes special characters in id', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.deleteFence('tok-1', 'fence/special id');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('fence%2Fspecial%20id');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await client.deleteFence('tok-del', 'fence-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-del');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 404', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 40401, msg: 'fence not found' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.deleteFence('tok-1', 'ghost')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'cannot delete active fence' }),
      } as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.deleteFence('tok-1', 'fence-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new FenceClient('https://example.test/v1.0');
      await expect(client.deleteFence('tok-1', 'fence-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
