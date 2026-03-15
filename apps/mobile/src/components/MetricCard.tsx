import { View, Text, StyleSheet } from 'react-native';

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  large?: boolean;
}

export function MetricCard({ label, value, unit, large = false }: MetricCardProps) {
  return (
    <View style={[styles.card, large && styles.cardLarge]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, large && styles.valueLarge]}>{value}</Text>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    padding: 12,
    minWidth: '45%',
    flex: 1,
  },
  cardLarge: { width: '100%', flex: 0 },
  label: { color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  valueLarge: { fontSize: 56 },
  unit: { color: '#8fb4ff', fontSize: 13, marginTop: 2 },
});
