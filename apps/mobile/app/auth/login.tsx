import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { resolveBaseUrlFromRegionDomain } from '@open-cfmoto/cloud-client';
import { cloudAuthService } from '../../src/services/cloud-auth.service';
import { useAuthStore } from '../../src/stores/auth.store';
import { useBleAuthStore } from '../../src/stores/ble-auth.store';
import { useRegionStore } from '../../src/stores/region.store';

const DEV_PREFILL_IDCARD = process.env.EXPO_PUBLIC_DEV_LOGIN_IDCARD ?? '';
const DEV_PREFILL_PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? '';

export default function LoginScreen() {
  const router = useRouter();
  const [idcard, setIdcard] = useState(DEV_PREFILL_IDCARD);
  const [password, setPassword] = useState(DEV_PREFILL_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [regionsBusy, setRegionsBusy] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionQuery, setRegionQuery] = useState('');
  const token = useAuthStore((s) => s.token);
  const hasLocalBleKey = useBleAuthStore((s) => s.records.length > 0);
  const selectedRegion = useRegionStore((s) => s.selected);
  const regions = useRegionStore((s) => s.available);
  const isLoggedIn = Boolean(token);
  const filteredRegions = useMemo(() => {
    const q = regionQuery.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter((region) => {
      const label = `${region.country ?? ''} ${region.countryENUS ?? ''} ${region.areaNo ?? ''} ${region.domain ?? ''}`;
      return label.toLowerCase().includes(q);
    });
  }, [regionQuery, regions]);

  useEffect(() => {
    let cancelled = false;
    setRegionsBusy(true);
    cloudAuthService
      .fetchLoginAreas()
      .then((list) => {
        if (cancelled) return;
        if (!cloudAuthService.getSelectedLoginArea()) {
          const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
          const regionCode = locale.includes('-') ? locale.split('-')[1]?.toUpperCase() : '';
          const auto = list.find((item) => item.areaNo === regionCode);
          if (auto) {
            cloudAuthService.selectLoginArea(auto);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Could not load regions');
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, router]);

  async function handleLogin() {
    if (!idcard.trim() || !password.trim()) {
      setMessage('Email/phone and password are required.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await cloudAuthService.login(idcard.trim(), password);
      setMessage('Signed in.');
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.subtitle}>Use your CFMoto account email or phone number.</Text>
      {!isLoggedIn && hasLocalBleKey ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Continue with saved BLE key</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={styles.regionButton}
        onPress={() => setRegionPickerOpen(true)}
        disabled={regionsBusy}
      >
        <View style={styles.regionButtonContent}>
          <Text style={styles.regionLabel}>Region</Text>
          <Text style={styles.regionValue}>
            {selectedRegion
              ? `${selectedRegion.countryENUS ?? selectedRegion.country ?? selectedRegion.areaNo} (${selectedRegion.areaNo})`
              : regionsBusy
                ? 'Loading regions...'
                : 'Select region'}
          </Text>
          <Text style={styles.regionDomain}>
            {selectedRegion?.domain
              ? resolveBaseUrlFromRegionDomain(selectedRegion.domain)
              : 'Default: https://tapi.cfmoto-oversea.com/v1.0'}
          </Text>
        </View>
      </TouchableOpacity>

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

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Modal
        visible={regionPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRegionPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Region</Text>
            <TextInput
              style={styles.modalSearch}
              value={regionQuery}
              placeholder="Search by country or code"
              placeholderTextColor="#666"
              onChangeText={setRegionQuery}
            />
            <FlatList
              data={filteredRegions}
              keyExtractor={(item) => `${item.areaNo}-${item.domain}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.regionRow}
                  onPress={() => {
                    cloudAuthService.selectLoginArea(item);
                    setRegionPickerOpen(false);
                  }}
                >
                  <Text style={styles.regionRowTitle}>
                    {item.countryENUS ?? item.country ?? item.areaNo} ({item.areaNo})
                  </Text>
                  <Text style={styles.regionRowMeta}>{item.domain}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.regionEmpty}>No regions found</Text>}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setRegionPickerOpen(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  content: { padding: 20, gap: 12 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#c9c9c9', marginBottom: 6 },
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
  regionButton: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    backgroundColor: '#101010',
    padding: 10,
  },
  regionButtonContent: { gap: 2 },
  regionLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  regionValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  regionDomain: { color: '#8b9bb1', fontSize: 11 },
  message: { color: '#d2d2d2', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '80%',
    backgroundColor: '#0f1115',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#242b36',
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalSearch: {
    backgroundColor: '#0b0d10',
    borderWidth: 1,
    borderColor: '#2a2f37',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  regionRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e242d',
    paddingVertical: 10,
  },
  regionRowTitle: { color: '#f3f4f6', fontSize: 14, fontWeight: '600' },
  regionRowMeta: { color: '#93a3b5', fontSize: 11, marginTop: 2 },
  regionEmpty: { color: '#9ca3af', paddingVertical: 18, textAlign: 'center' },
  modalCloseButton: {
    marginTop: 4,
    backgroundColor: '#2563eb',
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
