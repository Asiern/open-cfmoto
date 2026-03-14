#!/usr/bin/env bash
# Extract GATT UUIDs from jadx decompile output
# Usage: ./extract-uuids.sh [jadx-output-dir]

JADX_DIR="${1:-$(dirname "$0")/../jadx-output}"

if [ ! -d "$JADX_DIR" ]; then
  echo "ERROR: jadx output directory not found: $JADX_DIR"
  echo "Run: tools/apk-analysis/scripts/decompile.sh"
  exit 1
fi

echo "=== GATT Service/Characteristic UUIDs ==="
grep -rhoP '[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}' "$JADX_DIR" --include="*.java" \
  | sort -u

echo ""
echo "=== UUID fromString calls ==="
grep -rn "UUID\.fromString\|fromString.*UUID" "$JADX_DIR" --include="*.java" | head -50

echo ""
echo "=== BLE-related classes ==="
grep -rln "BluetoothGatt\|BleManager\|startScan\|connectGatt" "$JADX_DIR" --include="*.java"

echo ""
echo "=== ScanFilter usage ==="
grep -rn "ScanFilter\|setScanRecord\|setServiceUuid" "$JADX_DIR" --include="*.java" | head -20
