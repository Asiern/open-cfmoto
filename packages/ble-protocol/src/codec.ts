/**
 * TBox BLE frame codec — confirmed from jadx decompilation.
 *
 * Frame format (TboxMessageFrame.java, TBoxCrcFrame.java, TboxFrameDecoder.java):
 *   [0xAB, 0xCD, controlCode, lenLo, lenHi, ...protobufPayload, crc, 0xCF]
 *
 *   Offset  Field         Notes
 *   [0]     Header[0]     0xAB
 *   [1]     Header[1]     0xCD
 *   [2]     ControlCode   1 byte — see ControlCode in response-router.ts
 *   [3]     LenLo         payload length, low byte (little-endian)
 *   [4]     LenHi         payload length, high byte (little-endian)
 *   [5..N]  Payload       protobuf-encoded message (Meter.*)
 *   [N+1]   CRC           byte-addition sum of bytes[2..N], mod 256 (NOT XOR)
 *   [N+2]   End           0xCF
 */

export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodecError';
  }
}

export const FRAME_HEADER_0 = 0xab;
export const FRAME_HEADER_1 = 0xcd;
export const FRAME_END = 0xcf;

/**
 * Byte-addition CRC over the provided bytes, truncated to 8 bits.
 * Covers bytes[2..end-2] of a full frame (controlCode + len + payload).
 * Exported for unit tests.
 */
export function calcCRC(bytes: Uint8Array): number {
  let acc = 0;
  for (const b of bytes) {
    acc = (acc + b) & 0xff;
  }
  return acc;
}

/**
 * Build a TBox BLE frame.
 * @param controlCode - 1-byte command identifier
 * @param payload     - protobuf-encoded message bytes
 */
export function buildFrame(controlCode: number, payload: Uint8Array): Uint8Array {
  const N = payload.length;
  // total = header(2) + control(1) + len(2) + payload(N) + crc(1) + end(1)
  const frame = new Uint8Array(7 + N);

  frame[0] = FRAME_HEADER_0;
  frame[1] = FRAME_HEADER_1;
  frame[2] = controlCode & 0xff;
  frame[3] = N & 0xff;        // lenLo
  frame[4] = (N >> 8) & 0xff; // lenHi
  frame.set(payload, 5);

  // CRC covers bytes[2..5+N-1] = controlCode + lenLo + lenHi + payload
  frame[5 + N] = calcCRC(frame.subarray(2, 5 + N));
  frame[6 + N] = FRAME_END;

  return frame;
}

export interface ParseResult {
  valid: boolean;
  controlCode: number;
  payload: Uint8Array;
}

/**
 * Parse an incoming TBox BLE frame.
 * Returns { valid: false } for any structural or CRC error — never throws.
 */
export function parseFrame(bytes: Uint8Array): ParseResult {
  const invalid: ParseResult = { valid: false, controlCode: 0, payload: new Uint8Array(0) };

  // Minimum frame: 7 bytes (header + control + len + crc + end, zero payload)
  if (bytes.length < 7) return invalid;
  if (bytes[0] !== FRAME_HEADER_0) return invalid;
  if (bytes[1] !== FRAME_HEADER_1) return invalid;
  if (bytes[bytes.length - 1] !== FRAME_END) return invalid;

  const controlCode = bytes[2]!;
  const N = (bytes[3]! & 0xff) | (bytes[4]! << 8);

  // Total expected length: 7 + N
  if (bytes.length !== 7 + N) return invalid;

  const crcByte = bytes[5 + N]!;
  const expectedCrc = calcCRC(bytes.subarray(2, 5 + N));
  if (crcByte !== expectedCrc) return invalid;

  const payload = bytes.slice(5, 5 + N);
  return { valid: true, controlCode, payload };
}
