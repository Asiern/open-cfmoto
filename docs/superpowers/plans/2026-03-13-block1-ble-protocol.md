# Block 1 — BLE Protocol Core Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the confirmed TBox BLE protocol layer: codec, auth stub, keep-alive, MTU negotiation, and response router — all with unit tests, no cfmoto450.ts changes yet.

**Architecture:** All new code lives in `packages/ble-protocol/src/`. Protobuf messages are defined in `proto/meter.proto`, generated once via `protoc + ts-proto` and committed to `src/generated/meter.ts` so CI never needs protoc. The codec handles raw framing; response routing and keep-alive are separate modules that compose on top of it.

**Tech Stack:** TypeScript, Jest (ts-jest), @bufbuild/protobuf (runtime), ts-proto (devDep, codegen only), protoc (nix devShell, codegen only)

---

## Chunk 1: Protobuf setup and codegen

### Task 1: Add ts-proto and generate meter.ts

**Files:**
- Create: `packages/ble-protocol/proto/meter.proto`
- Create: `packages/ble-protocol/src/generated/meter.ts` (generated, committed)
- Modify: `packages/ble-protocol/package.json`

- [ ] **Step 1.1: Install ts-proto and add proto:gen script**

Edit `packages/ble-protocol/package.json`:

```json
{
  "name": "@open-cfmoto/ble-protocol",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "clean": "rm -rf dist",
    "proto:gen": "protoc -I=proto --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=./src/generated --ts_proto_opt=esModuleInterop=true --ts_proto_opt=outputEncodeMethods=true --ts_proto_opt=outputJsonMethods=false --ts_proto_opt=useOptionals=messages --ts_proto_opt=onlyTypes=false --ts_proto_opt=forceLong=number meter.proto"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "ts-proto": "^2.7.0",
    "typescript": "~5.8.3"
  }
}
```

> **Note:** ts-proto generates self-contained TypeScript with its own internal BinaryReader/BinaryWriter — it has **no runtime dependency**. Do NOT add `@bufbuild/protobuf`; that is the runtime for the unrelated `protobuf-es` toolchain. Run `pnpm install` from repo root after editing.

- [ ] **Step 1.2: Create proto/meter.proto**

```
packages/ble-protocol/proto/meter.proto
```

Full content:

