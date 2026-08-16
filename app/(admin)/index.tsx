import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { Membership, TrainerSession } from '@/types/database';

interface Stats {
  totalMembers: number;
  activeMemberships: number;
  expiringSoon: number;
  expired: number;
}

interface PendingTrainerSession extends TrainerSession {
  profile: { full_name: string } | null;
}

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [expiringList, setExpiringList] = useState<(Membership & { profile: { full_name: string } })[]>([]);
  const [pendingSessions, setPendingSessions] = useState<PendingTrainerSession[]>([]);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingStatuses, setRefreshingStatuses] = useState(false);

  const loadStats = useCallback(async () => {
    const [membersCountRes, activeRes, expiringRes, expiredRes, pendingSessionsRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
      supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('memberships')
        .select('*, profile:profiles!memberships_member_id_fkey(full_name)')
        .eq('status', 'expiring_soon')
        .order('end_date', { ascending: true })
        .limit(5),
      supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
      supabase
        .from('trainer_sessions')
        .select('*, profile:profiles!trainer_sessions_member_id_fkey(full_name)')
        .eq('status', 'requested')
        .order('session_date', { ascending: true })
        .limit(10),
    ]);

    setStats({
      totalMembers: membersCountRes.count ?? 0,
      activeMemberships: activeRes.count ?? 0,
      expiringSoon: expiringRes.data?.length ?? 0,
      expired: expiredRes.count ?? 0,
    });
    setExpiringList((expiringRes.data as any) ?? []);
    setPendingSessions((pendingSessionsRes.data as any) ?? []);
  }, []);

  const updateSessionStatus = async (sessionId: string, status: 'confirmed' | 'cancelled') => {
    setBusySessionId(sessionId);
    const { error } = await supabase.from('trainer_sessions').update({ status }).eq('id', sessionId);
    setBusySessionId(null);
    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    await loadStats();
  };

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

  const handleRefreshStatuses = async () => {
    setRefreshingStatuses(true);
    // Statuses also refresh automatically via a daily pg_cron job (see
    // supabase/migrations) — this just lets an admin force it on demand.
    const { error } = await supabase.rpc('admin_refresh_membership_statuses');
    setRefreshingStatuses(false);
    if (error) {
      Alert.alert('Could not refresh', error.message);
      return;
    }
    await loadStats();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="Dashboard" subtitle="PowerHealth at a glance" />

      <Button
        label="Refresh membership statuses"
        variant="secondary"
        loading={refreshingStatuses}
        onPress={handleRefreshStatuses}
      />

      <View style={[styles.statsGrid, { marginTop: spacing.md }]}>
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

      <Card>
        <Text style={styles.cardTitle}>Pending trainer requests</Text>
        {pendingSessions.length === 0 && <EmptyState message="No pending requests." />}
        {pendingSessions.map((s) => (
          <View key={s.id} style={styles.sessionRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{s.profile?.full_name ?? 'Member'}</Text>
              <Text style={styles.muted}>
                {new Date(s.session_date).toLocaleDateString()} · {s.start_time.slice(0, 5)} · {s.trainer_name}
              </Text>
            </View>
            <View style={styles.sessionActions}>
              <Pressable disabled={busySessionId === s.id} onPress={() => updateSessionStatus(s.id, 'confirmed')}>
                <Text style={styles.actionLink}>Confirm</Text>
              </Pressable>
              <Pressable disabled={busySessionId === s.id} onPress={() => updateSessionStatus(s.id, 'cancelled')}>
                <Text style={[styles.actionLink, { color: colors.danger }]}>Decline</Text>
              </Pressable>
            </View>
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
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  sessionActions: { flexDirection: 'row', gap: spacing.md },
  actionLink: { color: colors.primary, fontSize: fontSizes.xs, fontWeight: '700' },
});
