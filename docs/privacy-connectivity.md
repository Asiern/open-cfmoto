# Privacy and Connectivity Notes (450MT)

Last updated: 2026-03-17

This note summarizes current project understanding for privacy-sensitive users.
It is derived from repository decompilation findings and captured cloud traffic.

---

## 1. Connectivity Model

For 450MT, there are two separate channels:

- `Phone <-> Bike` over BLE: local command/auth transport.
- `Bike (T-Box) <-> Cloud` over cellular: telematics/cloud features path.

BLE is not the same as T-Box cloud connectivity. The app can use both paths.

See:
- `docs/protocol.md`
- `docs/auth-protocol.md`
- `docs/cloud-auth.md`

---

## 2. BLE Auth Dependency on Cloud Keys

The BLE authentication flow requires cloud-provided `encryptInfo`:

- `encryptValue`
- `key`

These fields are obtained from vehicle cloud APIs and then used in BLE auth
(`0x5A -> 0x5B -> 0x5C -> 0x5D` flow).

Observed in this project:
- In virtual-vehicle mode (`vehicleId=-1`), `encryptInfo` was empty in captures.

Implication:
- Unbound/unactivated vehicle/account paths may not provide the auth material needed
  for T-Box-authenticated BLE control.

---

## 3. Local-Only vs Cloud-Backed Tradeoff

A privacy-first local mode is possible, but with reduced capability where cloud
bootstrap keys are required.

Potential operating modes:

1. Local-only mode:
- No cloud login.
- BLE-only UI and local storage where possible.
- T-Box commands that require server-issued auth material may fail.

2. Minimal-cloud bootstrap:
- Login only to fetch BLE auth material.
- Disable ride sync, alerts, geofence, OTA, and other cloud features.

3. Full cloud mode:
- OEM-like cloud feature set.

---

## 4. Open Questions

- Whether cached keys can reliably be reused for long offline periods.
- Exact key rotation behavior across sessions/vehicle state changes.
- Market-specific T-Box activation policy behavior by model/firmware.

Track validation tasks in:
- `docs/hardware-validation.md`
- `docs/roadmap-450mt.md`