```protobuf
syntax = "proto3";

option java_package = "com.cfmoto.proto";
option java_outer_classname = "Meter";

// Auth step 1 — App→Bike (control 0x5A)
message AuthPackage {
  bytes info = 1;
}

// Auth step 2 — Bike→App (control 0x5B): bike random challenge
message TboxRandomNum {
  bytes codec = 1;
}

// Auth step 3 — App→Bike (control 0x5C): decrypted challenge response
message RandomNum {
  string sn = 1;
}

// Auth result — Bike→App (control 0x5D): 0 = success
message TboxAuthResult {
  int32 result = 1;
}

// Keep-alive ping — App→Bike (control 0x67, ping=1)
message Heartbeat {
  int32 ping = 1;
}

// Lock/unlock/power — App→Bike (control 0x67)
message Lock {
  enum Type {
    UNUSE1 = 0;
    MOTORCYCLE = 1;
    SADDLE = 2;
    MAIN_STAND = 3;
    STORAGE_BOX = 4;
    SIDE_BOX = 5;
    TAIL_BOX = 6;
    POWER_ON_OFF = 7;
  }
  enum State {
    UNUSE2 = 0;
    UNLOCKED = 1;
    LOCKED = 2;
    POWER_ON = 3;
    POWER_OFF = 4;
  }
  Type type = 1;
  State state = 2;
}

// Find car (flash/horn/headlight) — App→Bike (control 0x6A)
message FindCar {
  bool headlightStatus = 1;
  bool doubleflashStatus = 2;
  bool loudspeakerStatus = 3;
}

// Turn signal control — App→Bike (control 0x6B)
message LightControl {
  enum Type {
    NONE2 = 0;
    RIGHT_OPEN = 1;
    RIGHT_CLOSE = 2;
    LEFT_OPEN = 3;
    LEFT_CLOSE = 4;
  }
  Type type = 1;
}

// Ignition — App→Bike (control 0x79)
message KL15 {
  int32 kL15 = 1;
}

// 4G module command — App→Bike (control 0x0A)
message Operate4g {
  int32 command = 1;
  int32 body = 2;
  int32 msgId = 3;
}

// 4G module complex command — App→Bike (control 0x0C)
message Operate4gComplex {
  int32 command = 1;
  string body = 2;
  int32 msgId = 3;
}

// Enable/disable charging — App→Bike (control 0x0B)
message ChargeStatus {
  bool enableCharge = 1;
}

// Charge power setting — App→Bike (control 0x71)
message ChargeSetting {
  int32 chargePower = 1;
}

// Max speed limit — App→Bike (control 0x68)
message Preference {
  int32 maximumSpeedLimit = 1;
}

// Display units — App→Bike (control 0x69)
message Display {
  enum Distance {
    NONE1 = 0;
    KM = 1;
    MILE = 2;
  }
  enum Temperature {
    NONE2 = 0;
    CELSIUS = 1;
    FAHRENHEIT = 2;
  }
  enum Time {
    NONE3 = 0;
    H12 = 1;
    H24 = 2;
  }
  enum Language {
    NONE4 = 0;
    CN = 1;
    EN = 2;
  }
  Distance distance = 1;
  Temperature temperature = 2;
  Time time = 3;
  Language languageType = 4;
}

// Charger info query — App→Bike (control 0x15)
message PatchObtainInfoControl {
  int32 groupId = 1;
}

// Charger info response — Bike→App (control 0x95)
message PatchObtainInfoResult {
  int32 chargerConnState = 1;
  int32 chargState = 2;
}

// Generic command result — Bike→App (0xE7, 0xEA, 0xEB, 0xF9, 0x8B)
// errRes on LockControll: 0/1=unlock, 16/17=lock, 32/33=powerOn, 48/49=powerOff
message CommandResult {
  int32 result = 1;
  int32 errRes = 2;
}

// 4G command result — Bike→App (0x8A, 0x8C)
message CommandResult2 {
  int32 result = 1;
  int32 errorCode = 2;
}

// Display theme — App→Bike (control 0x65)
message Theme {
  int32 themes = 1;
}

// Navigation — App→Bike (control 0x66)
message Navi {
  int32 direction = 1;
  int32 distance = 2;
}
```

- [ ] **Step 1.3: Run codegen**

From repo root:
```bash
pnpm install
cd packages/ble-protocol
pnpm proto:gen
```

Expected: `src/generated/meter.ts` is created (approx 800–1200 lines of TypeScript).

- [ ] **Step 1.4: Verify the generated file typechecks**

```bash
pnpm --filter @open-cfmoto/ble-protocol typecheck
```

Expected: no errors. If there are errors in the generated file, they are likely from ts-proto options — adjust `--ts_proto_opt` flags in the `proto:gen` script (common fix: add `--ts_proto_opt=stringEnums=false`).

- [ ] **Step 1.5: Commit proto schema and generated output**

```bash
git add packages/ble-protocol/proto/meter.proto \
        packages/ble-protocol/src/generated/meter.ts \
        packages/ble-protocol/package.json \
        pnpm-lock.yaml
git commit -m "feat(ble-protocol): add Meter protobuf schema and generated TypeScript"
```

---

## Chunk 2: Rewrite codec.ts (F01)

### Task 2: Replace codec.ts with confirmed TBox frame format

**Files:**
- Modify: `packages/ble-protocol/src/codec.ts` (full rewrite)
- Modify: `packages/ble-protocol/__tests__/codec.test.ts` (full rewrite)

The confirmed frame format (from `TboxFrameDecoder.java`, `TboxMessageFrame.java`, `TBoxCrcFrame.java`):
```
[0xAB, 0xCD, controlCode, lenLo, lenHi, ...protobufPayload, crc, 0xCF]
```
CRC = byte-addition sum of bytes[2..end-2] mod 256 (NOT XOR).

- [ ] **Step 2.1: Write failing tests first**

Replace `packages/ble-protocol/__tests__/codec.test.ts` entirely:

