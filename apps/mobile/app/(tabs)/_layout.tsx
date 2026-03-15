import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { useBleAuthStore } from '../../src/stores/ble-auth.store';

export default function TabLayout() {
  const token = useAuthStore((s) => s.token);
  const hasLocalBleKey = useBleAuthStore((s) => s.records.length > 0);
  if (!token && !hasLocalBleKey) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#FF6600' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="speedometer" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
