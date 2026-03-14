import { parseFrame } from '../src/codec';
import { ControlCode } from '../src/response-router';
import {
  lock,
  unlock,
  findCar,
  setIndicators,
  setUnits,
  setSpeedLimit,
} from '../src/commands';
import {
  FindCar,
  Lock,
  Lock_Type,
  Lock_State,
  LightControl,
  LightControl_Type,
  Display,
  Display_Distance,
  Display_Temperature,
  Display_Time,
  Display_Language,
  Preference,
} from '../src/generated/meter';

function makeLockPayload(): Uint8Array {
  return Lock.encode(
    Lock.fromPartial({ type: Lock_Type.MOTORCYCLE, state: Lock_State.LOCKED }),
  ).finish();
}

describe('lock()', () => {
  test('returns a valid frame with LOCK_CONTROL code', () => {
    const payload = makeLockPayload();
    const frame = lock(payload);
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LOCK_CONTROL);
  });

  test('payload round-trips unchanged', () => {
    const payload = makeLockPayload();
    const frame = lock(payload);
    const parsed = parseFrame(frame);
    expect(parsed.payload).toEqual(payload);
  });
});

describe('unlock()', () => {
  test('returns a valid frame with LOCK_CONTROL code', () => {
    const payload = makeLockPayload();
    const frame = unlock(payload);
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LOCK_CONTROL);
  });

  test('payload round-trips unchanged', () => {
    const payload = makeLockPayload();
    const frame = unlock(payload);
    const parsed = parseFrame(frame);
    expect(parsed.payload).toEqual(payload);
  });
});

describe('findCar()', () => {
  test("horn mode: loudspeakerStatus=true, others false", () => {
    const frame = findCar('horn');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.FIND_CAR);
    const msg = FindCar.decode(parsed.payload);
    expect(msg.loudspeakerStatus).toBe(true);
    expect(msg.doubleflashStatus).toBe(false);
    expect(msg.headlightStatus).toBe(false);
  });

  test("flash mode: doubleflashStatus=true, others false", () => {
    const frame = findCar('flash');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.FIND_CAR);
    const msg = FindCar.decode(parsed.payload);
    expect(msg.doubleflashStatus).toBe(true);
    expect(msg.loudspeakerStatus).toBe(false);
    expect(msg.headlightStatus).toBe(false);
  });

  test("light mode: headlightStatus=true, others false", () => {
    const frame = findCar('light');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.FIND_CAR);
    const msg = FindCar.decode(parsed.payload);
    expect(msg.headlightStatus).toBe(true);
    expect(msg.loudspeakerStatus).toBe(false);
    expect(msg.doubleflashStatus).toBe(false);
  });
});

describe('setIndicators()', () => {
  test("right: LightControl_Type.RIGHT_OPEN", () => {
    const frame = setIndicators('right');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LIGHT_CONTROL);
    const msg = LightControl.decode(parsed.payload);
    expect(msg.type).toBe(LightControl_Type.RIGHT_OPEN);
  });

  test("left: LightControl_Type.LEFT_OPEN", () => {
    const frame = setIndicators('left');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LIGHT_CONTROL);
    const msg = LightControl.decode(parsed.payload);
    expect(msg.type).toBe(LightControl_Type.LEFT_OPEN);
  });

  test("off: LightControl_Type.NONE2", () => {
    const frame = setIndicators('off');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.LIGHT_CONTROL);
    const msg = LightControl.decode(parsed.payload);
    expect(msg.type).toBe(LightControl_Type.NONE2);
  });
});

describe('setUnits()', () => {
  test("metric: KM distance, CELSIUS temperature", () => {
    const frame = setUnits('metric');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.DISPLAY_UNITS);
    const msg = Display.decode(parsed.payload);
    expect(msg.distance).toBe(Display_Distance.KM);
    expect(msg.temperature).toBe(Display_Temperature.CELSIUS);
    expect(msg.time).toBe(Display_Time.H24);
    expect(msg.languageType).toBe(Display_Language.EN);
  });

  test("imperial: MILE distance, FAHRENHEIT temperature", () => {
    const frame = setUnits('imperial');
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.DISPLAY_UNITS);
    const msg = Display.decode(parsed.payload);
    expect(msg.distance).toBe(Display_Distance.MILE);
    expect(msg.temperature).toBe(Display_Temperature.FAHRENHEIT);
    expect(msg.time).toBe(Display_Time.H24);
    expect(msg.languageType).toBe(Display_Language.EN);
  });
});

describe('setSpeedLimit()', () => {
  test.each([0, 120, 255])('valid value %i returns a valid PREFERENCE frame', (kmh) => {
    const frame = setSpeedLimit(kmh);
    const parsed = parseFrame(frame);
    expect(parsed.valid).toBe(true);
    expect(parsed.controlCode).toBe(ControlCode.PREFERENCE);
    const msg = Preference.decode(parsed.payload);
    expect(msg.maximumSpeedLimit).toBe(kmh);
  });

  test('throws RangeError for kmh = 256', () => {
    expect(() => setSpeedLimit(256)).toThrow(RangeError);
  });

  test('throws RangeError for kmh = -1', () => {
    expect(() => setSpeedLimit(-1)).toThrow(RangeError);
  });
});

// heartbeat() removed from commands — KeepAliveManager owns the heartbeat frame.
