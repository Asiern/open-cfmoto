/**
 * Pure command builder functions for the CFMoto TBox BLE protocol.
 *
 * Each function returns a fully-framed Uint8Array ready to write to the
 * BLE write characteristic. No side effects, no state.
 */

import { buildFrame } from '../codec';
import { ControlCode } from '../response-router';
import {
  FindCar,
  Lock,
  Lock_State,
  Lock_Type,
  LightControl,
  LightType,
  Display,
  Display_Distance,
  Display_Temperature,
  Display_Time,
  Display_Language,
  Preference,
} from '../generated/meter';

/**
 * Build lock payload with proto-aligned type/state enums.
 */
function buildLockPayload(type: Lock_Type, state: Lock_State): Uint8Array {
  return Lock.encode(Lock.fromPartial({ type, state })).finish();
}

/**
 * Build a LOCK_CONTROL (0x67) lock frame.
 * If a payload is provided, it is wrapped as-is for backwards compatibility.
 */
export function lock(payload?: Uint8Array): Uint8Array {
  const encoded = payload ?? buildLockPayload(Lock_Type.MOTORCYCLE, Lock_State.LOCKED);
  return buildFrame(ControlCode.LOCK_CONTROL, encoded);
}

/**
 * Build a LOCK_CONTROL (0x67) unlock frame.
 * If a payload is provided, it is wrapped as-is for backwards compatibility.
 */
export function unlock(payload?: Uint8Array): Uint8Array {
  const encoded = payload ?? buildLockPayload(Lock_Type.MOTORCYCLE, Lock_State.UNLOCKED);
  return buildFrame(ControlCode.LOCK_CONTROL, encoded);
}

/** Build a LOCK_CONTROL (0x67) power-on frame. */
export function powerOn(): Uint8Array {
  const payload = buildLockPayload(Lock_Type.POWER_ON_OFF, Lock_State.POWER_ON);
  return buildFrame(ControlCode.LOCK_CONTROL, payload);
}

/** Build a LOCK_CONTROL (0x67) power-off frame. */
export function powerOff(): Uint8Array {
  const payload = buildLockPayload(Lock_Type.POWER_ON_OFF, Lock_State.POWER_OFF);
  return buildFrame(ControlCode.LOCK_CONTROL, payload);
}

/**
 * Build a FindCar frame for the given mode.
 * - 'horn'  → activate loudspeaker
 * - 'flash' → activate double-flash lights
 * - 'light' → activate headlight
 */
export function findCar(mode: 'horn' | 'flash' | 'light'): Uint8Array {
  let msg: FindCar;
  switch (mode) {
    case 'horn':
      msg = FindCar.fromPartial({
        loudspeakerStatus: true,
        doubleflashStatus: false,
        headlightStatus: false,
      });
      break;
    case 'flash':
      msg = FindCar.fromPartial({
        doubleflashStatus: true,
        loudspeakerStatus: false,
        headlightStatus: false,
      });
      break;
    case 'light':
      msg = FindCar.fromPartial({
        headlightStatus: true,
        loudspeakerStatus: false,
        doubleflashStatus: false,
      });
      break;
  }
  const payload = FindCar.encode(msg).finish();
  return buildFrame(ControlCode.FIND_CAR, payload);
}

/**
 * Build a LightControl frame for turn signal control.
 * - 'right' → RIGHT_OPEN
 * - 'left'  → LEFT_OPEN
 * - 'off'   → NONE2
 */
export function setIndicators(side: 'left' | 'right' | 'off'): Uint8Array {
  let direction: LightType;
  switch (side) {
    case 'right':
      direction = LightType.RIGHT_OPEN;
      break;
    case 'left':
      direction = LightType.LEFT_OPEN;
      break;
    case 'off':
      direction = LightType.NONE2;
      break;
  }
  const payload = LightControl.encode(LightControl.fromPartial({ direction })).finish();
  return buildFrame(ControlCode.LIGHT_CONTROL, payload);
}

/**
 * Build a Display units frame.
 * - 'metric'   → KM, CELSIUS, H24, EN
 * - 'imperial' → MILE, FAHRENHEIT, H24, EN
 */
export function setUnits(system: 'metric' | 'imperial'): Uint8Array {
  const msg =
    system === 'metric'
      ? Display.fromPartial({
          distance: Display_Distance.KM,
          temperature: Display_Temperature.CELSIUS,
          time: Display_Time.H24,
          languageType: Display_Language.EN,
        })
      : Display.fromPartial({
          distance: Display_Distance.MILE,
          temperature: Display_Temperature.FAHRENHEIT,
          time: Display_Time.H24,
          languageType: Display_Language.EN,
        });
  const payload = Display.encode(msg).finish();
  return buildFrame(ControlCode.DISPLAY_UNITS, payload);
}

/**
 * Build a Preference frame setting the maximum speed limit.
 * @param kmh - Speed limit in km/h; must be in [0, 255].
 * @throws {RangeError} if kmh is outside [0, 255].
 */
export function setSpeedLimit(kmh: number): Uint8Array {
  if (kmh < 0 || kmh > 255) {
    throw new RangeError(`kmh must be between 0 and 255, got ${kmh}`);
  }
  const payload = Preference.encode(Preference.fromPartial({ maximumSpeedLimit: kmh })).finish();
  return buildFrame(ControlCode.PREFERENCE, payload);
}

// NOTE: Heartbeat frames are sent exclusively by KeepAliveManager.
// There is no public heartbeat() builder — use KeepAliveManager.start().
