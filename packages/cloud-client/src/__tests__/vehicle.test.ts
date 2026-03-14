import { VehicleClient } from '../vehicle';
import { CloudAuthError, VehicleNowInfoData } from '../types';

describe('VehicleClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  test('getEncryptInfo() extrae encryptValue, key, iv', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        data: {
          encryptInfo: {
            encryptValue: 'abcd',
            key: '12345678901234567890123456789012',
            iv: '0000000000000000',
          },
        },
      }),
    } as Response);

    const client = new VehicleClient('https://example.test/v1.0');
    await expect(client.getEncryptInfo('veh-1', 'tok-1')).resolves.toEqual({
      encryptValue: 'abcd',
      key: '12345678901234567890123456789012',
      iv: '0000000000000000',
    });
  });

  test('getEncryptInfo() lanza error si vehicleId no encontrado', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: 40401, msg: 'vehicle not found' }),
    } as Response);

    const client = new VehicleClient('https://example.test/v1.0');
    await expect(client.getEncryptInfo('missing', 'tok-1')).rejects.toBeInstanceOf(CloudAuthError);
  });

  test('request incluye headers firmados', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        data: {
          encryptInfo: { encryptValue: '00', key: 'k'.repeat(32), iv: '' },
        },
      }),
    } as Response);

    const client = new VehicleClient('https://example.test/v1.0');
    await client.getEncryptInfo('veh-2', 'tok-2');

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers as HeadersInit);
    expect(headers.has('appId')).toBe(true);
    expect(headers.has('nonce')).toBe(true);
    expect(headers.has('timestamp')).toBe(true);
    expect(headers.has('sign')).toBe(true);
    expect(headers.get('Authorization')).toBe('Bearer tok-2');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/fuel-vehicle/servervehicle/app/vehicle?vehicleId=veh-2');
  });

  test('getUserVehicles() devuelve lista de vehiculos del usuario', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        data: [
          {
            vehicleId: 'veh-1',
            vehicleName: 'Demo',
            vin: 'LCEPEVLD8N8888888',
            virtualFlag: '1',
          },
        ],
      }),
    } as Response);

    const client = new VehicleClient('https://example.test/v1.0');
    await expect(client.getUserVehicles('tok-3', 'user-9')).resolves.toEqual([
      expect.objectContaining({
        vehicleId: 'veh-1',
        vehicleName: 'Demo',
      }),
    ]);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer tok-3');
    expect(headers.get('user_id')).toBe('user-9');
    expect(headers.has('sign')).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      '/fuel-vehicle/servervehicle/app/vehicle/mine?position=1',
    );
  });

  test('getUserVehicles() lanza error si data no es array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        data: null,
      }),
    } as Response);

    const client = new VehicleClient('https://example.test/v1.0');
    await expect(client.getUserVehicles('tok-4', 'user-1')).rejects.toBeInstanceOf(CloudAuthError);
  });

  describe('getVehicleDetail()', () => {
    const fullData: VehicleNowInfoData = {
      vehicleId: 'veh-42',
      btMac: 'AA:BB:CC:DD:EE:FF',
      vin: 'LCEPEVLD8N0000001',
      isOnline: true,
      deviceState: '1',
      kl: '1',
      speed: '0',
      totalRideMile: '1234.5',
      encryptInfo: {
        encryptValue: 'abc',
        key: 'k'.repeat(32),
        iv: '0000000000000000',
      },
    };

    test('devuelve VehicleNowInfoData completo', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: fullData }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      const result = await client.getVehicleDetail('veh-42', 'tok-1');

      expect(result).toEqual(expect.objectContaining({
        vehicleId: 'veh-42',
        btMac: 'AA:BB:CC:DD:EE:FF',
        isOnline: true,
        kl: '1',
        totalRideMile: '1234.5',
      }));
      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-vehicle/servervehicle/app/vehicle?vehicleId=veh-42',
      );
    });

    test('no lanza error con vehículo virtual (encryptInfo ausente)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: '0',
          data: { vehicleId: '-1', btMac: null, isOnline: false },
        }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      await expect(client.getVehicleDetail('-1', 'tok-1')).resolves.toEqual(
        expect.objectContaining({ vehicleId: '-1', isOnline: false }),
      );
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 40401, msg: 'vehicle not found' }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      await expect(client.getVehicleDetail('missing', 'tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('incluye headers firmados y Authorization', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: fullData }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      await client.getVehicleDetail('veh-42', 'tok-detail');

      const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit);
      expect(headers.get('Authorization')).toBe('Bearer tok-detail');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });
  });

  describe('getVehicles()', () => {
    test('devuelve lista de vehículos con token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: '0',
          data: [
            { vehicleId: 'veh-10', vehicleName: 'NK 450', vin: 'LCEP0001', btMac: 'AA:BB:CC:DD:EE:FF' },
          ],
        }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      const result = await client.getVehicles('tok-5');

      expect(result).toEqual([
        expect.objectContaining({ vehicleId: 'veh-10', vehicleName: 'NK 450' }),
      ]);
      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/fuel-vehicle/servervehicle/app/vehicle/mine?position=2');
      const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit);
      expect(headers.get('Authorization')).toBe('Bearer tok-5');
      expect(headers.get('user_id')).toBe('');
    });

    test('devuelve array vacío si data es []', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: [] }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      await expect(client.getVehicles('tok-6')).resolves.toEqual([]);
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new VehicleClient('https://example.test/v1.0');
      await expect(client.getVehicles('tok-expired')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
