/**
 * Tests for AuthFlow — 4-step BLE authentication for CFMoto 450-series TBox.
 */

import CryptoJS from 'crypto-js';
import { AuthFlow, AuthError, AuthCredentials } from '../src/auth';
import { ResponseRouter, ControlCode } from '../src/response-router';
import { buildFrame, parseFrame } from '../src/codec';
import {
  AuthPackage,
  TboxRandomNum,
  TboxAuthResult,
  RandomNum,
} from '../src/generated/meter';
import { CFMoto450Protocol } from '../src/cfmoto450';
import { BleTransport, PeripheralInfo } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a valid incoming frame (as if from the bike) for a given control code
 * and proto-encoded payload.
 */
function buildBikeFrame(controlCode: number, payload: Uint8Array): Uint8Array {
  return buildFrame(controlCode, payload);
}

/**
 * Known AES-256/ECB/PKCS7 test values:
 * key = "12345678901234567890123456789012" (32 UTF-8 bytes → AES-256)
 * plaintext = "test"
 */
const TEST_KEY = '12345678901234567890123456789012';

/** Encrypt plaintext with AES-256/ECB/PKCS7 using crypto-js; returns raw ciphertext bytes. */
function aesEncrypt(plaintext: string, keyUtf8: string): Uint8Array {
  const keyWordArray = CryptoJS.enc.Utf8.parse(keyUtf8);
  const plaintextWordArray = CryptoJS.enc.Utf8.parse(plaintext);
  const encrypted = CryptoJS.AES.encrypt(plaintextWordArray, keyWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  const words = encrypted.ciphertext.words;
  const bytes = new Uint8Array(encrypted.ciphertext.sigBytes);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = (words[Math.floor(i / 4)]! >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Setup factory
// ---------------------------------------------------------------------------

function makeAuthSetup() {
  const sentFrames: Uint8Array[] = [];
  const sendFn = jest.fn(async (frame: Uint8Array) => {
    sentFrames.push(frame);
  });
  const router = new ResponseRouter();
  const auth = new AuthFlow(sendFn, router);
  return { auth, sendFn, router, sentFrames };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthFlow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  test('authenticate() sends 0x5A frame with correct encryptValue', async () => {
    const { auth, sentFrames, router } = makeAuthSetup();
    const encryptValue = 'deadbeef';
    const plaintext = 'challenge_response';
    const cipherBytes = aesEncrypt(plaintext, TEST_KEY);
    const cipherHex = hexEncode(cipherBytes);
    // TboxRandomNum.codec = UTF-8 bytes of the hex ciphertext string
    const codecBytes = new TextEncoder().encode(cipherHex);

    const authPromise = auth.authenticate({ encryptValue, key: TEST_KEY });

    // Let microtasks run so sendFn is called
    await Promise.resolve();

    // Verify 0x5A was sent
    expect(sentFrames.length).toBeGreaterThanOrEqual(1);
    const firstFrame = sentFrames[0]!;
    expect(firstFrame[2]).toBe(ControlCode.AUTH_PACKAGE); // 0x5A

    // Decode the proto payload inside the frame
    const parsed = parseFrame(firstFrame);
    expect(parsed.valid).toBe(true);
    const authPkg = AuthPackage.decode(parsed.payload);
    expect(Array.from(authPkg.info)).toEqual(Array.from(hexDecode(encryptValue)));

    // Complete the handshake so the promise doesn't hang
    const randomNumMsg = TboxRandomNum.fromPartial({ codec: codecBytes });
    const step2Frame = buildBikeFrame(
      ControlCode.TBOX_RANDOM_NUM,
      TboxRandomNum.encode(randomNumMsg).finish(),
    );
    router.dispatch(step2Frame);

    await Promise.resolve();

    const authResultMsg = TboxAuthResult.fromPartial({ result: 0 });
    const step4Frame = buildBikeFrame(
      ControlCode.TBOX_AUTH_RESULT,
      TboxAuthResult.encode(authResultMsg).finish(),
    );
    router.dispatch(step4Frame);

    await authPromise;
  });

  // -------------------------------------------------------------------------
  test('authenticate() sends 0x5C frame after 0x5B received', async () => {
    const { auth, sentFrames, router } = makeAuthSetup();
    const plaintext = 'challenge_response_sn_12345';
    const cipherBytes = aesEncrypt(plaintext, TEST_KEY);
    const cipherHex = hexEncode(cipherBytes);
    const codecBytes = new TextEncoder().encode(cipherHex);

    const authPromise = auth.authenticate({ encryptValue: 'aabbccdd', key: TEST_KEY });

    // Flush microtasks (sendFn called for step 1)
    await Promise.resolve();

    // Simulate bike sending 0x5B TboxRandomNum
    const randomNumMsg = TboxRandomNum.fromPartial({ codec: codecBytes });
    const step2Frame = buildBikeFrame(
      ControlCode.TBOX_RANDOM_NUM,
      TboxRandomNum.encode(randomNumMsg).finish(),
    );
    router.dispatch(step2Frame);

    // Let step 3 (sendFn for 0x5C) execute
    await Promise.resolve();
    await Promise.resolve();

    // Verify 0x5C was sent
    const step3Frame = sentFrames.find((f) => f[2] === ControlCode.RANDOM_NUM);
    expect(step3Frame).toBeDefined();

    // Decode and verify RandomNum.sn = AES decrypt result
    const parsed = parseFrame(step3Frame!);
    expect(parsed.valid).toBe(true);
    const randomNum = RandomNum.decode(parsed.payload);
    expect(randomNum.sn).toBe(plaintext);

    // Complete: send 0x5D
    const authResultMsg = TboxAuthResult.fromPartial({ result: 0 });
    const step4Frame = buildBikeFrame(
      ControlCode.TBOX_AUTH_RESULT,
      TboxAuthResult.encode(authResultMsg).finish(),
    );
    router.dispatch(step4Frame);

    await authPromise;
  });

  // -------------------------------------------------------------------------
  test('authenticate() resolves when 0x5D result=0 received', async () => {
    const { auth, router } = makeAuthSetup();
    const plaintext = 'test_sn';
    const cipherBytes = aesEncrypt(plaintext, TEST_KEY);
    const cipherHex = hexEncode(cipherBytes);
    const codecBytes = new TextEncoder().encode(cipherHex);

    const authPromise = auth.authenticate({ encryptValue: 'cafe', key: TEST_KEY });
    await Promise.resolve();

    // 0x5B
    router.dispatch(
      buildBikeFrame(
        ControlCode.TBOX_RANDOM_NUM,
        TboxRandomNum.encode(TboxRandomNum.fromPartial({ codec: codecBytes })).finish(),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();

    // 0x5D result=0
    router.dispatch(
      buildBikeFrame(
        ControlCode.TBOX_AUTH_RESULT,
        TboxAuthResult.encode(TboxAuthResult.fromPartial({ result: 0 })).finish(),
      ),
    );

    await expect(authPromise).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  test('authenticate() throws AuthError when 0x5D result=1 received', async () => {
    const { auth, router } = makeAuthSetup();
    const plaintext = 'test_sn';
    const cipherBytes = aesEncrypt(plaintext, TEST_KEY);
    const cipherHex = hexEncode(cipherBytes);
    const codecBytes = new TextEncoder().encode(cipherHex);

    const authPromise = auth.authenticate({ encryptValue: 'cafe', key: TEST_KEY });
    await Promise.resolve();

    // 0x5B
    router.dispatch(
      buildBikeFrame(
        ControlCode.TBOX_RANDOM_NUM,
        TboxRandomNum.encode(TboxRandomNum.fromPartial({ codec: codecBytes })).finish(),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();

    // 0x5D result=1 (failure)
    router.dispatch(
      buildBikeFrame(
        ControlCode.TBOX_AUTH_RESULT,
        TboxAuthResult.encode(TboxAuthResult.fromPartial({ result: 1 })).finish(),
      ),
    );

    await expect(authPromise).rejects.toThrow(AuthError);
    await expect(authPromise).rejects.toThrow(/Auth rejected by bike/);
  });

  // -------------------------------------------------------------------------
  test('authenticate() throws AuthError (timeout) if 0x5B never arrives', async () => {
    const { auth } = makeAuthSetup();

    const authPromise = auth.authenticate({ encryptValue: 'aabb', key: TEST_KEY });
    await Promise.resolve();

    // Advance past 5s timeout
    jest.advanceTimersByTime(5001);

    await expect(authPromise).rejects.toThrow(AuthError);
    await expect(authPromise).rejects.toThrow(/Timeout waiting for 0x5B/);
  });

  // -------------------------------------------------------------------------
  test('authenticate() throws AuthError (timeout) if 0x5D never arrives', async () => {
    const { auth, router } = makeAuthSetup();
    const plaintext = 'test_sn';
    const cipherBytes = aesEncrypt(plaintext, TEST_KEY);
    const cipherHex = hexEncode(cipherBytes);
    const codecBytes = new TextEncoder().encode(cipherHex);

    const authPromise = auth.authenticate({ encryptValue: 'aabb', key: TEST_KEY });
    await Promise.resolve();

    // 0x5B arrives (step 1 completes), but 0x5D never arrives
    router.dispatch(
      buildBikeFrame(
        ControlCode.TBOX_RANDOM_NUM,
        TboxRandomNum.encode(TboxRandomNum.fromPartial({ codec: codecBytes })).finish(),
      ),
    );
    await Promise.resolve();
    await Promise.resolve();

    // Advance past 5s timeout for step 4
    jest.advanceTimersByTime(5001);

    await expect(authPromise).rejects.toThrow(AuthError);
    await expect(authPromise).rejects.toThrow(/Timeout waiting for 0x5D/);
  });

  // -------------------------------------------------------------------------
  test('AES-256/ECB/PKCS7 decrypt produces correct output for known round-trip vector', () => {
    // This test exercises the crypto primitive used in authenticate()
    // by verifying encrypt → decrypt round-trip with a known key and plaintext.
    const plaintext = 'challenge_response_sn_12345';
    const key = TEST_KEY;

    const cipherBytes = aesEncrypt(plaintext, key);
    expect(cipherBytes.length).toBeGreaterThan(0);

    // Re-implement decrypt inline (mirrors auth.ts aesDecrypt)
    const keyWordArray = CryptoJS.enc.Utf8.parse(key);
    const ciphertextWordArray = CryptoJS.lib.WordArray.create(
      cipherBytes as unknown as number[],
    );
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertextWordArray } as CryptoJS.lib.CipherParams,
      keyWordArray,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 },
    );
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    expect(result).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// CFMoto450Protocol.connect() — no-credentials path
// ---------------------------------------------------------------------------

describe('CFMoto450Protocol — no credentials', () => {
  function makeMockTransport(): BleTransport {
    return {
      scan: jest.fn<Promise<PeripheralInfo[]>, [string[], number]>().mockResolvedValue([]),
      stopScan: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      connect: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
      disconnect: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
      write: jest.fn<Promise<void>, [string, string, string, Uint8Array, boolean]>().mockResolvedValue(undefined),
      requestMtu: jest.fn<Promise<number>, [string, number]>().mockResolvedValue(185),
      subscribe: jest.fn<Promise<() => void>, [string, string, string, (data: Uint8Array) => void]>().mockResolvedValue(
        () => {},
      ),
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('connect() with no credentials logs warning and sends no 0x5A frame', async () => {
    const transport = makeMockTransport();
    const protocol = new CFMoto450Protocol();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const connectPromise = protocol.connect(transport, 'device-id');

    // Advance through the delays: 100ms post-connect + 2000ms post-MTU
    await jest.advanceTimersByTimeAsync(2200);

    await connectPromise;

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No auth credentials provided'),
    );

    // write() should never have been called (no 0x5A frame sent)
    expect(transport.write).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
