import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useBikeStore } from '../../src/stores/bike.store';
import { useRideStore } from '../../src/stores/ride.store';
import { MetricCard } from '../../src/components/MetricCard';
import { ConnectionBadge } from '../../src/components/ConnectionBadge';
import { cloudAuthService } from '../../src/services/cloud-auth.service';

export default function DashboardScreen() {
  const router = useRouter();
  const { connectionState, bikeData } = useBikeStore();
  const { isRecording, startRecording, stopRecording } = useRideStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  async function handleCloudLoginTest() {
    if (!username.trim() || !password.trim()) {
      setAuthMessage('Cloud login: username/password required');
      return;
    }
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const result = await cloudAuthService.login(username.trim(), password);
      const tokenPreview = result.token.slice(0, 8);
      setAuthMessage(
        `Cloud login OK (userId: ${result.userId ?? 'n/a'}, token: ${tokenPreview}...)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cloud login error';
      setAuthMessage(`Cloud login failed: ${message}`);
    } finally {
      // Never retain password in UI state after attempting login.
      setPassword('');
      setAuthBusy(false);
    }
  }

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

      <View style={styles.cloudCard}>
        <Text style={styles.cloudTitle}>Cloud Login Test</Text>
        <TextInput
          style={styles.input}
          value={username}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Email or phone"
          placeholderTextColor="#666"
          onChangeText={setUsername}
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
        <TouchableOpacity
          style={[styles.loginButton, authBusy && styles.loginButtonDisabled]}
          disabled={authBusy}
          onPress={handleCloudLoginTest}
        >
          {authBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Test Cloud Login</Text>
          )}
        </TouchableOpacity>
        {authMessage ? <Text style={styles.cloudMessage}>{authMessage}</Text> : null}
      </View>
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
  cloudCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#242424',
    gap: 10,
  },
  cloudTitle: { color: '#f3f3f3', fontWeight: '700', fontSize: 15 },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2c2c2c',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loginButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cloudMessage: { color: '#d4d4d4', fontSize: 12 },
});
