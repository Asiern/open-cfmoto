#!/usr/bin/env python3
"""
Parse Android btsnoop_hci.log and extract BLE GATT traffic.

Usage:
  python3 decode-btsnoop.py tools/apk-analysis/snoop-logs/btsnoop_hci.log

Prerequisites:
  pip install scapy
  (or install wireshark/tshark and use tshark for advanced filtering)
"""

import sys
import struct
from pathlib import Path


BTSNOOP_MAGIC = b"btsnoop\x00"
BTSNOOP_VERSION = 1
BTSNOOP_DATALINK_HCI_UART = 1002


def parse_btsnoop_header(f):
    magic = f.read(8)
    if magic != BTSNOOP_MAGIC:
        raise ValueError(f"Not a btsnoop file (magic: {magic!r})")
    version, datalink = struct.unpack(">II", f.read(8))
    print(f"btsnoop version={version}, datalink={datalink}")
    return datalink


def parse_records(f):
    records = []
    while True:
        header = f.read(24)
        if len(header) < 24:
            break
        orig_len, incl_len, flags, drops, ts_us_high, ts_us_low = struct.unpack(">IIIIII", header)
        # ts is microseconds since Jan 1, 2000
        ts_us = (ts_us_high << 32) | ts_us_low
        data = f.read(incl_len)
        records.append({
            "ts_us": ts_us,
            "flags": flags,
            "data": data,
        })
    return records


def is_att_write(data: bytes) -> bool:
    """Heuristic: ATT Write Request (0x52) or Write Command (0x12)"""
    if len(data) < 5:
        return False
    # HCI event/data packet — look for ATT opcodes
    return b'\x52' in data or b'\x12' in data


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"ERROR: File not found: {path}")
        sys.exit(1)

    print(f"Parsing: {path}")
    with open(path, "rb") as f:
        datalink = parse_btsnoop_header(f)
        records = parse_records(f)

    print(f"Total records: {len(records)}")
    print()
    print("=== GATT Write candidates ===")
    print("(For detailed analysis, open in Wireshark: File > Import from Hex Dump)")
    print("  or: tshark -r btsnoop_hci.log -Y 'btatt.opcode==0x52 || btatt.opcode==0x12'")
    print()

    write_candidates = [r for r in records if is_att_write(r["data"])]
    for i, rec in enumerate(write_candidates[:20]):
        hex_data = rec["data"].hex(" ")
        print(f"[{i:3d}] flags={rec['flags']} data={hex_data}")

    if len(write_candidates) > 20:
        print(f"... and {len(write_candidates) - 20} more")


if __name__ == "__main__":
    main()
