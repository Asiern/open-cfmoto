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
  Heartbeat,
  LightControl,
  LightControl_Type,
  Display,
  Display_Distance,
  Display_Temperature,
  Display_Time,
  Display_Language,
  Preference,
} from '../generated/meter';

/**
 * Wrap pre-built Lock proto bytes in a LOCK_CONTROL frame for locking.
 * Callers are responsible for encoding the Lock protobuf message.
 */
export function lock(encryptedPayload: Uint8Array): Uint8Array {
  return buildFrame(ControlCode.LOCK_CONTROL, encryptedPayload);
}

/**
 * Wrap pre-built Lock proto bytes in a LOCK_CONTROL frame for unlocking.
 * Callers are responsible for encoding the Lock protobuf message.
 */
export function unlock(encryptedPayload: Uint8Array): Uint8Array {
  return buildFrame(ControlCode.LOCK_CONTROL, encryptedPayload);
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
  let type: LightControl_Type;
  switch (side) {
    case 'right':
      type = LightControl_Type.RIGHT_OPEN;
      break;
    case 'left':
      type = LightControl_Type.LEFT_OPEN;
      break;
    case 'off':
      type = LightControl_Type.NONE2;
      break;
  }
  const payload = LightControl.encode(LightControl.fromPartial({ type })).finish();
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

/**
 * Build a keep-alive heartbeat frame (Heartbeat { ping: 1 } on LOCK_CONTROL).
 */
export function heartbeat(): Uint8Array {
  const payload = Heartbeat.encode(Heartbeat.fromPartial({ ping: 1 })).finish();
  return buildFrame(ControlCode.LOCK_CONTROL, payload);
}
