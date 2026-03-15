import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserVehicle } from '@open-cfmoto/cloud-client';
import { cloudAuthService } from '../../src/services/cloud-auth.service';
import { useAuthStore } from '../../src/stores/auth.store';
import { useBleAuthStore } from '../../src/stores/ble-auth.store';

const DEV_PREFILL_IDCARD = process.env.EXPO_PUBLIC_DEV_LOGIN_IDCARD ?? '';
const DEV_PREFILL_PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? '';

export default function LoginScreen() {
  const router = useRouter();
  const [idcard, setIdcard] = useState(DEV_PREFILL_IDCARD);
  const [password, setPassword] = useState(DEV_PREFILL_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [vehiclesBusy, setVehiclesBusy] = useState(false);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const sessionIdcard = useAuthStore((s) => s.idcard);
  const hasLocalBleKey = useBleAuthStore((s) => s.records.length > 0);
  const isLoggedIn = Boolean(token);

  async function handleLogin() {
    if (!idcard.trim() || !password.trim()) {
      setMessage('Email/phone and password are required.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await cloudAuthService.login(idcard.trim(), password);
      setMessage(`Signed in (userId: ${result.userId ?? 'n/a'})`);
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadVehicles() {
    setVehiclesBusy(true);
    setMessage(null);
    try {
      const result = await cloudAuthService.getUserVehicles(2);
      setVehicles(result);
      setMessage(`Loaded ${result.length} vehicles.`);
    } catch (error) {
      setVehicles([]);
      setMessage(error instanceof Error ? error.message : 'Could not load vehicles');
    } finally {
      setVehiclesBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.subtitle}>Use your CFMoto account email or phone number.</Text>
      {!isLoggedIn && DEV_PREFILL_IDCARD && DEV_PREFILL_PASSWORD ? (
        <Text style={styles.hint}>Dev credentials loaded from .env</Text>
      ) : null}
      {!isLoggedIn && hasLocalBleKey ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Continue with saved BLE key</Text>
        </TouchableOpacity>
      ) : null}

      <TextInput
        style={styles.input}
        value={idcard}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Email or phone"
        placeholderTextColor="#666"
        onChangeText={setIdcard}
      />
      <TextInput
        style={styles.input}
        value={password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Password"
        placeholderTextColor="#666"
        onChangeText={setPassword}
      />

      <TouchableOpacity style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} onPress={handleLogin}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>

      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text style={styles.linkText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
          <Text style={styles.linkText}>Forgot password</Text>
        </TouchableOpacity>
      </View>

      {isLoggedIn ? (
        <>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionText}>Signed in as: {sessionIdcard ?? 'n/a'}</Text>
            <Text style={styles.sessionText}>userId: {userId ?? 'n/a'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.secondaryButton, vehiclesBusy && styles.buttonDisabled]}
            disabled={vehiclesBusy}
            onPress={handleLoadVehicles}
          >
            {vehiclesBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Load My Vehicles</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => {
              cloudAuthService.logout();
              setVehicles([]);
              setMessage('Signed out');
            }}
          >
            <Text style={styles.ghostButtonText}>Sign Out</Text>
          </TouchableOpacity>
          {vehicles.map((vehicle) => (
            <View
              key={`${String(vehicle.vehicleId ?? 'unknown')}-${String(vehicle.vin ?? '')}`}
              style={styles.vehicleRow}
            >
              <Text style={styles.vehicleName}>{String(vehicle.vehicleName ?? 'Unnamed vehicle')}</Text>
              <Text style={styles.vehicleMeta}>
                {`id=${String(vehicle.vehicleId ?? 'n/a')} · vin=${String(vehicle.vin ?? 'n/a')}`}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  content: { padding: 20, gap: 12 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#c9c9c9', marginBottom: 6 },
  hint: { color: '#84cc16', fontSize: 12, marginTop: -2 },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  button: {
    marginTop: 6,
    backgroundColor: '#2563eb',
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#0891b2',
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700' },
  linksRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  linkText: { color: '#8fb4ff', fontSize: 13, fontWeight: '600' },
  sessionCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    backgroundColor: '#121212',
    padding: 10,
    gap: 4,
  },
  sessionText: { color: '#d5d5d5', fontSize: 12 },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#434343',
    borderRadius: 10,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: { color: '#f5f5f5', fontWeight: '700' },
  message: { color: '#d2d2d2', fontSize: 12 },
  vehicleRow: {
    marginTop: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#242424',
  },
  vehicleName: { color: '#f5f5f5', fontSize: 14, fontWeight: '600' },
  vehicleMeta: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
});
