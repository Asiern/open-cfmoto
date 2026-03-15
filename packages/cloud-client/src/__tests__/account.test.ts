import CryptoJS from 'crypto-js';
import { AccountClient } from '../account';
import { CloudAuthError } from '../types';

// Pre-computed MD5 of 'password123' — asserts hashing without re-implementing it
const MD5_PASSWORD123 = '482c811da5d5b4bc6d497ffa98491e38';

describe('AccountClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const profileData = {
    userId: 'user-99',
    nickName: 'NewRider',
    email: 'new@example.com',
    tokenInfo: { accessToken: 'access-tok-xyz', expiresIn: 8640000 },
  };

  // ─── register() ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    test('devuelve RegisterResult con token y profile en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profileData }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      const result = await client.register({
        idcard: 'new@example.com',
        password: 'password123',
        verifyCode: '123456',
        areaNo: 'ES',
      });

      expect(result.token).toBe('access-tok-xyz');
      expect(result.userId).toBe('user-99');
      expect(result.profile).toMatchObject({ nickName: 'NewRider', email: 'new@example.com' });
      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/app/auth/user/register',
      );
    });

    test('envía la contraseña como MD5 hex — nunca como texto plano', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profileData }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.register({
        idcard: 'new@example.com',
        password: 'password123',
        verifyCode: '000000',
      });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.password).toBe(MD5_PASSWORD123);
      expect(body.password).not.toBe('password123');
    });

    test('detecta idcardType=email cuando idcard contiene @', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profileData }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.register({ idcard: 'user@test.com', password: 'pass', verifyCode: '000' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.idcardType).toBe('email');
    });

    test('detecta idcardType=phone cuando idcard no contiene @', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profileData }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.register({ idcard: '+34612345678', password: 'pass', verifyCode: '000' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.idcardType).toBe('phone');
    });

    test('incluye headers firmados en la petición', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: profileData }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.register({ idcard: 'u@t.com', password: 'p', verifyCode: '0' });

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
      expect(headers.has('timestamp')).toBe(true);
      expect(headers.get('Content-Type')).toContain('application/json');
    });

    test('lanza CloudAuthError si falta token en la respuesta', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: { userId: 'u1' } }), // no tokenInfo
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.register({ idcard: 'u@t.com', password: 'p', verifyCode: '0' }),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ code: 40900, msg: 'Account already exists' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.register({ idcard: 'u@t.com', password: 'p', verifyCode: '0' }),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '50001', msg: 'verify code error' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      const err = await client.register({ idcard: 'u@t.com', password: 'p', verifyCode: 'bad' }).catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('50001');
    });
  });

  // ─── sendCode() ──────────────────────────────────────────────────────────────

  describe('sendCode()', () => {
    test('resuelve void en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(client.sendCode({ idcard: 'user@test.com' })).resolves.toBeUndefined();

      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/common/code/send_code',
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    });

    test('envía idcard e idcardType en el body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.sendCode({ idcard: 'user@test.com', areaCode: '+34', areaNo: 'ES' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.idcard).toBe('user@test.com');
      expect(body.idcardType).toBe('email');
      expect(body.areaCode).toBe('34');
      expect(body.areaNo).toBe('ES');
    });

    test('usa areaNo vacío por defecto cuando no se especifica', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.sendCode({ idcard: 'user@test.com' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.areaNo).toBe('');
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ code: 42900, msg: 'Too Many Requests' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(client.sendCode({ idcard: 'u@t.com' })).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si code != 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40010', msg: 'idcard not registered' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(client.sendCode({ idcard: 'ghost@t.com' })).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── checkCode() ─────────────────────────────────────────────────────────────

  describe('checkCode()', () => {
    test('resuelve void con código correcto', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.checkCode({ idcard: 'user@test.com', verifyCode: '654321' }),
      ).resolves.toBeUndefined();

      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/common/code/check_code',
      );
    });

    test('envía verifyCode en el body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.checkCode({ idcard: 'user@test.com', verifyCode: '999888' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.verifyCode).toBe('999888');
      expect(body.idcard).toBe('user@test.com');
    });

    test('usa areaNo vacío por defecto cuando no se especifica', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.checkCode({ idcard: 'user@test.com', verifyCode: '123456' });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.areaNo).toBe('');
    });

    test('lanza CloudAuthError con código incorrecto', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40012', msg: 'verify code error' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.checkCode({ idcard: 'u@t.com', verifyCode: 'wrong' }),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError en error HTTP', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ code: 50000, msg: 'Server Error' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.checkCode({ idcard: 'u@t.com', verifyCode: '000' }),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── updatePassword() ────────────────────────────────────────────────────────

  describe('updatePassword()', () => {
    test('resuelve void en respuesta exitosa', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.updatePassword('tok-auth', { oldPassword: 'oldpass', newPassword: 'newpass456' }),
      ).resolves.toBeUndefined();

      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/fuel-user/serveruser/app/auth/user/update_password',
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    });

    test('envía ambas contraseñas como MD5 — nunca como texto plano', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.updatePassword('tok-auth', {
        oldPassword: 'password123',
        newPassword: 'newpass456',
      });

      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.oldPassword).toBe(MD5_PASSWORD123);
      expect(body.newPassword).toBe(CryptoJS.MD5('newpass456').toString());
      expect(body.oldPassword).not.toBe('password123');
      expect(body.newPassword).not.toBe('newpass456');
    });

    test('usa Authorization con el token del usuario', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: null }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await client.updatePassword('my-user-token', { oldPassword: 'a', newPassword: 'b' });

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer my-user-token');
      expect(headers.has('sign')).toBe(true);
    });

    test('lanza CloudAuthError en error HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      await expect(
        client.updatePassword('expired-tok', { oldPassword: 'a', newPassword: 'b' }),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('lanza CloudAuthError si la contraseña actual es incorrecta', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40011', msg: 'old password incorrect' }),
      } as Response);

      const client = new AccountClient('https://example.test/v1.0');
      const err = await client.updatePassword('tok', { oldPassword: 'wrong', newPassword: 'new' }).catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40011');
    });
  });
});