```typescript
import { buildFrame, parseFrame, calcCRC, CodecError } from '../src/codec';

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
    const expectedCrc = crcInput.reduce((acc, b) => (acc + b) & 0xff, 0);
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
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=codec
```

Expected: All tests fail with import errors / type errors (old codec.ts exports don't match).

- [ ] **Step 2.3: Replace codec.ts**

Replace `packages/ble-protocol/src/codec.ts` entirely:

```typescript
/**
 * TBox BLE frame codec — confirmed from jadx decompilation.
 *
 * Frame format (TboxMessageFrame.java, TBoxCrcFrame.java, TboxFrameDecoder.java):
 *   [0xAB, 0xCD, controlCode, lenLo, lenHi, ...protobufPayload, crc, 0xCF]
 *
 *   Offset  Field         Notes
 *   [0]     Header[0]     0xAB
 *   [1]     Header[1]     0xCD
 *   [2]     ControlCode   1 byte — see ControlCode constants
 *   [3]     LenLo         payload length, low byte (little-endian)
 *   [4]     LenHi         payload length, high byte (little-endian)
 *   [5..N]  Payload       protobuf-encoded message
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
 * @param controlCode - 1-byte command identifier (see ControlCode)
 * @param payload     - protobuf-encoded message bytes
 */
export function buildFrame(controlCode: number, payload: Uint8Array): Uint8Array {
  const N = payload.length;
  // total = header(2) + control(1) + len(2) + payload(N) + crc(1) + end(1)
  const frame = new Uint8Array(7 + N);

  frame[0] = FRAME_HEADER_0;
  frame[1] = FRAME_HEADER_1;
  frame[2] = controlCode & 0xff;
  frame[3] = N & 0xff;         // lenLo
  frame[4] = (N >> 8) & 0xff;  // lenHi
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
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=codec
```

Expected: All tests pass.

- [ ] **Step 2.5: Typecheck**

```bash
pnpm --filter @open-cfmoto/ble-protocol typecheck
```

> **Note:** `cfmoto450.ts` still imports `decodePacket`/`encodeCommand` from codec — those exports are gone. You will see type errors from that file. Fix them now by removing the broken imports from `cfmoto450.ts` and commenting out the body of `handleNotification` and `sendHandshake` with a `// TODO(block2): rewire to new codec` comment.

Expected after cfmoto450.ts fix: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add packages/ble-protocol/src/codec.ts \
        packages/ble-protocol/__tests__/codec.test.ts \
        packages/ble-protocol/src/cfmoto450.ts
git commit -m "feat(ble-protocol): rewrite codec with confirmed TBox frame format (F01)"
```

---

## Chunk 3: Auth stub (F02)

### Task 3: Implement auth flow stub

**Files:**
- Create: `packages/ble-protocol/src/auth.ts`
- Create: `packages/ble-protocol/__tests__/auth.test.ts`

The auth sequence (from `BleModel.java`, `AES256EncryptionUtil.java`):
```
App→Bike  0x5A  AuthPackage { info: hex_decode(encryptValue) }
Bike→App  0x5B  TboxRandomNum { codec: <bytes> }
App→Bike  0x5C  RandomNum { sn: AES256_ECB_PKCS7_decrypt(codec, key) }
Bike→App  0x5D  TboxAuthResult { result: 0 }
```
Auth keys (`encryptValue`, `key`) come from cloud API `VehicleNowInfoResp.encryptInfo` — not in scope.

- [ ] **Step 3.1: Write failing tests**

Create `packages/ble-protocol/__tests__/auth.test.ts`:

```typescript
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
```

- [ ] **Step 3.2: Run to confirm failure**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=auth
```

Expected: FAIL — `../src/auth` not found.

- [ ] **Step 3.3: Implement auth.ts stub**

Create `packages/ble-protocol/src/auth.ts`:

```typescript
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
   * Auth Step 1: build and return an AuthPackage frame payload.
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
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=auth
```

Expected: All 3 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add packages/ble-protocol/src/auth.ts \
        packages/ble-protocol/__tests__/auth.test.ts
git commit -m "feat(ble-protocol): add auth flow stub with NotImplementedError (F02)"
```

---

## Chunk 4: Response router (F05)

### Task 4: Implement response router

**Files:**
- Create: `packages/ble-protocol/src/response-router.ts`
- Create: `packages/ble-protocol/__tests__/response-router.test.ts`

The response router parses incoming BLE notification frames and dispatches to registered handlers by control code. All 11 bike→app control codes from protocol.md §4 are supported.

- [ ] **Step 4.1: Write failing tests**

Create `packages/ble-protocol/__tests__/response-router.test.ts`:

```typescript
import { ResponseRouter, ControlCode } from '../src/response-router';
import { buildFrame } from '../src/codec';

describe('ResponseRouter', () => {
  let router: ResponseRouter;

  beforeEach(() => {
    router = new ResponseRouter();
  });

  test('dispatches to registered handler by control code', () => {
    const received: Uint8Array[] = [];
    router.register(ControlCode.LOCK_RESULT, (payload) => received.push(payload));

    const payload = new Uint8Array([0x08, 0x01]);
    router.dispatch(buildFrame(ControlCode.LOCK_RESULT, payload));

    expect(received).toHaveLength(1);
    expect(Array.from(received[0]!)).toEqual(Array.from(payload));
  });

  test('dispatches different control codes to different handlers', () => {
    const lockResults: Uint8Array[] = [];
    const findCarResults: Uint8Array[] = [];

    router.register(ControlCode.LOCK_RESULT, (p) => lockResults.push(p));
    router.register(ControlCode.FIND_CAR_RESULT, (p) => findCarResults.push(p));

    router.dispatch(buildFrame(ControlCode.LOCK_RESULT, new Uint8Array([0x01])));
    router.dispatch(buildFrame(ControlCode.FIND_CAR_RESULT, new Uint8Array([0x02])));

    expect(lockResults).toHaveLength(1);
    expect(findCarResults).toHaveLength(1);
  });

  test('silently ignores unknown control codes', () => {
    expect(() => router.dispatch(buildFrame(0x42, new Uint8Array([])))).not.toThrow();
  });

  test('silently ignores invalid frames (bad header)', () => {
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    expect(() => router.dispatch(bad)).not.toThrow();
  });

  test('register returns an unregister function', () => {
    const received: Uint8Array[] = [];
    const unregister = router.register(ControlCode.LOCK_RESULT, (p) => received.push(p));

    router.dispatch(buildFrame(ControlCode.LOCK_RESULT, new Uint8Array([0x01])));
    expect(received).toHaveLength(1);

    unregister();
    router.dispatch(buildFrame(ControlCode.LOCK_RESULT, new Uint8Array([0x02])));
    expect(received).toHaveLength(1); // no new calls after unregister
  });

  test('supports multiple handlers for same control code', () => {
    const calls: number[] = [];
    router.register(ControlCode.TBOX_AUTH_RESULT, () => calls.push(1));
    router.register(ControlCode.TBOX_AUTH_RESULT, () => calls.push(2));

    router.dispatch(buildFrame(ControlCode.TBOX_AUTH_RESULT, new Uint8Array([0x08, 0x00])));

    expect(calls.sort()).toEqual([1, 2]);
  });

  test('all bike→app control codes are defined in ControlCode', () => {
    const bikeToAppCodes = [
      0x5b, // TBOX_RANDOM_NUM
      0x5d, // TBOX_AUTH_RESULT
      0x8a, // OPERATE_4G_RESULT
      0x8b, // RECHARGE_RESULT
      0x8c, // OPERATE_4G_COMPLEX_RESULT
      0x95, // PATCH_OBTAIN_INFO_RESULT
      0xe7, // LOCK_RESULT
      0xea, // FIND_CAR_RESULT
      0xeb, // LIGHT_CONTROL_RESULT
      0xf1, // CHARGE_OPT_RESULT
      0xf9, // KL15_RESULT
    ];
    for (const code of bikeToAppCodes) {
      expect(Object.values(ControlCode)).toContain(code);
    }
  });
});
```

- [ ] **Step 4.2: Run to confirm failure**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=response-router
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement response-router.ts**

Create `packages/ble-protocol/src/response-router.ts`:

```typescript
/**
 * Response router — dispatches incoming BLE notification frames to handlers
 * by control code.
 *
 * Control codes are the confirmed bike→app codes from protocol.md §4.
 * App→bike codes are included too for completeness (used when registering
 * response handlers for outgoing commands).
 */

import { parseFrame } from './codec';

/**
 * All TBox control codes, both directions.
 * Hex values confirmed from TboxControlCode.java and DecoderData.java.
 */
export const ControlCode = {
  // App → Bike (outgoing)
  OPERATE_4G: 0x0a,
  RECHARGE: 0x0b,
  OPERATE_4G_COMPLEX: 0x0c,
  PATCH_OBTAIN_INFO: 0x15,
  AUTH_PACKAGE: 0x5a,
  RANDOM_NUM: 0x5c,
  THEME: 0x65,
  NAVI: 0x66,
  LOCK_CONTROL: 0x67,
  PREFERENCE: 0x68,
  DISPLAY_UNITS: 0x69,
  FIND_CAR: 0x6a,
  LIGHT_CONTROL: 0x6b,
  KEEP_AUTH: 0x6c,
  CHARGE_OPT: 0x71,
  KL15: 0x79,

  // Bike → App (incoming notifications)
  TBOX_RANDOM_NUM: 0x5b,           // Auth step 2: bike random challenge
  TBOX_AUTH_RESULT: 0x5d,          // Auth result (0=success)
  OPERATE_4G_RESULT: 0x8a,         // 4G command result (CommandResult2)
  RECHARGE_RESULT: 0x8b,           // Recharge result (CommandResult)
  OPERATE_4G_COMPLEX_RESULT: 0x8c, // Complex 4G result (CommandResult2)
  PATCH_OBTAIN_INFO_RESULT: 0x95,  // Charger info result
  LOCK_RESULT: 0xe7,               // Lock/unlock/power ACK + heartbeat ACK (CommandResult)
  FIND_CAR_RESULT: 0xea,           // Find car result (CommandResult)
  LIGHT_CONTROL_RESULT: 0xeb,      // Light control result (CommandResult)
  CHARGE_OPT_RESULT: 0xf1,         // Charge opt result
  KL15_RESULT: 0xf9,               // KL15 result (CommandResult)
} as const;

export type ControlCodeValue = (typeof ControlCode)[keyof typeof ControlCode];
export type FrameHandler = (payload: Uint8Array) => void;

export class ResponseRouter {
  private handlers = new Map<number, Set<FrameHandler>>();

  /**
   * Register a handler for a specific control code.
   * @returns unregister function
   */
  register(code: number, handler: FrameHandler): () => void {
    let set = this.handlers.get(code);
    if (!set) {
      set = new Set();
      this.handlers.set(code, set);
    }
    set.add(handler);
    return () => {
      this.handlers.get(code)?.delete(handler);
    };
  }

  /**
   * Parse a raw BLE notification frame and dispatch to registered handlers.
   * Silently ignores invalid frames and unknown control codes.
   */
  dispatch(rawFrame: Uint8Array): void {
    const result = parseFrame(rawFrame);
    if (!result.valid) return;

    const set = this.handlers.get(result.controlCode);
    if (!set) return;

    for (const handler of set) {
      handler(result.payload);
    }
  }
}
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=response-router
```

Expected: All 6 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add packages/ble-protocol/src/response-router.ts \
        packages/ble-protocol/__tests__/response-router.test.ts
git commit -m "feat(ble-protocol): add response router with full bike→app control code table (F05)"
```

---

## Chunk 5: MTU negotiation (F04)

### Task 5: Add requestMtu to BleTransport and wire into connection flow

**Files:**
- Modify: `packages/ble-protocol/src/types.ts`
- Modify: `packages/ble-protocol/src/cfmoto450.ts`

No separate test file — `BleTransport` is an interface tested via integration. The mock in `cfmoto450.ts` tests will cover the call.

- [ ] **Step 5.1: Add requestMtu to BleTransport interface**

In `packages/ble-protocol/src/types.ts`, add one method to the `BleTransport` interface after `subscribe`:

```typescript
  /**
   * Request a specific ATT MTU from the peripheral.
   * The peripheral may negotiate a lower value.
   * @returns the negotiated MTU actually granted
   */
  requestMtu(peripheralId: string, mtu: number): Promise<number>;
```

Also extend `ConnectionState` to cover auth phases (used by keep-alive):

```typescript
export type ConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'       // notify registered, MTU set, auth pending
  | 'authenticated'   // auth complete, keep-alive running
  | 'error';
```

- [ ] **Step 5.2: Update MockBleTransport to satisfy the updated interface**

In `packages/ble-protocol/src/mock/mock-protocol.ts`, add this method to `MockBleTransport`:

```typescript
async requestMtu(_peripheralId: string, mtu: number): Promise<number> {
  return mtu; // mock: grant requested MTU
}
```

- [ ] **Step 5.3: Update RNBleTransport to satisfy the updated interface**

In `apps/mobile/src/services/ble-transport.adapter.ts`, add this method to `RNBleTransport` (after `subscribe`):

```typescript
async requestMtu(peripheralId: string, mtu: number): Promise<number> {
  const device = this.connectedDevices.get(peripheralId);
  if (!device) throw new Error(`Not connected to ${peripheralId}`);
  const updated = await device.requestMTU(mtu);
  return updated.mtu ?? mtu;
}
```

> `react-native-ble-plx`'s `Device.requestMTU(mtu)` returns the updated `Device` object; the negotiated MTU is in `device.mtu`.

- [ ] **Step 5.4: Update cfmoto450.ts to call requestMtu**

In `packages/ble-protocol/src/cfmoto450.ts`, update the `connect` method so that after `subscribe`, it calls `requestMtu` before any commands:

```typescript
async connect(transport: BleTransport, peripheralId: string): Promise<() => void> {
  this.transport = transport;
  this.peripheralId = peripheralId;

  await transport.connect(peripheralId);

  this.unsubscribeNotify = await transport.subscribe(
    peripheralId,
    SERVICE_MAIN,
    CHAR_NOTIFY,
    (data) => this.handleNotification(data),
  );

  // Negotiate MTU before any commands — confirmed 185 bytes (BleModel.java)
  await transport.requestMtu(peripheralId, 185);

  // TODO(block2): auth flow goes here (AuthFlow.step1)

  return () => this.cleanup();
}
```

Also remove the broken `decodePacket`/`encodeCommand` imports if not already done in Task 2.

- [ ] **Step 5.5: Typecheck (both package AND mobile app)**

```bash
pnpm --filter @open-cfmoto/ble-protocol typecheck
pnpm --filter @open-cfmoto/mobile typecheck
```

Expected: no errors in either. The mobile app typecheck confirms `RNBleTransport` satisfies the updated `BleTransport` interface.

- [ ] **Step 5.6: Commit**

```bash
git add packages/ble-protocol/src/types.ts \
        packages/ble-protocol/src/cfmoto450.ts \
        packages/ble-protocol/src/mock/mock-protocol.ts \
        apps/mobile/src/services/ble-transport.adapter.ts
git commit -m "feat(ble-protocol): add requestMtu to BleTransport, wire MTU=185 in connect (F04)"
```

---

## Chunk 6: Keep-alive (F03)

### Task 6: Implement keep-alive manager

**Files:**
- Create: `packages/ble-protocol/src/keepalive.ts`
- Create: `packages/ble-protocol/__tests__/keepalive.test.ts`

Keep-alive behavior (from BleConstant.java, BleModel.java):
- Heartbeat interval: 2000ms
- Watchdog timeout: 4000ms (if no ACK, call onDisconnect)
- Frame: `buildFrame(0x67, Heartbeat{ping:1})` — same control code as Lock
- ACK: incoming frame with control code 0xE7 (LOCK_RESULT)
- Start: after auth completes (stub: call `start()` manually)

- [ ] **Step 6.1: Write failing tests**

Create `packages/ble-protocol/__tests__/keepalive.test.ts`:

```typescript
import { KeepAliveManager } from '../src/keepalive';
import { parseFrame } from '../src/codec';
import { ControlCode } from '../src/response-router';

jest.useFakeTimers();

describe('KeepAliveManager', () => {
  let sentFrames: Uint8Array[];
  let disconnectCalled: boolean;
  let manager: KeepAliveManager;

  beforeEach(() => {
    sentFrames = [];
    disconnectCalled = false;
    manager = new KeepAliveManager(
      (frame) => { sentFrames.push(frame); return Promise.resolve(); },
      () => { disconnectCalled = true; },
    );
  });

  afterEach(() => {
    manager.stop();
    jest.clearAllTimers();
  });

  test('sends first heartbeat after 2000ms', () => {
    manager.start();
    expect(sentFrames).toHaveLength(0);

    jest.advanceTimersByTime(2000);
    expect(sentFrames).toHaveLength(1);

    const parsed = parseFrame(sentFrames[0]!);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LOCK_CONTROL); // 0x67
  });

  test('sends heartbeat every 2000ms', () => {
    manager.start();
    jest.advanceTimersByTime(6000);
    expect(sentFrames).toHaveLength(3);
  });

  test('does NOT call onDisconnect if ACK arrives before 4000ms', () => {
    manager.start();
    jest.advanceTimersByTime(2000); // sends heartbeat

    manager.notifyAck(); // simulate incoming 0xE7 ACK
    jest.advanceTimersByTime(3999); // watchdog would fire at 4000ms from heartbeat

    expect(disconnectCalled).toBe(false);
  });

  test('calls onDisconnect if no ACK within 4000ms of heartbeat', async () => {
    manager.start();
    jest.advanceTimersByTime(2000); // sends heartbeat, arms watchdog
    // Flush any pending microtasks (Promise.resolve from sendFn) before advancing watchdog
    await Promise.resolve();
    jest.advanceTimersByTime(4000); // watchdog fires

    expect(disconnectCalled).toBe(true);
  });

  test('stops sending after stop()', () => {
    manager.start();
    jest.advanceTimersByTime(2000);
    expect(sentFrames).toHaveLength(1);

    manager.stop();
    jest.advanceTimersByTime(10000);
    expect(sentFrames).toHaveLength(1);
  });

  test('stop() prevents watchdog from firing after stop', () => {
    manager.start();
    jest.advanceTimersByTime(2000); // sends heartbeat (watchdog armed)
    manager.stop();
    jest.advanceTimersByTime(5000); // watchdog would have fired

    expect(disconnectCalled).toBe(false);
  });
});
```

- [ ] **Step 6.2: Run to confirm failure**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=keepalive
```

Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement keepalive.ts**

Create `packages/ble-protocol/src/keepalive.ts`:

```typescript
/**
 * TBox BLE keep-alive manager.
 *
 * Sends Heartbeat{ping:1} via control code 0x67 every 2000ms.
 * Arms a 4000ms watchdog on each heartbeat — if no ACK (control 0xE7)
 * arrives before the watchdog fires, calls onDisconnect() and stops.
 *
 * Source: BleConstant.java (CONNECT_KEEP_LIVE_TIME=2000, CONNECT_KEEP_ALIVE_TIME_OUT=4000)
 *         BleModel.java (getLockControlFrame used for both Lock and Heartbeat)
 */

import { buildFrame } from './codec';
import { ControlCode } from './response-router';
import { Heartbeat } from './generated/meter';

const HEARTBEAT_INTERVAL_MS = 2000;
const WATCHDOG_TIMEOUT_MS = 4000;

export class KeepAliveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private watchdogId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private disconnectNotified = false;
  // Lazy-encoded on first use so module import never fails if generated/meter.ts is missing.
  private heartbeatFrame: Uint8Array | null = null;

  constructor(
    private readonly sendFn: (frame: Uint8Array) => Promise<void>,
    private readonly onDisconnect: () => void,
  ) {}

  private getHeartbeatFrame(): Uint8Array {
    if (!this.heartbeatFrame) {
      // ts-proto requires fromPartial() to fill in defaults before encoding
    const payload = Heartbeat.encode(Heartbeat.fromPartial({ ping: 1 })).finish();
      this.heartbeatFrame = buildFrame(ControlCode.LOCK_CONTROL, payload);
    }
    return this.heartbeatFrame;
  }

  /** Start the heartbeat loop. Call after auth completes. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  /** Stop the heartbeat loop and clear all timers. */
  stop(): void {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.clearWatchdog();
  }

  /**
   * Notify the manager that an ACK was received (incoming control 0xE7).
   * Call this from the response router's LOCK_RESULT handler.
   */
  notifyAck(): void {
    this.clearWatchdog();
  }

  /** Guards against calling onDisconnect more than once (watchdog + send-fail race). */
  private triggerDisconnect(): void {
    if (!this.disconnectNotified) {
      this.disconnectNotified = true;
      this.stop();
      this.onDisconnect();
    }
  }

  private sendHeartbeat(): void {
    this.armWatchdog();
    this.sendFn(this.getHeartbeatFrame()).catch(() => {
      this.triggerDisconnect();
    });
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdogId = setTimeout(() => {
      this.triggerDisconnect();
    }, WATCHDOG_TIMEOUT_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdogId !== null) {
      clearTimeout(this.watchdogId);
      this.watchdogId = null;
    }
  }
}
```

- [ ] **Step 6.4: Run tests to confirm they pass**

```bash
pnpm --filter @open-cfmoto/ble-protocol test -- --testPathPattern=keepalive
```

Expected: All 6 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add packages/ble-protocol/src/keepalive.ts \
        packages/ble-protocol/__tests__/keepalive.test.ts
git commit -m "feat(ble-protocol): add keep-alive manager (2s heartbeat, 4s watchdog) (F03)"
```

