#!/usr/bin/env bash
# Decompile CFMoto APK (handles both raw APK and APKPure APKS bundles)
# Usage: ./decompile.sh [path-to-apk-or-apks]
#
# If no argument given, uses the first APK/APKS found in tools/apk-analysis/apk/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APK_DIR="$SCRIPT_DIR/../apk"
OUTPUT_DIR="$SCRIPT_DIR/../jadx-output"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# --- Locate input file ---
if [ $# -ge 1 ]; then
  INPUT="$1"
else
  INPUT="$(ls "$APK_DIR"/*.apk "$APK_DIR"/*.apks 2>/dev/null | head -1 || true)"
  if [ -z "$INPUT" ]; then
    echo "ERROR: No APK/APKS file found in $APK_DIR"
    echo "Usage: $0 <path-to-apk-or-apks>"
    exit 1
  fi
fi

if [ ! -f "$INPUT" ]; then
  echo "ERROR: File not found: $INPUT"
  exit 1
fi

echo "Input: $INPUT"

# --- Detect if it's an APKS bundle (zip containing inner APKs) ---
INNER_APK=""
if unzip -l "$INPUT" 2>/dev/null | grep -q '\.apk$'; then
  echo "Detected APKS bundle — extracting base APK..."
  # Extract the largest inner APK (the base, not config splits)
  INNER_NAME="$(unzip -l "$INPUT" | grep '\.apk' | sort -rn -k1 | awk '{print $NF}' | head -1)"
  echo "  -> $INNER_NAME"
  unzip -o "$INPUT" "$INNER_NAME" -d "$TMP_DIR" > /dev/null
  INNER_APK="$TMP_DIR/$INNER_NAME"
  TARGET="$INNER_APK"
else
  TARGET="$INPUT"
fi

# --- Check jadx is available ---
if ! command -v jadx &>/dev/null; then
  echo "ERROR: jadx not found in PATH"
  echo "Install: sudo pacman -S jadx  OR  nix-env -iA nixpkgs.jadx"
  exit 1
fi

# --- Decompile ---
echo "Output: $OUTPUT_DIR"
echo "Running jadx..."
rm -rf "$OUTPUT_DIR"
jadx -d "$OUTPUT_DIR" --deobf "$TARGET"

# --- Summary ---
JAVA_COUNT="$(find "$OUTPUT_DIR/sources" -name '*.java' | wc -l)"
echo ""
echo "Done. $JAVA_COUNT Java files decompiled."
echo "Run extract-uuids.sh to extract BLE UUIDs."
