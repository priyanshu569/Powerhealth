import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';

export default function MemberProfileScreen() {
  const { profile, session, signOut } = useAuth();

  return (
    <Screen>
      <ScreenHeader title="Profile" />

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{profile?.full_name ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{profile?.phone ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile?.role ?? '—'}</Text>
        </View>
      </Card>

      <Button label="Log out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.textMuted, fontSize: fontSizes.sm },
  value: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '600' },
});
