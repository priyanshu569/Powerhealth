import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, Card, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { Membership, BmiRecord, Announcement } from '@/types/database';

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function membershipTone(status: Membership['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'expiring_soon') return 'warning' as const;
  return 'danger' as const;
}

export default function MemberHomeScreen() {
  const { profile } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [latestBmi, setLatestBmi] = useState<BmiRecord | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const [membershipRes, bmiRes, announcementsRes] = await Promise.all([
      supabase
        .from('memberships')
        .select('*')
        .eq('member_id', profile.id)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('bmi_records')
        .select('*')
        .eq('member_id', profile.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
    ]);

    setMembership(membershipRes.data as Membership | null);
    setLatestBmi(bmiRes.data as BmiRecord | null);
    setAnnouncements((announcementsRes.data as Announcement[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={`Hi, ${profile?.full_name?.split(' ')[0] ?? 'there'}`} subtitle="Welcome back to PowerHealth" />

      <Card>
        <Text style={styles.cardTitle}>Membership</Text>
        {membership ? (
          <View style={styles.membershipRow}>
            <View>
              <Text style={styles.planName}>{membership.plan_name}</Text>
              <Text style={styles.muted}>
                Valid until {new Date(membership.end_date).toLocaleDateString()}
              </Text>
              {membership.status === 'expiring_soon' && (
                <Text style={styles.warningText}>
                  Expires in {daysUntil(membership.end_date)} days
                </Text>
              )}
            </View>
            <Badge
              label={membership.status.replace('_', ' ')}
              tone={membershipTone(membership.status)}
            />
          </View>
        ) : (
          <EmptyState message="No membership on file yet — check with the front desk." />
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Latest BMI reading</Text>
        {latestBmi ? (
          <View style={styles.bmiRow}>
            <View style={styles.bmiStat}>
              <Text style={styles.bmiValue}>{latestBmi.bmi?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.muted}>BMI</Text>
            </View>
            <View style={styles.bmiStat}>
              <Text style={styles.bmiValue}>{latestBmi.weight_kg ?? '—'}</Text>
              <Text style={styles.muted}>kg</Text>
            </View>
            <View style={styles.bmiStat}>
              <Text style={styles.bmiValue}>{latestBmi.body_fat_pct ?? '—'}</Text>
              <Text style={styles.muted}>% fat</Text>
            </View>
          </View>
        ) : (
          <EmptyState message="No BMI machine readings logged yet." />
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Announcements</Text>
        {announcements.length === 0 && <EmptyState message="Nothing new right now." />}
        {announcements.map((a) => (
          <View key={a.id} style={styles.announcementItem}>
            <Text style={styles.announcementTitle}>{a.title}</Text>
            <Text style={styles.muted} numberOfLines={2}>
              {a.body}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: fontSizes.sm },
  planName: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '700' },
  warningText: { color: colors.warning, fontSize: fontSizes.xs, marginTop: spacing.xs },
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bmiRow: { flexDirection: 'row', justifyContent: 'space-around' },
  bmiStat: { alignItems: 'center' },
  bmiValue: { color: colors.primary, fontSize: fontSizes.lg, fontWeight: '800' },
  announcementItem: { marginTop: spacing.sm },
  announcementTitle: { color: colors.text, fontWeight: '600', marginBottom: 2 },
});
