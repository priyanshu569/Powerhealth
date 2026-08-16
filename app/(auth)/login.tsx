import React, { useState } from 'react';
import { Text, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Screen } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError);
    // On success, app/_layout.tsx's redirect effect takes over.
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll={false}>
        <View style={styles.content}>
          <Text style={styles.brand}>PowerHealth</Text>
          <Text style={styles.tagline}>Your fitness journey starts here.</Text>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Log in" onPress={handleLogin} loading={loading} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to PowerHealth? </Text>
            <Link href="/(auth)/signup" style={styles.footerLink}>
              Create an account
            </Link>
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  brand: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  tagline: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: { marginTop: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: fontSizes.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { color: colors.textMuted },
  footerLink: { color: colors.primary, fontWeight: '600' },
});
