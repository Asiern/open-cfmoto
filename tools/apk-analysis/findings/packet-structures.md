# Packet Structures — CFMoto 450 Series

**Status: UNCONFIRMED — inferred structure only. Verify via btsnoop analysis.**

## Hypothetical Telemetry Frame (bike → app, NOTIFY)

```
Offset  Len  Type      Description
------  ---  --------  -----------
0       1    uint8     Start byte (0xAA?)
1       1    uint8     Message type (0x01 = telemetry?)
2       1    uint8     Payload length
3       2    uint16 BE RPM
5       2    uint16 BE Speed × 10 (km/h)
7       1    uint8     Gear (0=N, 1-6)
8       1    uint8     Coolant temp raw (−40 offset → °C)
9       2    uint16 BE Battery mV
11      1    uint8     Throttle % (0–100)
12      3    uint24 BE Odometer km
15      1    uint8     Fuel % (0xFF = N/A)
16      1    uint8     Fault count
17      1    uint8     XOR checksum (bytes 1..16)
```

## Notes
- Checksum algorithm: XOR of all bytes between start byte and checksum
- Multi-byte integers: big-endian assumed (verify)
- Battery: raw mV ÷ 1000 = volts
- Coolant: raw − 40 = °C (common CAN/OBD pattern)

## TODO
- [ ] Confirm start byte (0xAA or other?)
- [ ] Confirm message type encoding
- [ ] Confirm checksum algorithm (XOR vs CRC8 vs CRC16)
- [ ] Verify byte order (BE vs LE)
- [ ] Find fault code frame structure
