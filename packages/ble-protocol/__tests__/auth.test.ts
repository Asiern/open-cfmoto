import { AuthFlow, NotImplementedError } from '../src/auth';

describe('AuthFlow (stub)', () => {
  let auth: AuthFlow;

  beforeEach(() => {
    auth = new AuthFlow();
  });

  test('step1 throws NotImplementedError with descriptive message', async () => {
    await expect(auth.step1('anyEncryptValue')).rejects.toThrow(NotImplementedError);
    await expect(auth.step1('anyEncryptValue')).rejects.toThrow(
      /VehicleNowInfoResp\.encryptInfo/,
    );
  });

  test('step2 throws NotImplementedError', async () => {
    await expect(auth.step2('fakeCodecString', 'fakeKey')).rejects.toThrow(NotImplementedError);
  });
});
