/**
 * CFMoto TBox BLE authentication flow — STUB.
 *
 * Full 3-step challenge-response sequence (from BleModel.java):
 *   Step 1 (App→Bike, 0x5A): AuthPackage { info: hex_decode(encryptValue) }
 *   Step 2 (Bike→App, 0x5B): TboxRandomNum { codec: <random_challenge_bytes> }
 *   Step 3 (App→Bike, 0x5C): RandomNum { sn: AES256_ECB_PKCS7_decrypt(codec, key) }
 *   Result (Bike→App, 0x5D): TboxAuthResult { result: 0 } → success
 *
 * Keys (encryptValue, key, iv) come from cloud API: VehicleNowInfoResp.encryptInfo.
 * Cloud API integration is NOT in scope for Block 1.
 *
 * Crypto: AES-256/ECB/PKCS7Padding (BouncyCastle).
 *   - Key:   raw bytes of encryptInfo.key string (UTF-8)
 *   - Input: hex-decode TboxRandomNum.codec
 *   - Output: decrypted string → RandomNum.sn
 */

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class AuthFlow {
  /**
   * Auth Step 1: build AuthPackage frame payload.
   * @param encryptValue - hex string from VehicleNowInfoResp.encryptInfo.encryptValue
   * @returns Uint8Array — encoded AuthPackage protobuf bytes, ready for buildFrame(0x5A, ...)
   * @throws NotImplementedError — cloud key integration not yet in scope
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async step1(_encryptValue: string): Promise<Uint8Array> {
    throw new NotImplementedError(
      'Auth Step 1 not implemented: requires VehicleNowInfoResp.encryptInfo from cloud API. ' +
        'See docs/protocol.md §6 for the full auth flow.',
    );
  }

  /**
   * Auth Step 2: decrypt the bike's random challenge.
   * @param challenge - TboxRandomNum.codec bytes received from bike (control 0x5B)
   * @returns Uint8Array — encoded RandomNum protobuf bytes, ready for buildFrame(0x5C, ...)
   * @throws NotImplementedError — cloud key integration not yet in scope
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async step2(_challenge: Uint8Array): Promise<Uint8Array> {
    throw new NotImplementedError(
      'Auth Step 2 not implemented: requires encryptInfo.key for AES-256/ECB/PKCS7 decrypt. ' +
        'See docs/protocol.md §6 for crypto details.',
    );
  }

  /**
   * Auth Step 3: send the decrypted challenge string back to the bike.
   * @param decrypted - plaintext result of AES decrypt
   * @returns Uint8Array — encoded RandomNum protobuf bytes, ready for buildFrame(0x5C, ...)
   * @throws NotImplementedError — cloud key integration not yet in scope
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async step3(_decrypted: string): Promise<Uint8Array> {
    throw new NotImplementedError(
      'Auth Step 3 not implemented: requires encryptInfo.key for AES-256/ECB/PKCS7 decrypt. ' +
        'See docs/protocol.md §6 for crypto details.',
    );
  }
}
