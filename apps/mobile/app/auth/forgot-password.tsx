import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { cloudAuthService } from '../../src/services/cloud-auth.service';

function formatCloudError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Request failed';
  }
  const maybeCloud = error as Error & { codeText?: string; code?: number; details?: Record<string, unknown> };
  const payloadMsg = typeof maybeCloud.details?.msg === 'string' ? maybeCloud.details.msg : null;
  const payloadCode =
    typeof maybeCloud.codeText === 'string'
      ? maybeCloud.codeText
      : typeof maybeCloud.code === 'number'
        ? String(maybeCloud.code)
        : null;
  if (payloadCode && payloadMsg) {
    return `${payloadMsg} (code: ${payloadCode})`;
  }
  if (payloadMsg) {
    return payloadMsg;
  }
  return error.message || 'Request failed';
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [idcard, setIdcard] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSendCode() {
    if (!idcard.trim()) {
      setMessage('Email or phone is required to request verification code.');
      return;
    }
    setCodeBusy(true);
    setMessage(null);
    try {
      await cloudAuthService.sendVerificationCode(idcard.trim());
      setMessage('Verification code sent.');
    } catch (error) {
      setMessage(formatCloudError(error));
    } finally {
      setCodeBusy(false);
    }
  }

  async function handleChangePassword() {
    if (
      !idcard.trim() ||
      !verifyCode.trim() ||
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      setMessage('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await cloudAuthService.changePassword(
        idcard.trim(),
        currentPassword,
        newPassword,
        verifyCode.trim(),
      );
      setMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage(formatCloudError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Request and verify a code, then update your password.
      </Text>
      <Text style={styles.hint}>Current backend requires current password for final update.</Text>

      <TextInput
        style={styles.input}
        value={idcard}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Email or phone"
        placeholderTextColor="#666"
        onChangeText={setIdcard}
      />

      <TouchableOpacity
        style={[styles.secondaryButton, codeBusy && styles.buttonDisabled]}
        disabled={codeBusy}
        onPress={handleSendCode}
      >
        {codeBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={verifyCode}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Verification code"
        placeholderTextColor="#666"
        onChangeText={setVerifyCode}
      />
      <TextInput
        style={styles.input}
        value={currentPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Current password"
        placeholderTextColor="#666"
        onChangeText={setCurrentPassword}
      />
      <TextInput
        style={styles.input}
        value={newPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="New password"
        placeholderTextColor="#666"
        onChangeText={setNewPassword}
      />
      <TextInput
        style={styles.input}
        value={confirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Confirm new password"
        placeholderTextColor="#666"
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={handleChangePassword}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/auth/login')}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  content: { padding: 20, gap: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#c9c9c9' },
  hint: { color: '#999', fontSize: 12, marginBottom: 4 },
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
    backgroundColor: '#0f766e',
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700' },
  linkText: { color: '#8fb4ff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  message: { color: '#d2d2d2', fontSize: 12 },
});
