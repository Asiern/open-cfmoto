/**
 * Response router — dispatches incoming BLE notification frames to handlers
 * by control code.
 *
 * Control codes confirmed from TboxControlCode.java and DecoderData.java.
 * See docs/protocol.md §4 for the full bidirectional table.
 */

import { parseFrame } from './codec';

/**
 * All TBox control codes, both directions.
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
  PATCH_OBTAIN_INFO_RESULT: 0x95,  // Charger info result (PatchObtainInfoResult)
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
