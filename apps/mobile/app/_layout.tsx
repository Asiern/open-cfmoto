import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initDatabase } from '../src/db/schema';

export default function RootLayout() {
  return (
    <Suspense fallback={<View style={{ flex: 1 }}><ActivityIndicator /></View>}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName="open-cfmoto.db" onInit={initDatabase} useSuspense>
          <StatusBar style="light" backgroundColor="#000000" />
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'left', 'right']}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/register" options={{ headerShown: false }} />
              <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
              <Stack.Screen name="scanner" options={{ presentation: 'modal', title: 'Connect Bike' }} />
              <Stack.Screen name="ride/[id]" options={{ title: 'Ride' }} />
            </Stack>
          </SafeAreaView>
        </SQLiteProvider>
      </SafeAreaProvider>
    </Suspense>
  );
}
