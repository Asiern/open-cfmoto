import { CFMoto450Protocol } from '../cfmoto450';
import { AuthFlow } from '../auth';
import { BleTransport, PeripheralInfo } from '../types';

function makeMockTransport(): BleTransport {
  return {
    scan: jest.fn<Promise<PeripheralInfo[]>, [string[], number]>().mockResolvedValue([]),
    stopScan: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    connect: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    disconnect: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    write: jest
      .fn<Promise<void>, [string, string, string, Uint8Array, boolean]>()
      .mockResolvedValue(undefined),
    requestMtu: jest.fn<Promise<number>, [string, number]>().mockResolvedValue(185),
    subscribe: jest
      .fn<Promise<() => void>, [string, string, string, (data: Uint8Array) => void]>()
      .mockResolvedValue(() => {}),
  };
}

describe('CFMoto450Protocol.connect cloud flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('connect() con credentials llama login -> getEncryptInfo -> authenticate en orden', async () => {
    const transport = makeMockTransport();
    const order: string[] = [];

    const protocol = new CFMoto450Protocol({
      cloudAuthClient: {
        login: jest.fn(async () => {
          order.push('login');
          return 'token-1';
        }),
      },
      vehicleClient: {
        getEncryptInfo: jest.fn(async () => {
          order.push('getEncryptInfo');
          return {
            encryptValue: 'deadbeef',
            key: '12345678901234567890123456789012',
            iv: 'ignored-in-ecb',
          };
        }),
      },
    });

    jest.spyOn(AuthFlow.prototype, 'authenticate').mockImplementation(async () => {
      order.push('authenticate');
    });

    const connectPromise = protocol.connect(transport, 'device-id', {
      username: 'u',
      password: 'p',
      vehicleId: 'veh-1',
    });

    await jest.advanceTimersByTimeAsync(2200);
    await connectPromise;

    expect(order).toEqual(['login', 'getEncryptInfo', 'authenticate']);
  });

  test('connect() sin credentials salta auth con warning', async () => {
    const transport = makeMockTransport();
    const protocol = new CFMoto450Protocol();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const authSpy = jest
      .spyOn(AuthFlow.prototype, 'authenticate')
      .mockImplementation(async () => {});

    const connectPromise = protocol.connect(transport, 'device-id');
    await jest.advanceTimersByTimeAsync(2200);
    await connectPromise;

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No cloud credentials provided'),
    );
    expect(authSpy).not.toHaveBeenCalled();
  });

  test('connect() lanza error si login falla', async () => {
    const transport = makeMockTransport();
    const protocol = new CFMoto450Protocol({
      cloudAuthClient: {
        login: jest.fn(async () => {
          throw new Error('login failed');
        }),
      },
      vehicleClient: {
        getEncryptInfo: jest.fn(async () => ({
          encryptValue: 'x',
          key: '12345678901234567890123456789012',
          iv: '',
        })),
      },
    });

    const connectPromise = protocol.connect(transport, 'device-id', {
      username: 'u',
      password: 'bad',
      vehicleId: 'veh-1',
    });
    const rejection = expect(connectPromise).rejects.toThrow('login failed');
    await jest.advanceTimersByTimeAsync(2200);
    await rejection;
  });

  test('connect() lanza error si getEncryptInfo falla', async () => {
    const transport = makeMockTransport();
    const protocol = new CFMoto450Protocol({
      cloudAuthClient: {
        login: jest.fn(async () => 'token-2'),
      },
      vehicleClient: {
        getEncryptInfo: jest.fn(async () => {
          throw new Error('vehicle lookup failed');
        }),
      },
    });

    const authSpy = jest
      .spyOn(AuthFlow.prototype, 'authenticate')
      .mockImplementation(async () => {});

    const connectPromise = protocol.connect(transport, 'device-id', {
      username: 'u',
      password: 'p',
      vehicleId: 'missing',
    });
    const rejection = expect(connectPromise).rejects.toThrow('vehicle lookup failed');
    await jest.advanceTimersByTimeAsync(2200);
    await rejection;
    expect(authSpy).not.toHaveBeenCalled();
  });
});
