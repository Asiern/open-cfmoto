import { View, Text, StyleSheet } from 'react-native';
import { ConnectionState } from '@open-cfmoto/ble-protocol';

interface ConnectionBadgeProps {
  state: ConnectionState;
}

const STATE_COLORS: Record<ConnectionState, string> = {
  disconnected: '#555',
  scanning: '#f0a500',
  connecting: '#f0a500',
  connected: '#22c55e',
  authenticated: '#16a34a',
  error: '#ef4444',
};

const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  scanning: 'Scanning...',
  connecting: 'Connecting...',
  connected: 'Connected',
  authenticated: 'Authenticated',
  error: 'Error',
};

export function ConnectionBadge({ state }: ConnectionBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: STATE_COLORS[state] + '33' }]}>
      <View style={[styles.dot, { backgroundColor: STATE_COLORS[state] }]} />
      <Text style={[styles.label, { color: STATE_COLORS[state] }]}>{STATE_LABELS[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  label: { fontSize: 13, fontWeight: '600' },
});
