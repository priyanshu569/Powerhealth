import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Badge, EmptyState, Input, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import type { Membership, Profile } from '@/types/database';

interface MemberRow extends Profile {
  membership: Membership | null;
}

function membershipTone(status?: Membership['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'expiring_soon') return 'warning' as const;
  if (status === 'frozen') return 'neutral' as const;
  return 'danger' as const;
}

export default function AdminMembersListScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState('');

  const loadMembers = useCallback(async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .order('full_name', { ascending: true });

    if (error) {
      console.warn('[admin/members] load failed', error.message);
      return;
    }

    const memberIds = (profiles ?? []).map((p) => p.id);
    const { data: memberships } = await supabase
      .from('memberships')
      .select('*')
      .in('member_id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000'])
      .order('end_date', { ascending: false });

    const rows: MemberRow[] = (profiles ?? []).map((p) => ({
      ...p,
      membership: (memberships ?? []).find((m: any) => m.member_id === p.id) ?? null,
    }));
    setMembers(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Screen>
      <ScreenHeader title="Members" subtitle={`${members.length} total`} />

      <Input placeholder="Search by name" value={query} onChangeText={setQuery} />

      {filtered.length === 0 && <EmptyState message="No members found." />}

      {filtered.map((m) => (
        <Pressable
          key={m.id}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push(`/(admin)/members/${m.id}`)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{m.full_name}</Text>
            <Text style={styles.muted}>{m.phone ?? 'No phone on file'}</Text>
          </View>
          <Badge
            label={m.membership?.status.replace('_', ' ') ?? 'no membership'}
            tone={membershipTone(m.membership?.status)}
          />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowPressed: { opacity: 0.7 },
  name: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md },
  muted: { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: 2 },
});
