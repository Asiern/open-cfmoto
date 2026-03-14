/**
 * CFMoto TBox BLE authentication flow — STUB.
 *
 * Exact 2-send / 2-receive sequence (from BleModel.java):
 *
 *   App → Bike  0x5A  AuthPackage { info: hex_decode(encryptValue) }
 *   Bike → App  0x5B  TboxRandomNum { codec: string }   ← encrypted random challenge
 *   App → Bike  0x5C  RandomNum { sn: AES256_ECB_PKCS7_decrypt(codec, key) }
 *   Bike → App  0x5D  TboxAuthResult { result: 0 }      ← 0 = success
 *
 * Keys (encryptValue, key, iv) come from cloud API: VehicleNowInfoResp.encryptInfo.
 * Cloud API integration is NOT in scope for Block 1.
 *
 * Crypto: AES-256/ECB/PKCS7Padding (BouncyCastle).
 *   - Key:   raw bytes of encryptInfo.key string (UTF-8)
 *   - Input: TboxRandomNum.codec string (NOT hex-decoded — pass as-is to AES decrypt)
 *   - Output: decrypted string → RandomNum.sn field
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
   * Auth Step 2: decrypt the bike's random challenge and build the response frame payload.
   * Called after receiving control 0x5B (TboxRandomNum) from the bike.
   *
   * @param _codec - The encrypted random challenge from the bike. This is
   *   `TboxRandomNum.codec` as a string. Note: the proto field is `bytes` (Uint8Array),
   *   so the caller must convert first:
   *   `const codec = new TextDecoder().decode(tboxRandomNum.codec)`
   *   before passing it here. The resulting string is passed as-is to AES-256 decrypt.
   * @param _key   - AES key string from VehicleNowInfoResp.encryptInfo.key (UTF-8 bytes)
   * @returns Uint8Array — encoded RandomNum { sn: decryptedString } protobuf bytes,
   *          ready for buildFrame(0x5C, ...)
   * @throws NotImplementedError — cloud key integration not yet in scope
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async step2(_codec: string, _key: string): Promise<Uint8Array> {
    throw new NotImplementedError(
      'Auth Step 2 not implemented: requires encryptInfo.key for AES-256/ECB/PKCS7 decrypt. ' +
        'See docs/protocol.md §6 for crypto details.',
    );
  }
}
