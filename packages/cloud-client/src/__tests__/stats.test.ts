import { StatsClient } from '../stats';
import { CloudAuthError, MonthRideData, RideReport, TotalRideMile } from '../types';

describe('StatsClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const report: RideReport = {
    scoreTotal: 82.5,
    scoreMaxSpeed: 90.0,
    scoreMileage: 78.0,
    scoreRapidAcceleration: 85.0,
    scoreRapidDeceleration: 80.0,
    scoreTurn: 88.0,
    scoreDriveSeconds: 75.0,
    percentMaxSpeed: 0.15,
    percentMileage: 0.25,
    percentRapidAcceleration: 0.1,
    percentRapidDeceleration: 0.08,
    percentRapidTurn: 0.12,
    percentDriveSeconds: 0.3,
    maxSpeed: 112.3,
    avgRideMileageDay: 24.5,
    rideMileageMonth: 490.0,
    ridingTimeMonth: 20.0,
    ridingTimeMonthSeconds: '72000',
    accelerationTimesMonth: '5',
    brakesTimesMonth: '3',
    bendingTimesMonth: '8',
    reportTime: '2024-03-01',
    mileageVisualizationDes: 'You rode further than',
    mileageVisualizationReference: 'Madrid to Barcelona',
    mileageVisualizationUnit: 'km',
    mileageVisualizationValue: 490,
    mileageVisualizationVerb: 'covered',
  };

  const monthData: MonthRideData = {
    date: 1709251200000,
    rideMileage: 490.0,
    list: [
      {
        reportTime: 1709337600000,
        rideMileage: 32.5,
        ridingTime: 1.2,
        ridingTimeSeconds: '4320',
        maxSpeed: 98.0,
        accelerationTimes: 1,
        brakesTimes: 0,
        bendingTimes: 3,
        powerConsumption: '2.1',
      },
    ],
  };

  const totalMile: TotalRideMile = {
    totalRideMile: '1234.5',
    abnormalValue: false,
    isKline: false,
  };

  // ─── getRideReport() ─────────────────────────────────────────────────────────

  describe('getRideReport()', () => {
    test('returns RideReport on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: report }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const result = await client.getRideReport('tok-1', 'veh-1', '2024-03-01');

      expect(result.scoreTotal).toBe(82.5);
      expect(result.maxSpeed).toBe(112.3);
      expect(result.accelerationTimesMonth).toBe('5');
    });

    test('sends vehicleId and date as query params', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: report }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await client.getRideReport('tok-1', 'veh-42', '2024-03-01');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/ride/report');
      expect(url).toContain('vehicleId=veh-42');
      expect(url).toContain('date=2024-03-01');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: report }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await client.getRideReport('tok-report', 'veh-1', '2024-03-01');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-report');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getRideReport('expired', 'veh-1', '2024-03-01'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code !== 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'no access to vehicle' }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const err = await client.getRideReport('tok-1', 'veh-1', '2024-03-01').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => {
          throw new SyntaxError('bad json');
        },
      } as unknown as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getRideReport('tok-1', 'veh-1', '2024-03-01'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── getMonthRideData() ───────────────────────────────────────────────────────

  describe('getMonthRideData()', () => {
    test('returns MonthRideData with list on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: monthData }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const result = await client.getMonthRideData('tok-1', 'veh-1', '2024-03');

      expect(result.rideMileage).toBe(490.0);
      expect(result.list).toHaveLength(1);
      expect(result.list?.[0]?.rideMileage).toBe(32.5);
      expect(result.list?.[0]?.ridingTimeSeconds).toBe('4320');
    });

    test('returns empty list when list is []', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: { rideMileage: 0, list: [] } }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const result = await client.getMonthRideData('tok-1', 'veh-1', '2024-03');
      expect(result.list).toEqual([]);
    });

    test('sends vehicleId and month as query params', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: monthData }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await client.getMonthRideData('tok-1', 'veh-99', '2024-03');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/ride/report/list/month');
      expect(url).toContain('vehicleId=veh-99');
      expect(url).toContain('month=2024-03');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: monthData }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await client.getMonthRideData('tok-month', 'veh-1', '2024-03');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-month');
      expect(headers.has('sign')).toBe(true);
    });

    test('throws CloudAuthError on HTTP 500', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ code: 50000, msg: 'Internal server error' }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getMonthRideData('tok-1', 'veh-1', '2024-03'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when success === false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', success: false, msg: 'no data' }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getMonthRideData('tok-1', 'veh-1', '2024-03'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => {
          throw new SyntaxError('bad json');
        },
      } as unknown as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getMonthRideData('tok-1', 'veh-1', '2024-03'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });
  });

  // ─── getTotalRideMile() ───────────────────────────────────────────────────────

  describe('getTotalRideMile()', () => {
    test('returns TotalRideMile on success', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: totalMile }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const result = await client.getTotalRideMile('tok-1', 'veh-1');

      expect(result.totalRideMile).toBe('1234.5');
      expect(result.abnormalValue).toBe(false);
      expect(result.isKline).toBe(false);
    });

    test('sends vehicleId as query param', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: totalMile }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await client.getTotalRideMile('tok-1', 'veh-77');

      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('/ride/TotalRideMile/get');
      expect(url).toContain('vehicleId=veh-77');
    });

    test('includes Authorization and signed headers', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: totalMile }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await client.getTotalRideMile('tok-total', 'veh-1');

      const headers = new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit,
      );
      expect(headers.get('Authorization')).toBe('Bearer tok-total');
      expect(headers.has('sign')).toBe(true);
      expect(headers.has('nonce')).toBe(true);
    });

    test('handles abnormalValue === true', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '0', data: { totalRideMile: '99999', abnormalValue: true, isKline: false } }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const result = await client.getTotalRideMile('tok-1', 'veh-1');
      expect(result.abnormalValue).toBe(true);
      expect(result.totalRideMile).toBe('99999');
    });

    test('throws CloudAuthError on HTTP 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 40100, msg: 'Unauthorized' }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getTotalRideMile('expired', 'veh-1'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });

    test('throws CloudAuthError when code !== 0', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: '40301', msg: 'vehicle not found' }),
      } as Response);

      const client = new StatsClient('https://example.test/v1.0');
      const err = await client.getTotalRideMile('tok-1', 'veh-1').catch((e) => e);
      expect(err).toBeInstanceOf(CloudAuthError);
      expect((err as CloudAuthError).codeText).toBe('40301');
    });

    test('throws CloudAuthError on invalid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => {
          throw new SyntaxError('bad json');
        },
      } as unknown as Response);

      const client = new StatsClient('https://example.test/v1.0');
      await expect(
        client.getTotalRideMile('tok-1', 'veh-1'),
      ).rejects.toBeInstanceOf(CloudAuthError);
    });
  });
});
