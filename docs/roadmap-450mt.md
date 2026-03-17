# 450MT-Only Roadmap

Last updated: 2026-03-17

Scope rule: this roadmap targets **CFMoto 450MT only**.

---

## 1. Product Scope for 450MT

### In scope
- TBox BLE connection/authentication for 450MT (`0x5A -> 0x5D`)
- BLE control commands (lock/unlock/power/find/light/units/speed limit)
- Cloud account + vehicle session + BLE key bootstrap (`encryptInfo`)
- Trip recording and history UX
- MotoPlay support (projection/navigation feature path)

### Out of scope
- Youth/electric bike protocols (`CF110`, `HH40`, `EC30E`, `ED20E`)
- HH40 telemetry-over-BLE implementation path
- Electric-only charging flows for MVP

---

## 2. Phase Plan

## Phase 1 — 450MT Core MVP (no MotoPlay yet)

Goal: reliable 450MT BLE control + core app experience.

### Deliverables
- Stable connect flow:
  - scan/connect, notify, MTU request, auth handshake
  - clear user state transitions (`disconnected -> connecting -> connected/error`)
- Command path:
  - send BLE commands from UI
  - ACK tracking into store (`recordCommandAcked`)
  - lock-state updates from command responses
- Heartbeat path:
  - wire keepalive ACK to store (`recordHeartbeatAck`)
  - watchdog disconnect + UI recovery
- Cloud-backed session:
  - login/register/forgot password/region selection
  - cache and use 450MT BLE `encryptInfo`
- Ride UX:
  - local trip list/detail polish
  - cloud ride history read sync (list/detail/delete)

### Hardware-dependent gates
- Confirm keepalive ACK code on real 450MT traffic
- Confirm auth codec encoding variant (`TboxRandomNum.codec`)
- Confirm lock/unlock success on real TBox

### Exit criteria
- New user can login, connect to 450MT, run at least one remote command, and disconnect/reconnect successfully.
- Command history + heartbeat status reflect real ACKs.

---

## Phase 2 — MotoPlay for 450MT

Goal: add the MotoPlay feature set for 450MT compatibility with OEM behavior.

### Deliverables
- MotoPlay architecture skeleton in app:
  - dedicated module/service boundary (separate from TBox BLE control path)
  - clear feature flag: `motoplayEnabled`
- Session flow:
  - connect/disconnect MotoPlay channel
  - screen/state handling for active projection session
- Navigation data bridge:
  - basic navigation payload pipeline and UI surface
  - fallback states when navigation source is unavailable

### Risks / unknowns
- Exact protocol/transport details still need targeted reverse-engineering and live validation.
- Device/cluster compatibility differences may require per-firmware handling.

### Exit criteria
- 450MT user can start/stop a MotoPlay session and observe stable projection/navigation state in app.

---

## Phase 3 — 450MT Post-MVP Expansion

Goal: complete high-value cloud features for day-to-day use.

### Candidate features
- Alerts center (read/list/filter)
- Geofence management (create/update/delete)
- OTA status screen
- Vehicle/account settings parity with core OEM flows

### Exit criteria
- Core cloud modules in `@open-cfmoto/cloud-client` are surfaced in mobile UI with error handling and tests.

---

## 3. Technical Workstreams (cross-phase)

1. Protocol correctness
- Keep protocol constants aligned with decomp findings.
- Maintain hardware-validation checklist as source of truth.

2. State/store wiring
- Ensure every outbound command has a mapped ACK route.
- Keep UI state derived from store events, not assumptions.

3. Test strategy
- Unit tests for codecs/clients/stores
- Integration tests for service wiring with mocked transport
- Hardware checklist for all traffic-dependent assumptions

4. Documentation hygiene
- Keep `README`, `docs/test-coverage.md`, `docs/hardware-validation.md` in sync with code status.

---

## 4. Immediate Next Sprint (recommended)

1. Implement ACK/store wiring for commands + heartbeat in `CFMoto450Protocol` and mobile service integration.
2. Add/update integration tests validating `ackedAt` and heartbeat state transitions.
3. Build cloud ride sync UI on top of existing cloud-client ride endpoints.
4. Keep MotoPlay in planning/design track until core MVP reliability gates are green.
