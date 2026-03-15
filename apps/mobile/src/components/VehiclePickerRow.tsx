import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ConnectionState } from '@open-cfmoto/ble-protocol';
import { BleAuthRecord } from '../stores/ble-auth.store';

interface VehiclePickerRowProps {
  records: BleAuthRecord[];
  connectedPeripheralId: string | null;
  connectionState: ConnectionState;
  onSelect: (record: BleAuthRecord) => void;
  onScanPress: () => void;
}

const STATE_LABEL: Partial<Record<ConnectionState, string>> = {
  connecting: 'Connecting...',
  connected: 'Connected',
  authenticated: 'Authenticated',
  error: 'Error',
};

export function VehiclePickerRow({
  records,
  connectedPeripheralId,
  connectionState,
  onSelect,
  onScanPress,
}: VehiclePickerRowProps) {
  if (records.length === 0) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={[styles.chip, styles.chipScan]} onPress={onScanPress}>
          <Text style={styles.chipScanText}>＋ Scan for bike</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {records.map((record) => {
        const isConnected = record.peripheralId === connectedPeripheralId;
        const label = record.vehicleName ?? record.vehicleId;
        const stateLabel = isConnected ? (STATE_LABEL[connectionState] ?? connectionState) : 'Tap to connect';
        return (
          <TouchableOpacity
            key={`${record.peripheralId}-${record.vehicleId}`}
            style={[styles.chip, isConnected ? styles.chipConnected : styles.chipIdle]}
            onPress={() => onSelect(record)}
          >
            <Text style={[styles.chipName, isConnected && styles.chipNameConnected]}>
              {label}
            </Text>
            <Text style={[styles.chipState, isConnected && styles.chipStateConnected]}>
              {stateLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={[styles.chip, styles.chipAdd]} onPress={onScanPress}>
        <Text style={styles.chipAddText}>＋</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 100,
    alignItems: 'center',
  },
  chipIdle: {
    backgroundColor: '#111',
    borderColor: '#2a2a2a',
  },
  chipConnected: {
    backgroundColor: '#0f172a',
    borderColor: '#2563eb',
  },
  chipScan: {
    backgroundColor: '#111',
    borderColor: '#444',
    borderStyle: 'dashed',
  },
  chipAdd: {
    backgroundColor: '#111',
    borderColor: '#444',
    borderStyle: 'dashed',
    minWidth: 44,
    paddingHorizontal: 10,
  },
  chipName: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  chipNameConnected: {
    color: '#fff',
  },
  chipState: {
    color: '#9ca3af',
    fontSize: 11,
  },
  chipStateConnected: {
    color: '#8fb4ff',
  },
  chipScanText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
  },
  chipAddText: {
    color: '#d1d5db',
    fontSize: 18,
    fontWeight: '400',
  },
});
