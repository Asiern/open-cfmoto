# Packet Structures — CFMoto App

**Status: CONFIRMED from jadx decompilation. See `ble-protocol.md` for full detail.**

---

## TBox Frame (450-series motorcycles)

```
Byte 0:      0xAB  (header, -85 signed)
Byte 1:      0xCD  (header, -51 signed)
Byte 2:      control code (command byte)
Byte 3:      data length low byte  (little-endian)
Byte 4:      data length high byte (little-endian)
Bytes 5..N+4: Protobuf payload (N bytes)
Byte N+5:    CRC  = sum(bytes[2..N+4]) & 0xFF
Byte N+6:    0xCF (end, -49 signed)
```

**Total length**: N + 7 bytes.

**CRC**: byte-addition sum (NOT XOR) of control code + both length bytes + all payload bytes, truncated to 8 bits.

**Payload encoding**: Protocol Buffers (google.protobuf), message type determined by control code.

Source: `TboxMessageFrame.java`, `TBoxCrcFrame.java`, `TboxFrameDecoder.java`

---

## CFBleMsg / HH40 Frame (child bikes)

Identical wire format to TBox frame. Same header (0xAB 0xCD), same CRC algorithm, same end byte (0xCF).

Source: `CFBleMsg.java`, `HH40Utils.java`

---

## Navigation Frame (HUD display)

Same outer structure as TBox but includes a **sequence byte** between the length field and payload:

```
Byte 0:      0xAB
Byte 1:      0xCD
Byte 2:      control code (NaviCode byte: 120–126)
Byte 3:      data length low byte
Byte 4:      data length high byte
Byte 5:      sequence byte  (single=0xC0, start=0x80, middle=0x00, end=0x40|seqNum)
Bytes 6..N+5: payload (N bytes)
Byte N+6:    CRC  = sum(bytes[2..N+5]) & 0xFF  (includes seq byte)
Byte N+7:    0xCF
```

Max single-frame payload: 12 bytes. Longer payloads (road names) are fragmented.

Source: `MessageFrame.java`, `CrcFrame.java`, `SeqFrame.java`

---

## Frame Parsing (Decoder)

Validation order in `TboxFrameDecoder.decode()`:
1. `bArr[0] == 0xAB` and `bArr[1] == 0xCD`
2. Length = `(bArr[3] & 0xFF) | (bArr[4] << 8)`
3. Verify CRC: recalculate and compare to `bArr[length + 5]`
4. Verify end byte: `bArr[length + 6] == 0xCF`
   _(Note: decoder uses `bArr[bArr.length - 1] == 0xCF` check)_
5. Parse Protobuf payload from `bArr[5 .. length+4]`

HH40 reassembly (`HH40Utils.receiver()`):
- Accumulates bytes byte-by-byte
- Syncs on 0xAB → 0xCD sequence
- Waits until `bufferSize == (length + 5)` and last byte is 0xCF
