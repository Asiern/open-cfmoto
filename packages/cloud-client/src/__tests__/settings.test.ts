import { SettingsClient } from '../settings';
import { AlarmSetting, AppUnitSetResp, CloudAuthError, VehicleFunResp } from '../types';

describe('SettingsClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const appUnitSet: AppUnitSetResp = {
    id: 'set-1',
    appUnit: 'metric',
    drivingBehavior: true,
    appLogo: 'https://cdn.example.com/logo.png',
  };

  const vehicleFun: VehicleFunResp = {
    id: 1,
    name: 'Remote unlock',
    description: 'Unlock vehicle remotely',
    sign: 1,
    checked: 1,
    type: 2,
  };

  const alarmSetting: AlarmSetting = {
    vehicleAlarm: true,
    systemAlarm: false,
    defenseAlarm: true,
    eleLowPower: '20',
    eleLowPowerAlarm: true,
    electronicFenceInAlarm: false,
    electronicFenceOutAlarm: true,
    id: 'alarm-1',
    vehicleId: 'veh-1',
    userId: 'user-1',
    lowTirePressureAlarm: false,
    rollOverAlarm: true,
  };

  // ─── getSettings() ────────────────────────────────────────────────────────

  describe('getSettings()', () => {
    test('returns AppUnitSetResp on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: appUnitSet }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      const result = await client.getSettings('tok-1');

      expect(result).toMatchObject({
        id: 'set-1',
        appUnit: 'metric',
        drivingBehavior: true,
      });
    });

    test('sends GET to /setting', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: appUnitSet }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.getSettings('tok-1');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('GET');
      expect(url).toMatch(/\/setting$/);
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: appUnitSet }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.getSettings('tok-settings');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-settings');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(client.getSettings('expired')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'no access' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      const err = await client.getSettings('tok-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'service unavailable' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(client.getSettings('tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(client.getSettings('tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── getVehicleFuncCompatibility() ───────────────────────────────────────

  describe('getVehicleFuncCompatibility()', () => {
    test('returns VehicleFunResp array on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [vehicleFun] }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      const result = await client.getVehicleFuncCompatibility('tok-1', 'dev-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, sign: 1, checked: 1, type: 2 });
    });

    test('returns empty array when no functions available', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.getVehicleFuncCompatibility('tok-1', 'dev-1'),
      ).resolves.toEqual([]);
    });

    test('sends GET to /vehicle/set/list/compatibility/ele-v2 with deviceId', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.getVehicleFuncCompatibility('tok-1', 'dev-42');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('GET');
      expect(url).toContain('/vehicle/set/list/compatibility/ele-v2');
      expect(url).toContain('deviceId=dev-42');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.getVehicleFuncCompatibility('tok-compat', 'dev-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-compat');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError when data is not an array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.getVehicleFuncCompatibility('tok-1', 'dev-1'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.getVehicleFuncCompatibility('expired', 'dev-1'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'device not found' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.getVehicleFuncCompatibility('tok-1', 'dev-1'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── getAlarmCompatibility() ──────────────────────────────────────────────

  describe('getAlarmCompatibility()', () => {
    test('returns AlarmSetting on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: alarmSetting }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      const result = await client.getAlarmCompatibility('tok-1');

      expect(result).toMatchObject({
        vehicleAlarm: true,
        systemAlarm: false,
        defenseAlarm: true,
        electronicFenceOutAlarm: true,
      });
    });

    test('sends GET to /setting/alarm/compatibility/ele', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: alarmSetting }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.getAlarmCompatibility('tok-1');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('GET');
      expect(url).toContain('/setting/alarm/compatibility/ele');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: alarmSetting }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.getAlarmCompatibility('tok-alarm');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-alarm');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(client.getAlarmCompatibility('expired')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '50001', msg: 'service error' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      const err = await client.getAlarmCompatibility('tok-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('50001');
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(client.getAlarmCompatibility('tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── updateAlarmCompatibility() ───────────────────────────────────────────

  describe('updateAlarmCompatibility()', () => {
    test('resolves void on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.updateAlarmCompatibility('tok-1', alarmSetting),
      ).resolves.toBeUndefined();
    });

    test('sends PUT to /setting/alarm/compatibility/ele with full AlarmSetting body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.updateAlarmCompatibility('tok-1', alarmSetting);

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(url).toContain('/setting/alarm/compatibility/ele');
      expect(init.method).toBe('PUT');
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        vehicleAlarm: true,
        systemAlarm: false,
        defenseAlarm: true,
        electronicFenceOutAlarm: true,
        vehicleId: 'veh-1',
      });
    });

    test('includes Authorization, Content-Type and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await client.updateAlarmCompatibility('tok-update', alarmSetting);

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-update');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 400', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 40000, msg: 'bad request' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.updateAlarmCompatibility('tok-1', alarmSetting),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'validation failed' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      const err = await client.updateAlarmCompatibility('tok-1', alarmSetting).catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'update rejected' }),
      } as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.updateAlarmCompatibility('tok-1', alarmSetting),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new SettingsClient('https://example.test/v1.0');
      await expect(
        client.updateAlarmCompatibility('tok-1', alarmSetting),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