---

## Chunk 7: Wire up exports and full test run

### Task 7: Update index.ts and run all tests

**Files:**
- Modify: `packages/ble-protocol/src/index.ts`

- [ ] **Step 7.1: Update index.ts exports**

Replace `packages/ble-protocol/src/index.ts`:

```typescript
export * from './types';
export * from './uuids';
export * from './codec';
export * from './auth';
export * from './response-router';
export * from './keepalive';
export { CFMoto450Protocol } from './cfmoto450';
export { MockBleTransport, MockBikeProtocol } from './mock/mock-protocol';
// Note: src/generated/meter.ts is intentionally NOT re-exported from the package
// root — consumers import proto types directly: import { Lock } from '@open-cfmoto/ble-protocol/src/generated/meter'
```

- [ ] **Step 7.2: Run full test suite**

```bash
pnpm --filter @open-cfmoto/ble-protocol test
```

Expected: All tests pass (codec, auth, response-router, keepalive).

- [ ] **Step 7.3: Typecheck whole package**

```bash
pnpm --filter @open-cfmoto/ble-protocol typecheck
```

Expected: No errors.

- [ ] **Step 7.4: Final commit**

```bash
git add packages/ble-protocol/src/index.ts
git commit -m "feat(ble-protocol): wire up exports for Block 1 modules"
```

