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
