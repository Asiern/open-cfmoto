import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Trip, getAllTrips } from '../../src/db/trips.repo';

export default function TripsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    getAllTrips(db).then(setTrips);
  }, [db]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip History</Text>
      <FlatList
        data={trips}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tripItem}
            onPress={() => router.push(`/ride/${item.id}`)}
          >
            <Text style={styles.tripDate}>{new Date(item.started_at).toLocaleDateString()}</Text>
            <Text style={styles.tripStats}>
              {(item.distance_km ?? 0).toFixed(1)} km · {Math.round((item.duration_s ?? 0) / 60)} min
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No trips recorded yet</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  tripItem: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  tripDate: { color: '#fff', fontSize: 16 },
  tripStats: { color: '#888', fontSize: 14, marginTop: 4 },
  empty: { color: '#555', textAlign: 'center', marginTop: 48 },
});
