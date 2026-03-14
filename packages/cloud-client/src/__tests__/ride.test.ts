import { RideClient } from '../ride';
import { CloudAuthError, RideHistoryDetail, RideHistoryItem } from '../types';

describe('RideClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const item: RideHistoryItem = {
    id: 'ride-1',
    startTime: 1700000000000,
    endTime: 1700003600000,
    startAddr: 'Calle Mayor 1, Madrid',
    endAddr: 'Gran Vía 10, Madrid',
    rideMileage: 12.5,
    ridingTime: 1800,
    maxSpeed: 95.0,
    accelerationTimes: 3,
    bendingTimes: 5,
    brakesTimes: 4,
    dayTime: '2023-11-14',
    dayRideMileage: 25.0,
    totalRideMileage: 1234.5,
    trajectory: '{"type":"LineString","coordinates":[]}',
  };

  const detail: RideHistoryDetail = {
    id: 'ride-1',
    startTime: 1700000000000,
    endTime: 1700003600000,
    startAddr: 'Calle Mayor 1, Madrid',
    endAddr: 'Gran Vía 10, Madrid',
    rideMileage: 12.5,
    ridingTime: 1800.0,
    ridingTimeSeconds: '1800',
    maxSpeed: 95.0,
    accelerationTimes: 3,
    bendingTimes: 5,
    brakesTimes: 4,
    trajectory: '{"type":"LineString","coordinates":[]}',
    virtualTrackImage: 'https://cdn.example.com/track.png',
  };

  // ─── listRides() ─────────────────────────────────────────────────────────────

  describe('listRides()', () => {
    test('devuelve array de RideHistoryItem en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [item] }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      const result = await client.listRides('tok-1', { vehicleId: 'veh-1' });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ride-1',
        rideMileage: 12.5,
        maxSpeed: 95.0,
        dayTime: '2023-11-14',
      });
    });

    test('devuelve array vacío cuando data es []', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.listRides('tok-1', { vehicleId: 'veh-1' })).resolves.toEqual([]);
    });

    test('envía vehicleId, pageStart y pageSize en la URL', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.listRides('tok-1', { vehicleId: 'veh-42', pageStart: 2, pageSize: 10 });

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/ridehistory/list_v2');
      expect(url).toContain('vehicleId=veh-42');
      expect(url).toContain('pageStart=2');
      expect(url).toContain('pageSize=10');
    });

    test('aplica pageStart=1 y pageSize=20 por defecto', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.listRides('tok-1', { vehicleId: 'veh-1' });

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('pageStart=1');
      expect(url).toContain('pageSize=20');
    });

    test('incluye filtros opcionales cuando se pasan', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.listRides('tok-1', {
        vehicleId: 'veh-1',
        startDate: '2023-11-01',
        endDate: '2023-11-30',
        startPositionName: 'Madrid',
      });

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('startDate=2023-11-01');
      expect(url).toContain('endDate=2023-11-30');
      expect(url).toContain('startPositionName=Madrid');
    });

    test('incluye headers firmados y Authorization', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.listRides('tok-list', { vehicleId: 'veh-1' });

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-list');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('lanza CloudAuthError si data no es array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.listRides('tok-1', { vehicleId: 'veh-1' })).rejects.toBeInstanceOf(
        CloudAuthError,
      );
    });

    test('lanza CloudAuthError en error HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(
        client.listRides('expired', { vehicleId: 'veh-1' }),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'no access to vehicle' }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      const err = await client.listRides('tok-1', { vehicleId: 'veh-1' }).catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });
  });

  // ─── getRide() ───────────────────────────────────────────────────────────────

  describe('getRide()', () => {
    test('devuelve RideHistoryDetail completo', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: detail }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      const result = await client.getRide('tok-1', 'ride-1', '2023-11');

      expect(result).toMatchObject({
        id: 'ride-1',
        rideMileage: 12.5,
        ridingTimeSeconds: '1800',
        trajectory: expect.stringContaining('LineString'),
        virtualTrackImage: 'https://cdn.example.com/track.png',
      });
    });

    test('envía id y month como query params', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: detail }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.getRide('tok-1', 'ride-42', '2023-11');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/fuel-vehicle/servervehicle/app/ridehistory');
      expect(url).toContain('id=ride-42');
      expect(url).toContain('month=2023-11');
      expect(url).not.toContain('/ride-42');
    });

    test('incluye Authorization y headers firmados', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: detail }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.getRide('tok-detail', 'ride-1', '2023-11');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-detail');
      expect(headers.has('sign')).toBe(true);
    });

    test('lanza CloudAuthError en error HTTP 404', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 40401, msg: 'ride not found' }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.getRide('tok-1', 'missing', '2023-11')).rejects.toBeInstanceOf(
        CloudAuthError,
      );
    });

    test('lanza CloudAuthError si JSON inválido', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.getRide('tok-1', 'ride-1', '2023-11')).rejects.toBeInstanceOf(
        CloudAuthError,
      );
    });
  });

  // ─── deleteRide() ────────────────────────────────────────────────────────────

  describe('deleteRide()', () => {
    test('resuelve void en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.deleteRide('tok-1', 'ride-1')).resolves.toBeUndefined();
    });

    test('usa método DELETE y la URL contiene el id en el path', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.deleteRide('tok-1', 'ride-99');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      const method = (fetchMock.mock.calls[0]?.[1] as RequestInit).method;
      expect(method).toBe('DELETE');
      expect(url).toContain('/fuel-vehicle/servervehicle/app/ridehistory/ride-99');
    });

    test('incluye Authorization y headers firmados', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await client.deleteRide('tok-del', 'ride-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-del');
      expect(headers.has('sign')).toBe(true);
    });

    test('lanza CloudAuthError en error HTTP 404', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 40401, msg: 'ride not found' }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.deleteRide('tok-1', 'ghost')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'cannot delete shared ride' }),
      } as Response);

      const client = new RideClient('https://example.test/v1.0');
      await expect(client.deleteRide('tok-1', 'ride-shared')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
