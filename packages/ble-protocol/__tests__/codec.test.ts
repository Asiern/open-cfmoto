import { decodePacket, encodeCommand, CodecError, START_BYTE, MSG_TELEMETRY } from '../src/codec';

/** Build a valid telemetry packet for testing */
function buildTelemetryPacket(overrides: Partial<{
  rpm: number;
  speedX10: number;
  gear: number;
  coolantRaw: number;
  batteryMv: number;
  throttle: number;
  odometer: number;
  fuel: number;
  faults: number;
}> = {}): Uint8Array {
  const {
    rpm = 3000,
    speedX10 = 600, // 60.0 km/h
    gear = 3,
    coolantRaw = 125, // 85°C
    batteryMv = 12400,
    throttle = 30,
    odometer = 1234,
    fuel = 75,
    faults = 0,
  } = overrides;

  const payload = new Uint8Array(14);
  payload[0] = (rpm >> 8) & 0xff;
  payload[1] = rpm & 0xff;
  payload[2] = (speedX10 >> 8) & 0xff;
  payload[3] = speedX10 & 0xff;
  payload[4] = gear;
  payload[5] = coolantRaw;
  payload[6] = (batteryMv >> 8) & 0xff;
  payload[7] = batteryMv & 0xff;
  payload[8] = throttle;
  payload[9] = (odometer >> 16) & 0xff;
  payload[10] = (odometer >> 8) & 0xff;
  payload[11] = odometer & 0xff;
  payload[12] = fuel;
  payload[13] = faults;

  // Build full packet: [0xAA, msgType, len, ...payload, checksum]
  const packet = new Uint8Array(3 + payload.length + 1);
  packet[0] = START_BYTE;
  packet[1] = MSG_TELEMETRY;
  packet[2] = payload.length;
  packet.set(payload, 3);
  // XOR checksum of bytes 1..end-1
  let cs = 0;
  for (let i = 1; i < packet.length - 1; i++) cs ^= packet[i]!;
  packet[packet.length - 1] = cs;
  return packet;
}

describe('decodePacket', () => {
  test('decodes a valid telemetry packet', () => {
    const packet = buildTelemetryPacket();
    const data = decodePacket(packet);

    expect(data.rpm).toBe(3000);
    expect(data.speedKmh).toBe(60.0);
    expect(data.gear).toBe(3);
    expect(data.coolantTempC).toBe(85); // 125 - 40
    expect(data.batteryVoltage).toBeCloseTo(12.4);
    expect(data.throttlePercent).toBe(30);
    expect(data.odometerKm).toBe(1234);
    expect(data.fuelPercent).toBe(75);
    expect(data.faultCount).toBe(0);
  });

  test('decodes fuel=0xFF as null', () => {
    const packet = buildTelemetryPacket({ fuel: 0xff });
    const data = decodePacket(packet);
    expect(data.fuelPercent).toBeNull();
  });

  test('throws CodecError on bad start byte', () => {
    const packet = buildTelemetryPacket();
    packet[0] = 0xbb;
    expect(() => decodePacket(packet)).toThrow(CodecError);
  });

  test('throws CodecError on checksum mismatch', () => {
    const packet = buildTelemetryPacket();
    packet[packet.length - 1] ^= 0xff; // corrupt checksum
    expect(() => decodePacket(packet)).toThrow(CodecError);
  });

  test('throws CodecError on packet too short', () => {
    expect(() => decodePacket(new Uint8Array([0xaa, 0x01]))).toThrow(CodecError);
  });
});

describe('encodeCommand', () => {
  test('encodes command with correct structure', () => {
    const payload = new Uint8Array([0x01, 0x02]);
    const packet = encodeCommand(0x10, payload);

    expect(packet[0]).toBe(START_BYTE);
    expect(packet[1]).toBe(0x10);
    expect(packet[2]).toBe(2); // payload length
    expect(packet[3]).toBe(0x01);
    expect(packet[4]).toBe(0x02);
    // verify checksum
    let cs = 0;
    for (let i = 1; i < packet.length - 1; i++) cs ^= packet[i]!;
    expect(packet[packet.length - 1]).toBe(cs);
  });

  test('encodes empty payload', () => {
    const packet = encodeCommand(0x20, new Uint8Array(0));
    expect(packet.length).toBe(4); // header(3) + checksum(1)
  });
});
