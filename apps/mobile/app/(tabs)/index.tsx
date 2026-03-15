import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useBikeStore } from '../../src/stores/bike.store';
import { useRideStore } from '../../src/stores/ride.store';
import { useBleAuthStore } from '../../src/stores/ble-auth.store';
import { useAuthStore } from '../../src/stores/auth.store';
import { MetricCard } from '../../src/components/MetricCard';
import { ConnectionBadge } from '../../src/components/ConnectionBadge';
import { VehiclePickerRow } from '../../src/components/VehiclePickerRow';
import { bleService } from '../../src/services/ble.service';
import { cloudAuthService } from '../../src/services/cloud-auth.service';

export default function DashboardScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const connectionState = useBikeStore((s) => s.connectionState);
  const bikeData = useBikeStore((s) => s.bikeData);
  const lockState = useBikeStore((s) => s.lockState);
  const lastHeartbeatAck = useBikeStore((s) => s.lastHeartbeatAck);
  const connectedPeripheralId = useBikeStore((s) => s.connectedPeripheralId);
  const records = useBleAuthStore((s) => s.records);
  const { isRecording, startRecording, stopRecording } = useRideStore();
  const connectedRecord = connectedPeripheralId
    ? records.find((record) => record.peripheralId === connectedPeripheralId) ?? null
    : null;

  const [lastSeenText, setLastSeenText] = useState('—');
  const lastSeenAt = bikeData?.bikeTimestampMs ?? lastHeartbeatAck;
  useEffect(() => {
    if (!lastSeenAt) {
      setLastSeenText('—');
      return;
    }
    const tick = () => setLastSeenText(
      `${Math.round((Date.now() - lastSeenAt) / 1000)}s ago`,
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSeenAt]);

  const isDisconnected = connectionState === 'disconnected' || connectionState === 'error';
  const hasStaleData = isDisconnected && bikeData !== null;
  const metricsOpacity = isDisconnected ? 0.35 : 1;

  const lockLabel = lockState === 'locked' ? 'Locked'
    : lockState === 'unlocked' ? 'Unlocked'
    : '—';
  const fuelLabel = bikeData?.fuelPercent != null ? `${bikeData.fuelPercent.toFixed(0)}%` : '--';
  const batteryLabel = bikeData?.batteryVoltage != null ? `${bikeData.batteryVoltage.toFixed(1)}V` : '--';
  const connectedVehicleName = connectedRecord?.vehicleName ?? connectedRecord?.vehicleId ?? 'No bike connected';
  const connectedVehicleMac = connectedRecord?.peripheralId ?? connectedPeripheralId ?? '—';

  function handleLogout() {
    bleService.disconnect();
    cloudAuthService.logout();
    router.replace('/auth/login');
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OpenCFMoto</Text>
        <View style={styles.headerActions}>
          {token ? (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => router.push('/scanner')}>
            <ConnectionBadge state={connectionState} />
          </TouchableOpacity>
        </View>
      </View>

      <VehiclePickerRow
        records={records}
        connectedPeripheralId={connectedPeripheralId}
        connectionState={connectionState}
        onSelect={(record) => bleService.connect(record.peripheralId)}
        onScanPress={() => router.push('/scanner')}
      />
      <View style={styles.vehicleCard}>
        <Text style={styles.vehicleLabel}>Vehicle</Text>
        <Text style={styles.vehicleName}>{connectedVehicleName}</Text>
        <Text style={styles.vehicleMac}>MAC: {connectedVehicleMac}</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusItem}>
          ⛽ {fuelLabel}
        </Text>
        <Text style={styles.statusItem}>
          🔒 {lockLabel}
        </Text>
        <Text style={styles.statusItem}>
          ⏱ {lastSeenText}
        </Text>
      </View>

      {hasStaleData && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleBannerText}>┄ Showing last known data ┄</Text>
        </View>
      )}

      <View style={[styles.metrics, { opacity: metricsOpacity }]}>
        <MetricCard label="Speed" value={bikeData?.speedKmh.toFixed(0) ?? '--'} unit="km/h" large />
        <MetricCard label="RPM" value={bikeData?.rpm.toFixed(0) ?? '--'} unit="rpm" />
        <MetricCard label="Gear" value={bikeData?.gear === 0 ? 'N' : String(bikeData?.gear ?? '--')} unit="" />
        <MetricCard label="Coolant" value={bikeData?.coolantTempC.toFixed(0) ?? '--'} unit="°C" />
        <MetricCard label="Fuel" value={fuelLabel === '--' ? '--' : fuelLabel.replace('%', '')} unit="%" />
        <MetricCard label="Battery" value={batteryLabel.replace('V', '')} unit="V" />
        <MetricCard label="Throttle" value={bikeData?.throttlePercent.toFixed(0) ?? '--'} unit="%" />
      </View>

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={styles.recordButtonText}>
          {isRecording ? 'Stop Recording' : '● Start Recording'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutButtonText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '700',
  },
  vehicleCard: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  vehicleLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  vehicleName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  vehicleMac: { color: '#9ca3af', fontSize: 12 },
  statusRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#101010',
    borderRadius: 10,
  },
  statusItem: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
  },
  staleBanner: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  staleBannerText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  recordButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  recordButtonActive: { backgroundColor: '#1d4ed8' },
  recordButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
