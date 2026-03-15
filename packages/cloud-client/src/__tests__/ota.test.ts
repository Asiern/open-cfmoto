import { OtaClient } from '../ota';
import { CloudAuthError, OtaDetail, VehicleUpdateBean } from '../types';

describe('OtaClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const updateBean: VehicleUpdateBean = {
    codeMessage: 'New firmware available',
    code: 'FW_1.2.3',
    check: true,
    url: 'https://ota.example.com/fw/1.2.3.bin',
  };

  const otaDetail: OtaDetail = {
    id: 'ota-1',
    versionNum: '1.2.3',
    otaStatus: 1,
    releaseTime: '2024-01-15',
    notesUrl: 'https://ota.example.com/notes/1.2.3',
    versionDescUrl: 'https://ota.example.com/desc/1.2.3',
    orderButtonEnabled: 1,
    scheduleButtonEnabled: 0,
    orderTimestamp: '',
    errorMsg: '',
    orderUpgradeVoltage: '',
  };

  // ─── checkUpdates() ───────────────────────────────────────────────────────

  describe('checkUpdates()', () => {
    test('returns VehicleUpdateBean array on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [updateBean] }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      const result = await client.checkUpdates('tok-1', 'dev-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        code: 'FW_1.2.3',
        check: true,
        url: 'https://ota.example.com/fw/1.2.3.bin',
      });
    });

    test('returns empty array when no updates available', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.checkUpdates('tok-1', 'dev-1')).resolves.toEqual([]);
    });

    test('sends GET to /ota/check with deviceId query param', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await client.checkUpdates('tok-1', 'dev-42');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('GET');
      expect(url).toContain('/ota/check');
      expect(url).toContain('deviceId=dev-42');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await client.checkUpdates('tok-check', 'dev-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-check');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('throws CloudAuthError when data is not an array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.checkUpdates('tok-1', 'dev-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.checkUpdates('expired', 'dev-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'no access' }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      const err = await client.checkUpdates('tok-1', 'dev-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'device not found' }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.checkUpdates('tok-1', 'dev-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.checkUpdates('tok-1', 'dev-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── getOtaDetail() ───────────────────────────────────────────────────────

  describe('getOtaDetail()', () => {
    test('returns OtaDetail on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: otaDetail }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      const result = await client.getOtaDetail('tok-1', 'dev-1');

      expect(result).toMatchObject({
        id: 'ota-1',
        versionNum: '1.2.3',
        otaStatus: 1,
        orderButtonEnabled: 1,
        scheduleButtonEnabled: 0,
        orderTimestamp: '',
        errorMsg: '',
        orderUpgradeVoltage: '',
      });
    });

    test('sends GET to /ota with deviceId query param', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: otaDetail }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await client.getOtaDetail('tok-1', 'dev-99');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('GET');
      expect(url).toMatch(/\/ota\?/);
      expect(url).toContain('deviceId=dev-99');
      expect(url).not.toContain('/ota/check');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: otaDetail }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await client.getOtaDetail('tok-detail', 'dev-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-detail');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 404', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 40401, msg: 'device not found' }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.getOtaDetail('tok-1', 'ghost')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '50001', msg: 'ota service unavailable' }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      const err = await client.getOtaDetail('tok-1', 'dev-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('50001');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'ota not available for device' }),
      } as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.getOtaDetail('tok-1', 'dev-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new OtaClient('https://example.test/v1.0');
      await expect(client.getOtaDetail('tok-1', 'dev-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
