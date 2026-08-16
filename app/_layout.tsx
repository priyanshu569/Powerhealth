import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

function RootNavigation() {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inMemberGroup = segments[0] === '(member)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    const atRoot = !segments[0];

    if (session && profile && (inAuthGroup || atRoot)) {
      router.replace(profile.role === 'admin' ? '/(admin)' : '/(member)');
      return;
    }

    // Guard against a member navigating into admin routes or vice versa
    // (e.g. via a stale deep link) — role is enforced server-side via RLS
    // too, this is just the UX-level redirect.
    if (session && profile) {
      if (profile.role === 'admin' && inMemberGroup) {
        router.replace('/(admin)');
      } else if (profile.role === 'member' && inAdminGroup) {
        router.replace('/(member)');
      }
    }
  }, [session, profile, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
