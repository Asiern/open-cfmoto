import { CloudAuthClient } from '../auth';
import { CloudAuthError } from '../types';

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
      json: async () => ({ code: 0, data: { token: 'session-token-123' } }),
    } as Response);

    const client = new CloudAuthClient('https://example.test/v1.0');
    await expect(client.login('john@example.com', 'pw')).resolves.toBe('session-token-123');
    expect(client.getToken()).toBe('session-token-123');
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
});
