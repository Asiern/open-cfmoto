import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initDatabase } from '../src/db/schema';

export default function RootLayout() {
  return (
    <Suspense fallback={<View style={{ flex: 1 }}><ActivityIndicator /></View>}>
      <SQLiteProvider databaseName="open-cfmoto.db" onInit={initDatabase} useSuspense>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/register" options={{ title: 'Create Account' }} />
          <Stack.Screen name="auth/forgot-password" options={{ title: 'Forgot Password' }} />
          <Stack.Screen name="scanner" options={{ presentation: 'modal', title: 'Connect Bike' }} />
          <Stack.Screen name="ride/[id]" options={{ title: 'Ride' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
