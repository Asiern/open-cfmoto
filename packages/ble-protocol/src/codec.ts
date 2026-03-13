/**
 * Packet encode/decode: Uint8Array ↔ BikeData
 *
 * Packet structure (UNCONFIRMED — update from btsnoop/jadx):
 *
 *  Offset  Len  Description
 *  ------  ---  -----------
 *  0       1    Start byte   0xAA
 *  1       1    Message type 0x01 = telemetry
 *  2       1    Length       (payload length, not including header/checksum)
 *  3..N    var  Payload
 *  N+1     1    Checksum     XOR of bytes 1..N
 *
 * Telemetry payload (type=0x01, expected len=14):
 *  0–1   RPM         uint16 big-endian
 *  2–3   Speed×10    uint16 big-endian (km/h × 10)
 *  4     Gear        uint8 (0=N, 1-6=gear)
 *  5     Coolant °C  uint8 (value − 40 = actual °C)
 *  6–7   Battery mV  uint16 big-endian (÷ 1000 = V)
 *  8     Throttle %  uint8 (0–100)
 *  9–11  Odometer    uint24 big-endian (km)
 *  12    Fuel %      uint8 (0–100, 0xFF = not available)
 *  13    Fault count uint8
 */

import { BikeData } from './types';

export const START_BYTE = 0xaa;
export const MSG_TELEMETRY = 0x01;

export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodecError';
  }
}

/** XOR checksum of bytes from index start to end (exclusive) */
function xorChecksum(data: Uint8Array, start: number, end: number): number {
  let cs = 0;
  for (let i = start; i < end; i++) {
    cs ^= data[i]!;
  }
  return cs;
}

/**
 * Decode a raw BLE notification packet into BikeData.
 * Throws CodecError if the packet is malformed.
 */
export function decodePacket(raw: Uint8Array): BikeData {
  if (raw.length < 4) {
    throw new CodecError(`Packet too short: ${raw.length}`);
  }
  if (raw[0] !== START_BYTE) {
    throw new CodecError(`Bad start byte: 0x${raw[0]!.toString(16)}`);
  }

  const msgType = raw[1]!;
  const payloadLen = raw[2]!;
  const expectedTotal = 3 + payloadLen + 1; // header(3) + payload + checksum(1)

  if (raw.length < expectedTotal) {
    throw new CodecError(
      `Packet length mismatch: got ${raw.length}, expected ${expectedTotal}`,
    );
  }

  const checksum = raw[3 + payloadLen]!;
  const computed = xorChecksum(raw, 1, 3 + payloadLen);
  if (checksum !== computed) {
    throw new CodecError(
      `Checksum mismatch: got 0x${checksum.toString(16)}, computed 0x${computed.toString(16)}`,
    );
  }

  if (msgType !== MSG_TELEMETRY) {
    throw new CodecError(`Unknown message type: 0x${msgType.toString(16)}`);
  }

  if (payloadLen < 14) {
    throw new CodecError(`Telemetry payload too short: ${payloadLen}`);
  }

  const p = raw.slice(3, 3 + payloadLen);

  const rpm = ((p[0]! << 8) | p[1]!) >>> 0;
  const speedRaw = ((p[2]! << 8) | p[3]!) >>> 0;
  const gear = p[4]!;
  const coolantRaw = p[5]!;
  const batteryRaw = ((p[6]! << 8) | p[7]!) >>> 0;
  const throttle = p[8]!;
  const odoRaw = ((p[9]! << 16) | (p[10]! << 8) | p[11]!) >>> 0;
  const fuelRaw = p[12]!;
  const faultCount = p[13]!;

  return {
    rpm,
    speedKmh: speedRaw / 10,
    gear,
    coolantTempC: coolantRaw - 40,
    batteryVoltage: batteryRaw / 1000,
    throttlePercent: throttle,
    odometerKm: odoRaw,
    fuelPercent: fuelRaw === 0xff ? null : fuelRaw,
    faultCount,
    bikeTimestampMs: null,
  };
}

/** Build a command packet: [0xAA, cmd, len, ...payload, checksum] */
export function encodeCommand(cmd: number, payload: Uint8Array): Uint8Array {
  const buf = new Uint8Array(3 + payload.length + 1);
  buf[0] = START_BYTE;
  buf[1] = cmd;
  buf[2] = payload.length;
  buf.set(payload, 3);
  buf[3 + payload.length] = xorChecksum(buf, 1, 3 + payload.length);
  return buf;
}
