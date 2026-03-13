/**
 * GATT UUIDs for CFMoto app (com.cfmoto.cfmotointernational).
 *
 * STATUS: CONFIRMED — extracted from jadx decompilation of APK.
 * Source files: BleConstant.java, Cf110Utils.java, HH40Utils.java, BleNaviModule.java
 * Full documentation: tools/apk-analysis/findings/gatt-services.md
 *
 * NOTE: These UUIDs are for the TBox protocol used by 450-series motorcycles
 * (CFMoto 450 MT/SR/NK). The CF110/HH40 UUIDs below are for child bikes and
 * are documented for completeness but NOT the primary target.
 */

// ─── TBox Service (450-series motorcycles) ───────────────────────────────────
// Source: BleConstant.java

/** Main TBox BLE service */
export const SERVICE_TBOX = '0000B354-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

/** App → Bike: write commands (TBox frames, Protobuf payload) */
export const CHAR_TBOX_WRITE = '0000B356-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

/** Bike → App: notify (TBox response frames, Protobuf payload) */
export const CHAR_TBOX_NOTIFY = '0000B357-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

// Convenience aliases matching the rest of the codebase conventions:
export const SERVICE_MAIN = SERVICE_TBOX;
export const CHAR_WRITE   = CHAR_TBOX_WRITE;
export const CHAR_NOTIFY  = CHAR_TBOX_NOTIFY;

// ─── Navigation/HUD Service ──────────────────────────────────────────────────
// Source: BleNaviModule.java, Cf110Utils.SERVICE_Cmd_UUID

/** Navigation HUD BLE service (connects to instrument cluster) */
export const SERVICE_NAVI = '0000B360-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

/** Navigation command characteristic */
export const CHAR_NAVI_CMD = '0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

// ─── CF110 Child Bike Services ───────────────────────────────────────────────
// Source: Cf110Utils.java — NOT used for 450-series

/** CF110 authentication service */
export const SERVICE_CF110_AUTH = '0000b358-d6d8-c7ec-bdf0-eab1bfc6bcbc';

/** CF110 authentication characteristic */
export const CHAR_CF110_AUTH = '0000b360-d6d8-c7ec-bdf0-eab1bfc6bcbc';

/** CF110 command service */
export const SERVICE_CF110_CMD = '0000B362-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

/** CF110 command characteristic */
export const CHAR_CF110_CMD = '0000B364-D6D8-C7EC-BDF0-EAB1BFC6BCBC';

// ─── HH40 Child Bike Services ────────────────────────────────────────────────
// Source: HH40Utils.java — NOT used for 450-series

/** HH40 SPP service */
export const SERVICE_HH40_SPP = '0783b03e-8535-b5a0-7140-a304d2495cb7';

/** HH40 notify characteristic */
export const CHAR_HH40_NOTIFY = '0783b03e-8535-b5a0-7140-a304d2495cb8';

/** HH40 write characteristic */
export const CHAR_HH40_WRITE = '0783b03e-8535-b5a0-7140-a304d2495cba';

/** HH40 AT characteristic */
export const CHAR_HH40_AT = '0000fff6-0000-1000-8000-00805f9b34fb';
