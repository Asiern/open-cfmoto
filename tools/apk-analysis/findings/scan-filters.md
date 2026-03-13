# BLE Scan Filters — CFMoto 450 Series

**Status: UNCONFIRMED — to be populated from jadx/btsnoop analysis.**

## Device Name Pattern

The OEM app likely scans for devices with name prefix `CFMOTO` or similar.
Verify with: `grep -r "startScan\|ScanFilter\|CFMOTO" tools/apk-analysis/jadx-output/ --include="*.java"`

## Advertisement Data

| Field | Expected Value | Confidence |
|-------|---------------|-----------|
| Local Name | `CFMOTO_450*` | LOW |
| Service UUID | `0000fff0-...` or NUS | LOW |
| Manufacturer Specific | Unknown | UNKNOWN |

## Next Steps
1. Decompile APK with jadx
2. Search for `ScanFilter`, `startScan`, device name patterns
3. Run btsnoop during app startup while powering bike on
4. Document advertisement payload bytes here
