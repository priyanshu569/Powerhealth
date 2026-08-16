import React, { useState } from 'react';
import { Text, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Screen } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';

export default function SignupScreen() {
  const { signUpWithEmail } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!fullName || !email || !password) {
      setError('Fill in every field.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await signUpWithEmail(email.trim(), password, fullName.trim());
    setLoading(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // New accounts default to the 'member' role (see handle_new_user trigger).
    // Admin roles are promoted manually in Supabase — see migrations README.
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={styles.content}>
          <Text style={styles.brand}>Create your account</Text>
          <Text style={styles.tagline}>Join PowerHealth in a minute.</Text>

          <View style={styles.form}>
            <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
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
              placeholder="At least 6 characters"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Sign up" onPress={handleSignup} loading={loading} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.footerLink}>
              Log in
            </Link>
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  brand: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.text, textAlign: 'center' },
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
