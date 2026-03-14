import { VehicleClient } from '../vehicle';
import { CloudAuthError } from '../types';

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
});
