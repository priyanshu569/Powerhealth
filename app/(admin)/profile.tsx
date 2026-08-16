import React, { useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';

export default function AdminProfileScreen() {
  const { profile, session, signOut, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your admin account and all your data. This cannot be undone. Member data, classes, and announcements you manage are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: handleDeleteAccount },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) {
      Alert.alert('Could not delete account', error);
    }
    // On success, deleteAccount() already signs out — the root layout's
    // session-based redirect takes over from there.
  };

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
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile?.role ?? '—'}</Text>
        </View>
      </Card>

      <Button label="Log out" variant="secondary" onPress={signOut} />

      <View style={styles.dangerZone}>
        <Text style={styles.dangerLabel}>Danger zone</Text>
        <Button
          label="Delete account"
          variant="danger"
          loading={deleting}
          onPress={confirmDeleteAccount}
        />
      </View>
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
  dangerZone: { marginTop: spacing.xl },
  dangerLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
});
