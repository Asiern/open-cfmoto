/**
 * GATT UUIDs for CFMoto 450 series.
 *
 * STATUS: UNCONFIRMED SCAFFOLDING
 * These are common Chinese OEM BLE patterns — update after jadx/btsnoop analysis.
 * Track discoveries in: tools/apk-analysis/findings/gatt-services.md
 */

/** Main BLE service UUID — common Telink/Nordic OEM pattern */
export const SERVICE_MAIN = '0000fff0-0000-1000-8000-00805f9b34fb';

/** Bike → App: telemetry notifications */
export const CHAR_NOTIFY = '0000fff1-0000-1000-8000-00805f9b34fb';

/** App → Bike: command writes */
export const CHAR_WRITE = '0000fff2-0000-1000-8000-00805f9b34fb';

/** Alternate service seen on some CFMoto variants */
export const SERVICE_ALT = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/** NUS RX (write) */
export const CHAR_NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

/** NUS TX (notify) */
export const CHAR_NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
