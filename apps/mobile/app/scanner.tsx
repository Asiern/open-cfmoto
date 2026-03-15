import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useBleConnection } from '../src/hooks/useBleConnection';
import { PeripheralInfo } from '@open-cfmoto/ble-protocol';
import { useAuthStore } from '../src/stores/auth.store';
import { useBleAuthStore } from '../src/stores/ble-auth.store';

export default function ScannerScreen() {
  const token = useAuthStore((s) => s.token);
  const hasLocalBleKey = useBleAuthStore((s) => s.records.length > 0);
  if (!token && !hasLocalBleKey) {
    return <Redirect href="/auth/login" />;
  }

  const router = useRouter();
  const { scanning, peripherals, startScan, connectTo } = useBleConnection();

  async function handleConnect(peripheral: PeripheralInfo) {
    await connectTo(peripheral.id);
    router.back();
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.scanButton} onPress={startScan} disabled={scanning}>
        {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanButtonText}>Scan for Bikes</Text>}
      </TouchableOpacity>

      <FlatList
        data={peripherals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.device} onPress={() => handleConnect(item)}>
            <Text style={styles.deviceName}>{item.name ?? 'Unknown Device'}</Text>
            <Text style={styles.deviceId}>{item.id} · {item.rssi} dBm</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {scanning ? 'Scanning...' : 'Tap scan to find nearby bikes'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  scanButton: {
    backgroundColor: '#FF6600',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  device: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceName: { color: '#fff', fontSize: 16 },
  deviceId: { color: '#888', fontSize: 12, marginTop: 2 },
  empty: { color: '#555', textAlign: 'center', marginTop: 48 },
});