---

## Summary of files changed

| File | Status | Task |
|------|--------|------|
| `packages/ble-protocol/proto/meter.proto` | Created | 1 |
| `packages/ble-protocol/src/generated/meter.ts` | Generated+committed | 1 |
| `packages/ble-protocol/package.json` | Modified (ts-proto dep + proto:gen script) | 1 |
| `packages/ble-protocol/src/codec.ts` | Rewritten | 2 |
| `packages/ble-protocol/__tests__/codec.test.ts` | Rewritten | 2 |
| `packages/ble-protocol/src/auth.ts` | Created | 3 |
| `packages/ble-protocol/__tests__/auth.test.ts` | Created | 3 |
| `packages/ble-protocol/src/response-router.ts` | Created | 4 |
| `packages/ble-protocol/__tests__/response-router.test.ts` | Created | 4 |
| `packages/ble-protocol/src/types.ts` | Modified (requestMtu + ConnectionState) | 5 |
| `packages/ble-protocol/src/cfmoto450.ts` | Modified (requestMtu call, TODO stubs) | 5 |
| `packages/ble-protocol/src/mock/mock-protocol.ts` | Modified (requestMtu stub) | 5 |
| `apps/mobile/src/services/ble-transport.adapter.ts` | Modified (requestMtu impl) | 5 |
| `packages/ble-protocol/src/keepalive.ts` | Created | 6 |
| `packages/ble-protocol/__tests__/keepalive.test.ts` | Created | 6 |
| `packages/ble-protocol/src/index.ts` | Modified (new exports) | 7 |
| `flake.nix` | Modified (protobuf pkg) | prerequisite |
