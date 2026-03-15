/**
 * BLE Authentication Flow for CFMoto 450-series TBox.
 *
 * Confirmed 4-step challenge-response from jadx decompilation of
 * com.cfmoto.cfmotointernational (BleModel.java, AES256EncryptionUtil.java).
 *
 * See docs/auth-protocol.md for full protocol documentation.
 */

import CryptoJS from 'crypto-js';
import { buildFrame } from './codec';
import {
  AuthPackage,
  TboxRandomNum,
  RandomNum,
  TboxAuthResult,
} from './generated/meter';
import { ControlCode, ResponseRouter } from './response-router';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthCredentials {
  /** Hex string from cloud API (VehicleNowInfoResp.encryptInfo.encryptValue) */
  encryptValue: string;
  /** AES key string from cloud API (VehicleNowInfoResp.encryptInfo.key), UTF-8 encoded */
  key: string;
}

/** Hex-decode a hex string into a Uint8Array. */
function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Decrypt ciphertext bytes using AES-256/ECB/PKCS7.
 * Mirrors AES256EncryptionUtil.decrypt(hexStr, key) from the APK.
 * - keyUtf8: the raw key string (UTF-8 bytes used as AES key)
 * - ciphertextBytes: raw binary ciphertext (hex-decoded from TboxRandomNum.codec)
 * Returns the decrypted UTF-8 string.
 */
function aesDecrypt(ciphertextBytes: Uint8Array, keyUtf8: string): string {
  const keyWordArray = CryptoJS.enc.Utf8.parse(keyUtf8);
  const ciphertextWordArray = CryptoJS.lib.WordArray.create(
    ciphertextBytes as unknown as number[],
  );
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertextWordArray } as CryptoJS.lib.CipherParams,
    keyWordArray,
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 },
  );
  return decrypted.toString(CryptoJS.enc.Utf8);
}

const AUTH_TIMEOUT_MS = 5000;

export class AuthFlow {
  constructor(
    private sendFn: (frame: Uint8Array) => Promise<void>,
    private router: ResponseRouter,
  ) {}

  /**
   * Execute the full 4-step BLE authentication sequence.
   * Resolves when the bike confirms success (0x5D result=0).
   * Rejects with AuthError on failure or timeout.
   *
   * Timeouts: 5000ms waiting for 0x5B, 5000ms waiting for 0x5D.
   */
  async authenticate(params: AuthCredentials): Promise<void> {
    const { encryptValue, key } = params;

    // --- Wait for 0x5B (TboxRandomNum) ---
    const randomNumPayload = await new Promise<Uint8Array>((resolve, reject) => {
      let unregister: (() => void) | null = null;
      const timer = setTimeout(() => {
        unregister?.();
        reject(new AuthError('Timeout waiting for 0x5B TboxRandomNum response'));
      }, AUTH_TIMEOUT_MS);

      unregister = this.router.register(ControlCode.TBOX_RANDOM_NUM, (payload) => {
        clearTimeout(timer);
        unregister?.();
        resolve(payload);
      });

      // Step 1: send 0x5A AuthPackage
      const raw = hexDecode(encryptValue);
      const authPkg = AuthPackage.fromPartial({ info: raw });
      const frame = buildFrame(
        ControlCode.AUTH_PACKAGE,
        AuthPackage.encode(authPkg).finish(),
      );
      this.sendFn(frame).catch((err: unknown) => {
        clearTimeout(timer);
        unregister?.();
        reject(new AuthError(`Failed to send 0x5A frame: ${String(err)}`));
      });
    });

    // Step 3: decode TboxRandomNum, decrypt, send 0x5C RandomNum
    const tboxRandomNum = TboxRandomNum.decode(randomNumPayload);

    // TODO(hardware): confirm TboxRandomNum.codec encoding.
    // APK analysis: codec contains ASCII chars of a hex string (toStringUtf8 → hexDecode → ciphertext).
    // If auth fails on hardware, also try:
    //   1. Pass raw codec bytes directly to AES (codec is raw binary ciphertext)
    //   2. Base64-decode codec string
    const codecHex = tboxRandomNum.codec;
    const ciphertext = hexDecode(codecHex);
    const sn = aesDecrypt(ciphertext, key);

    const randomNum = RandomNum.fromPartial({ sn });
    const step3Frame = buildFrame(
      ControlCode.RANDOM_NUM,
      RandomNum.encode(randomNum).finish(),
    );

    // --- Wait for 0x5D (TboxAuthResult) ---
    await new Promise<void>((resolve, reject) => {
      let unregister: (() => void) | null = null;
      const timer = setTimeout(() => {
        unregister?.();
        reject(new AuthError('Timeout waiting for 0x5D TboxAuthResult response'));
      }, AUTH_TIMEOUT_MS);

      unregister = this.router.register(ControlCode.TBOX_AUTH_RESULT, (payload) => {
        clearTimeout(timer);
        unregister?.();
        const result = TboxAuthResult.decode(payload);
        if (result.result !== 0) {
          reject(
            new AuthError(`Auth rejected by bike: TboxAuthResult.result=${result.result}`),
          );
        } else {
          resolve();
        }
      });

      this.sendFn(step3Frame).catch((err: unknown) => {
        clearTimeout(timer);
        unregister?.();
        reject(new AuthError(`Failed to send 0x5C frame: ${String(err)}`));
      });
    });
  }
}
