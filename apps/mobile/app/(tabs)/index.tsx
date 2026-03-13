import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useBikeStore } from '../../src/stores/bike.store';
import { useRideStore } from '../../src/stores/ride.store';
import { MetricCard } from '../../src/components/MetricCard';
import { ConnectionBadge } from '../../src/components/ConnectionBadge';

export default function DashboardScreen() {
  const router = useRouter();
  const { connectionState, bikeData } = useBikeStore();
  const { isRecording, startRecording, stopRecording } = useRideStore();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OpenCFMoto</Text>
        <TouchableOpacity onPress={() => router.push('/scanner')}>
          <ConnectionBadge state={connectionState} />
        </TouchableOpacity>
      </View>

      <View style={styles.metrics}>
        <MetricCard label="Speed" value={bikeData?.speedKmh.toFixed(0) ?? '--'} unit="km/h" large />
        <MetricCard label="RPM" value={bikeData?.rpm.toFixed(0) ?? '--'} unit="rpm" />
        <MetricCard label="Gear" value={bikeData?.gear === 0 ? 'N' : String(bikeData?.gear ?? '--')} unit="" />
        <MetricCard label="Coolant" value={bikeData?.coolantTempC.toFixed(0) ?? '--'} unit="°C" />
        <MetricCard label="Battery" value={bikeData?.batteryVoltage.toFixed(1) ?? '--'} unit="V" />
        <MetricCard label="Throttle" value={bikeData?.throttlePercent.toFixed(0) ?? '--'} unit="%" />
      </View>

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={styles.recordButtonText}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  recordButton: {
    backgroundColor: '#FF6600',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordButtonActive: { backgroundColor: '#cc0000' },
  recordButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
