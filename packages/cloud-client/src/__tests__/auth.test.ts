import { CloudAuthClient } from '../auth';
import { CloudAuthError } from '../types';
import CryptoJS from 'crypto-js';

describe('CloudAuthClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  test('login() con credenciales correctas devuelve token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        data: { tokenInfo: { accessToken: 'session-token-123' }, userId: '42' },
      }),
    } as Response);

    const client = new CloudAuthClient('https://example.test/v1.0');
    await expect(client.login('john@example.com', 'pw')).resolves.toBe('session-token-123');
    expect(client.getToken()).toBe('session-token-123');
    expect(client.getUserId()).toBe('42');
  });

  test('login() con credenciales incorrectas lanza CloudAuthError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 40101, msg: 'invalid credentials' }),
    } as Response);

    const client = new CloudAuthClient('https://example.test/v1.0');
    await expect(client.login('wrong@example.com', 'bad')).rejects.toBeInstanceOf(CloudAuthError);
  });

  test('getToken() devuelve null antes de login', () => {
    const client = new CloudAuthClient('https://example.test/v1.0');
    expect(client.getToken()).toBeNull();
  });

  test('login() envía payload compatible con login_by_idcard', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '0', data: { tokenInfo: { accessToken: 'tok' } } }),
    } as Response);

    const client = new CloudAuthClient('https://example.test/v1.0');
    await client.login('john@example.com', 'pw');

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const passwordHash = CryptoJS.MD5('pw').toString(CryptoJS.enc.Hex);
    expect(url).toContain('/fuel-user/serveruser/app/auth/user/login_by_idcard');
    expect(JSON.parse(requestInit.body as string)).toMatchObject({
      idcard: 'john@example.com',
      idcardType: 'email',
      password: passwordHash,
      thirdpartyId: '',
      thirdpartyType: '',
      emailMarketingAlarm: false,
    });
  });

  test('login() reutiliza password si ya viene como md5', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '0', data: { tokenInfo: { accessToken: 'tok' } } }),
    } as Response);

    const md5Password = '4cec4ffca255209f3f536e61663a11a9';
    const client = new CloudAuthClient('https://example.test/v1.0');
    await client.login('john@example.com', md5Password);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(requestInit.body as string).password).toBe(md5Password);
  });
});
