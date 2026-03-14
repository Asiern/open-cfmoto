#!/usr/bin/env bash
# Decompile CFMoto APK(s) with jadx.
# Usage:
#   ./decompile.sh                              # prefers tools/apk-analysis/apk/playstore-dump/
#   ./decompile.sh <path-to-apk>
#   ./decompile.sh <path-to-apks-bundle>
#   ./decompile.sh <path-to-dir-with-split-apks>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APK_DIR="$SCRIPT_DIR/../apk"
PLAYSTORE_DUMP_DIR="$APK_DIR/playstore-dump"
OUTPUT_DIR="$SCRIPT_DIR/../jadx-output"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

declare -a TARGETS
INPUT="${1:-}"

add_dir_apks() {
  local dir="$1"
  local base="$dir/base.apk"
  if [ -f "$base" ]; then
    TARGETS+=("$base")
  fi

  while IFS= read -r apk; do
    # Avoid duplicate base.apk if already added first.
    if [ "$apk" != "$base" ]; then
      TARGETS+=("$apk")
    fi
  done < <(find "$dir" -maxdepth 1 -type f -name '*.apk' | sort)
}

if [ -n "$INPUT" ]; then
  if [ -d "$INPUT" ]; then
    add_dir_apks "$INPUT"
    if [ "${#TARGETS[@]}" -eq 0 ]; then
      echo "ERROR: No .apk files found in directory: $INPUT"
      exit 1
    fi
    echo "Input dir: $INPUT"
  elif [ -f "$INPUT" ]; then
    echo "Input file: $INPUT"
    # APKS/XAPK bundle (zip containing inner APKs)
    if unzip -l "$INPUT" 2>/dev/null | grep -q '\.apk$'; then
      echo "Detected APK bundle — extracting inner APKs..."
      unzip -o "$INPUT" '*.apk' -d "$TMP_DIR" > /dev/null
      add_dir_apks "$TMP_DIR"
      if [ "${#TARGETS[@]}" -eq 0 ]; then
        echo "ERROR: No inner APKs found in bundle: $INPUT"
        exit 1
      fi
    else
      TARGETS=("$INPUT")
    fi
  else
    echo "ERROR: Path not found: $INPUT"
    exit 1
  fi
else
  # Default: prefer Play Store dump (base + split APKs)
  if [ -d "$PLAYSTORE_DUMP_DIR" ]; then
    add_dir_apks "$PLAYSTORE_DUMP_DIR"
  fi
  if [ "${#TARGETS[@]}" -gt 0 ]; then
    echo "Input default: $PLAYSTORE_DUMP_DIR"
  else
    # Fallback: first .apk/.apks in tools/apk-analysis/apk
    FALLBACK_INPUT="$(ls "$APK_DIR"/*.apk "$APK_DIR"/*.apks 2>/dev/null | head -1 || true)"
    if [ -z "$FALLBACK_INPUT" ]; then
      echo "ERROR: No APK inputs found."
      echo "Provide one of:"
      echo "  $0 <path-to-apk>"
      echo "  $0 <path-to-apks-bundle>"
      echo "  $0 <path-to-dir-with-split-apks>"
      exit 1
    fi
    echo "Input fallback: $FALLBACK_INPUT"
    if unzip -l "$FALLBACK_INPUT" 2>/dev/null | grep -q '\.apk$'; then
      unzip -o "$FALLBACK_INPUT" '*.apk' -d "$TMP_DIR" > /dev/null
      add_dir_apks "$TMP_DIR"
    else
      TARGETS=("$FALLBACK_INPUT")
    fi
  fi
fi

# --- Check jadx is available ---
if ! command -v jadx &>/dev/null; then
  echo "ERROR: jadx not found in PATH"
  echo "Install: sudo pacman -S jadx  OR  nix-env -iA nixpkgs.jadx"
  exit 1
fi

# --- Decompile ---
echo "Output: $OUTPUT_DIR"
echo "APKs (${#TARGETS[@]}):"
for target in "${TARGETS[@]}"; do
  echo "  - $target"
done
echo "Running jadx..."
rm -rf "$OUTPUT_DIR"
jadx -d "$OUTPUT_DIR" --deobf "${TARGETS[@]}"

# --- Summary ---
JAVA_COUNT="$(find "$OUTPUT_DIR/sources" -name '*.java' | wc -l)"
echo ""
echo "Done. $JAVA_COUNT Java files decompiled."
echo "Run extract-uuids.sh to extract BLE UUIDs."
