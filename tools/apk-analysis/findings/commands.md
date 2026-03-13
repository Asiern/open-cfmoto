# Write Commands — CFMoto 450 Series

**Status: UNCONFIRMED — scaffold only. Update from jadx/btsnoop analysis.**

## Known Command Types (hypothetical)

| Cmd Byte | Name | Payload | Response | Confidence |
|----------|------|---------|----------|-----------|
| `0x10` | Handshake/Init | `[0x01]` | ACK? | LOW |
| `0x20` | Request telemetry | `[]` | Stream starts? | LOW |

## Discovery Steps

```bash
# In jadx output, look for write patterns:
grep -r "writeCharacteristic\|0xAA\|getBytes\|encodeToBytes" \
  tools/apk-analysis/jadx-output/ --include="*.java" -l

# Look for command builder classes:
grep -r "class.*Command\|class.*Packet\|class.*Frame\|class.*Protocol" \
  tools/apk-analysis/jadx-output/ --include="*.java"
```

## btsnoop Analysis

In Wireshark:
- Filter: `btatt.opcode == 0x52` (Write Command) or `btatt.opcode == 0x12` (Write Request)
- Correlate timestamps with UI interactions in OEM app
- Document payload bytes for each discovered command
