import { AlertClient } from '../alert';
import { AlarmMessage, CloudAuthError } from '../types';

describe('AlertClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const msg: AlarmMessage = {
    id: 'msg-1',
    title: 'Overspeed alert',
    content: 'Vehicle exceeded speed limit',
    messageType: 'SECURITY',
    pushTime: 1700000000000,
    read: false,
    vehicleId: 'veh-1',
    userId: 'user-1',
    vin: 'VIN123',
    plateNumber: 'AB-1234',
    vehicleNickName: 'My CFMoto',
    jumpType: 'alarm_detail',
    latitude: 40.416775,
    longitude: -3.70379,
  };

  // ─── listAlerts() ─────────────────────────────────────────────────────────

  describe('listAlerts()', () => {
    test('returns AlarmMessage array on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [msg] }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      const result = await client.listAlerts('tok-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        messageType: 'SECURITY',
        read: false,
        vehicleId: 'veh-1',
      });
    });

    test('returns empty array when data is []', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.listAlerts('tok-1')).resolves.toEqual([]);
    });

    test('sends pageStart=1 and pageSize=20 by default', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.listAlerts('tok-1');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/alarm/messagerecord');
      expect(url).toContain('pageStart=1');
      expect(url).toContain('pageSize=20');
    });

    test('sends pageStart, pageSize and type when provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.listAlerts('tok-1', { pageStart: 2, pageSize: 10, type: 'SECURITY' });

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('pageStart=2');
      expect(url).toContain('pageSize=10');
      expect(url).toContain('type=SECURITY');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.listAlerts('tok-list');

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

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.listAlerts('tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.listAlerts('expired')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'no access' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      const err = await client.listAlerts('tok-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.listAlerts('tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── markRead() ───────────────────────────────────────────────────────────

  describe('markRead()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.markRead('tok-1', ['SECURITY'])).resolves.toBeUndefined();
    });

    test('sends PUT to mark_read/v1 with typeList body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.markRead('tok-1', ['SECURITY', 'SERVICE']);

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(url).toContain('/alarm/messagerecord/mark_read/v1');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({ typeList: ['SECURITY', 'SERVICE'] });
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.markRead('tok-mark', ['SECURITY']);

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-mark');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.markRead('expired', ['SECURITY'])).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'operation failed' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.markRead('tok-1', ['SECURITY'])).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.markRead('tok-1', ['SECURITY'])).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── deleteAlert() ────────────────────────────────────────────────────────

  describe('deleteAlert()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.deleteAlert('tok-1', 'msg-1')).resolves.toBeUndefined();
    });

    test('sends DELETE to delete/{id} path', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.deleteAlert('tok-1', 'msg-99');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('DELETE');
      expect(url).toContain('/alarm/messagerecord/delete/msg-99');
    });

    test('URL-encodes special characters in id', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.deleteAlert('tok-1', 'msg/special id');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('msg%2Fspecial%20id');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.deleteAlert('tok-del', 'msg-1');

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
        json: async () => ({ code: 40401, msg: 'not found' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.deleteAlert('tok-1', 'ghost')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'cannot delete' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.deleteAlert('tok-1', 'msg-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── clearAlerts() ────────────────────────────────────────────────────────

  describe('clearAlerts()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.clearAlerts('tok-1', ['SECURITY'])).resolves.toBeUndefined();
    });

    test('sends PUT to clear/v1 with typeList body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.clearAlerts('tok-1', ['SECURITY', 'SERVICE']);

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(url).toContain('/alarm/messagerecord/clear/v1');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({ typeList: ['SECURITY', 'SERVICE'] });
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await client.clearAlerts('tok-clear', ['SECURITY']);

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-clear');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.clearAlerts('expired', ['SECURITY'])).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'clear failed' }),
      } as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.clearAlerts('tok-1', ['SECURITY'])).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new AlertClient('https://example.test/v1.0');
      await expect(client.clearAlerts('tok-1', ['SECURITY'])).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
