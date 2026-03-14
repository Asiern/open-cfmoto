import { UserClient } from '../user';
import { CloudAuthError, UserProfile } from '../types';

describe('UserClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const profile: UserProfile = {
    userId: 'user-1',
    nickName: 'Rider',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+34600000000',
    gender: 1,
    areaNo: 'ES',
    isDealer: false,
  };

  describe('getProfile()', () => {
    test('devuelve UserProfile en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profile }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      const result = await client.getProfile('tok-1');

      expect(result).toEqual(expect.objectContaining({
        userId: 'user-1',
        nickName: 'Rider',
        email: 'john@example.com',
        areaNo: 'ES',
      }));
      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/app/auth/user/user_info',
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
    });

    test('incluye Authorization y headers firmados', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profile }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await client.getProfile('tok-abc');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-abc');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
      expect(headers.has('timestamp')).toBe(true);
    });

    test('lanza CloudAuthError en error HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await expect(client.getProfile('tok-expired')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40003', msg: 'token invalid' }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      const err = await client.getProfile('tok-bad').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40003');
    });

    test('lanza CloudAuthError si JSON inválido', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => { throw new SyntaxError('bad json'); },
      } as unknown as Response);

      const client = new UserClient('https://example.test/v1.0');
      await expect(client.getProfile('tok-1')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  describe('updateProfile()', () => {
    test('devuelve perfil actualizado en respuesta exitosa', async () => {
      const updated = { ...profile, nickName: 'SpeedRacer' };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: updated }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      const result = await client.updateProfile('tok-1', { nickName: 'SpeedRacer' });

      expect(result.nickName).toBe('SpeedRacer');
      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/app/auth/user/update_info',
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' });
    });

    test('envía el body correcto como JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profile }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await client.updateProfile('tok-1', { nickName: 'Racer', gender: 1, photo: 'https://img/a.jpg' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body).toEqual({ nickName: 'Racer', gender: 1, photo: 'https://img/a.jpg' });
    });

    test('incluye Content-Type y Authorization', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profile }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await client.updateProfile('tok-put', { nickName: 'X' });

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-put');
      expect(headers.get('Content-Type')).toContain('application/json');
      expect(headers.has('sign')).toBe(true);
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 40000, msg: 'Bad Request' }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await expect(client.updateProfile('tok-1', { nickName: 'X' })).rejects.toBeInstanceOf(
        CloudAuthError,
      );
    });
  });

  describe('updateAreaNo()', () => {
    test('resuelve void en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await expect(client.updateAreaNo('tok-1', 'ES')).resolves.toBeUndefined();

      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/app/auth/user/updateUserAreaNo',
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    });

    test('envía { areaNo } en el body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await client.updateAreaNo('tok-1', 'DE');

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body).toEqual({ areaNo: 'DE' });
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ code: 50000, msg: 'Server Error' }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await expect(client.updateAreaNo('tok-1', 'ES')).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'area not allowed' }),
      } as Response);

      const client = new UserClient('https://example.test/v1.0');
      await expect(client.updateAreaNo('tok-1', 'ZZ')).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
