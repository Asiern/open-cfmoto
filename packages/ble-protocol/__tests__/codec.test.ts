import { buildFrame, parseFrame, calcCRC, CodecError, FRAME_HEADER_0, FRAME_HEADER_1, FRAME_END } from '../src/codec';

describe('calcCRC', () => {
  test('sums bytes mod 256', () => {
    // bytes: [0x67, 0x00, 0x00] → sum = 0x67 = 103
    expect(calcCRC(new Uint8Array([0x67, 0x00, 0x00]))).toBe(0x67);
  });

  test('wraps at 256', () => {
    // 0xFF + 0x01 = 0x100 → mod 256 = 0x00
    expect(calcCRC(new Uint8Array([0xff, 0x01]))).toBe(0x00);
  });

  test('empty input returns 0', () => {
    expect(calcCRC(new Uint8Array([]))).toBe(0);
  });
});

describe('buildFrame', () => {
  test('produces correct header bytes', () => {
    const frame = buildFrame(0x67, new Uint8Array([]));
    expect(frame[0]).toBe(0xab);
    expect(frame[1]).toBe(0xcd);
  });

  test('control code is at byte[2]', () => {
    const frame = buildFrame(0x5a, new Uint8Array([0x01, 0x02]));
    expect(frame[2]).toBe(0x5a);
  });

  test('length is little-endian at bytes[3..4]', () => {
    const payload = new Uint8Array(300); // 0x012C
    const frame = buildFrame(0x01, payload);
    expect(frame[3]).toBe(0x2c); // lenLo
    expect(frame[4]).toBe(0x01); // lenHi
  });

  test('payload is at bytes[5..5+N-1]', () => {
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const frame = buildFrame(0x6a, payload);
    expect(Array.from(frame.slice(5, 9))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  test('last byte is 0xCF', () => {
    const frame = buildFrame(0x67, new Uint8Array([0x01]));
    expect(frame[frame.length - 1]).toBe(0xcf);
  });

  test('total length is 7 + payloadLength', () => {
    // header(2) + control(1) + len(2) + payload(N) + crc(1) + end(1) = 7 + N
    const frame = buildFrame(0x67, new Uint8Array(5));
    expect(frame.length).toBe(12);
  });

  test('CRC byte is correct', () => {
    const payload = new Uint8Array([0x08, 0x01]); // Heartbeat{ping:1} proto encoding
    const frame = buildFrame(0x67, payload);
    // CRC covers bytes[2..end-2]: [controlCode, lenLo, lenHi, ...payload]
    const crcInput = frame.slice(2, frame.length - 2);
    const expectedCrc = crcInput.reduce((acc: number, b: number) => (acc + b) & 0xff, 0);
    expect(frame[frame.length - 2]).toBe(expectedCrc);
  });
});

describe('parseFrame', () => {
  test('roundtrip: parseFrame(buildFrame(code, payload))', () => {
    const payload = new Uint8Array([0x08, 0x01]);
    const frame = buildFrame(0x67, payload);
    const result = parseFrame(frame);
    expect(result.valid).toBe(true);
    expect(result.controlCode).toBe(0x67);
    expect(Array.from(result.payload)).toEqual(Array.from(payload));
  });

  test('returns valid=false for wrong header byte[0]', () => {
    const frame = buildFrame(0x67, new Uint8Array([0x01]));
    frame[0] = 0xaa; // corrupt header
    const result = parseFrame(frame);
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for wrong header byte[1]', () => {
    const frame = buildFrame(0x67, new Uint8Array([0x01]));
    frame[1] = 0x00;
    const result = parseFrame(frame);
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for wrong end byte (0xCF)', () => {
    const frame = buildFrame(0x67, new Uint8Array([0x01]));
    frame[frame.length - 1] = 0x00;
    const result = parseFrame(frame);
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for corrupted CRC', () => {
    const frame = buildFrame(0x67, new Uint8Array([0x01]));
    frame[frame.length - 2] ^= 0xff; // flip all bits in CRC byte
    const result = parseFrame(frame);
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for frame too short', () => {
    const result = parseFrame(new Uint8Array([0xab, 0xcd, 0x67]));
    expect(result.valid).toBe(false);
  });

  test('handles zero-length payload', () => {
    const frame = buildFrame(0x6c, new Uint8Array([]));
    const result = parseFrame(frame);
    expect(result.valid).toBe(true);
    expect(result.payload.length).toBe(0);
  });
});

// Keep CodecError exported for consumers that need to catch codec failures
describe('CodecError', () => {
  test('is an Error subclass', () => {
    const err = new CodecError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CodecError');
  });
});

// Verify exported constants
describe('frame constants', () => {
  test('FRAME_HEADER_0 is 0xAB', () => expect(FRAME_HEADER_0).toBe(0xab));
  test('FRAME_HEADER_1 is 0xCD', () => expect(FRAME_HEADER_1).toBe(0xcd));
  test('FRAME_END is 0xCF', () => expect(FRAME_END).toBe(0xcf));
});
