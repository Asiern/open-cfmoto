import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRideStore } from '../../src/stores/ride.store';
import { MetricCard } from '../../src/components/MetricCard';

export default function RideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isRecording, currentStats } = useRideStore();

  const isActive = id === 'active';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isActive ? 'Active Ride' : `Trip #${id}`}</Text>
      {isActive && isRecording && currentStats && (
        <View style={styles.metrics}>
          <MetricCard label="Distance" value={currentStats.distanceKm.toFixed(2)} unit="km" />
          <MetricCard label="Duration" value={String(Math.round(currentStats.durationS / 60))} unit="min" />
          <MetricCard label="Max Speed" value={currentStats.maxSpeedKmh.toFixed(0)} unit="km/h" />
          <MetricCard label="Avg Speed" value={currentStats.avgSpeedKmh.toFixed(0)} unit="km/h" />
        </View>
      )}
      {!isActive && (
        <Text style={styles.placeholder}>Trip detail view — coming soon</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  placeholder: { color: '#555', textAlign: 'center', marginTop: 48 },
});
