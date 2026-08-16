import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { Membership } from '@/types/database';

interface Stats {
  totalMembers: number;
  activeMemberships: number;
  expiringSoon: number;
  expired: number;
}

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [expiringList, setExpiringList] = useState<(Membership & { profile: { full_name: string } })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const [membersCountRes, activeRes, expiringRes, expiredRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
      supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('memberships')
        .select('*, profile:profiles!memberships_member_id_fkey(full_name)')
        .eq('status', 'expiring_soon')
        .order('end_date', { ascending: true })
        .limit(5),
      supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
    ]);

    setStats({
      totalMembers: membersCountRes.count ?? 0,
      activeMemberships: activeRes.count ?? 0,
      expiringSoon: expiringRes.data?.length ?? 0,
      expired: expiredRes.count ?? 0,
    });
    setExpiringList((expiringRes.data as any) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="Dashboard" subtitle="PowerHealth at a glance" />

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalMembers ?? '—'}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats?.activeMemberships ?? '—'}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats?.expiringSoon ?? '—'}</Text>
          <Text style={styles.statLabel}>Expiring soon</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.danger }]}>{stats?.expired ?? '—'}</Text>
          <Text style={styles.statLabel}>Expired</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Expiring soon</Text>
        {expiringList.length === 0 && <EmptyState message="Nothing expiring in the next few days." />}
        {expiringList.map((m) => (
          <View key={m.id} style={styles.expiringRow}>
            <Text style={styles.memberName}>{m.profile?.full_name ?? 'Member'}</Text>
            <Text style={styles.muted}>{new Date(m.end_date).toLocaleDateString()}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: { width: '47%', alignItems: 'center' },
  statValue: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: spacing.xs },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  expiringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberName: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: fontSizes.sm },
});
