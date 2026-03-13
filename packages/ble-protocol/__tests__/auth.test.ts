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
    const fakeChallenge = new Uint8Array([0x01, 0x02, 0x03]);
    await expect(auth.step2(fakeChallenge)).rejects.toThrow(NotImplementedError);
  });

  test('step3 throws NotImplementedError', async () => {
    await expect(auth.step3('anyDecrypted')).rejects.toThrow(NotImplementedError);
  });
});
