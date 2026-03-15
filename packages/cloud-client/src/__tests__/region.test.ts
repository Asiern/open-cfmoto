import { RegionClient, resolveBaseUrlFromRegionDomain } from '../region';
import { CloudAuthError } from '../types';

describe('RegionClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  test('listLoginAreas() devuelve lista tipada en respuesta exitosa', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        data: [
          { areaNo: 'ES', country: 'Spain', region: 'eu-central-1', domain: 'tapi-flkf.cfmoto-oversea.com' },
          { areaNo: 'US', country: 'United States', region: 'us-east-1', domain: 'tapi-fjny.cfmoto-oversea.com' },
        ],
      }),
    } as Response);

    const client = new RegionClient('https://tapi.cfmoto-oversea.com/v1.0');
    const areas = await client.listLoginAreas();

    expect(areas).toHaveLength(2);
    expect(areas[0]).toMatchObject({ areaNo: 'ES', domain: 'tapi-flkf.cfmoto-oversea.com' });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/fuel-user/serveruser/app/auth/user/getLoginArea');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  test('listLoginAreas() incluye headers de auth firma y app fingerprint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '0', data: [] }),
    } as Response);

    const client = new RegionClient('https://tapi.cfmoto-oversea.com/v1.0');
    await client.listLoginAreas();

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer cfmoto_virtual_vehicle_token');
    expect(headers.get('user_id')).toBe('');
    expect(headers.has('sign')).toBe(true);
    expect(headers.has('nonce')).toBe(true);
    expect(headers.has('timestamp')).toBe(true);
    expect(headers.has('X-App-Info')).toBe(true);
    expect(headers.has('User-Agent')).toBe(true);
  });

  test('listLoginAreas() lanza CloudAuthError en error API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '40001', msg: 'bad sign' }),
    } as Response);

    const client = new RegionClient('https://tapi.cfmoto-oversea.com/v1.0');
    await expect(client.listLoginAreas()).rejects.toBeInstanceOf(CloudAuthError);
  });
});

describe('resolveBaseUrlFromRegionDomain()', () => {
  test('normaliza dominio simple', () => {
    expect(resolveBaseUrlFromRegionDomain('tapi-flkf.cfmoto-oversea.com')).toBe(
      'https://tapi-flkf.cfmoto-oversea.com/v1.0',
    );
  });

  test('limpia protocolo y barras finales', () => {
    expect(resolveBaseUrlFromRegionDomain('https://tapi-fjny.cfmoto-oversea.com/')).toBe(
      'https://tapi-fjny.cfmoto-oversea.com/v1.0',
    );
  });
});
