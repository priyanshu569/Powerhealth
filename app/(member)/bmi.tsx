import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { BmiRecord } from '@/types/database';

function bmiCategory(bmi: number | null) {
  if (bmi === null) return { label: '—', color: colors.textMuted };
  if (bmi < 18.5) return { label: 'Underweight', color: colors.warning };
  if (bmi < 25) return { label: 'Healthy', color: colors.success };
  if (bmi < 30) return { label: 'Overweight', color: colors.warning };
  return { label: 'Obese', color: colors.danger };
}

export default function MemberBmiScreen() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<BmiRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('bmi_records')
      .select('*')
      .eq('member_id', profile.id)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.warn('[bmi] load failed', error.message);
      return;
    }
    setRecords((data as BmiRecord[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="BMI Progress" subtitle="Readings from the gym's BMI machine" />

      {records.length === 0 && (
        <EmptyState message="No BMI machine readings yet. Ask staff to log one at your next visit." />
      )}

      {records.map((r, idx) => {
        const category = bmiCategory(r.bmi);
        const prev = records[idx + 1];
        const weightDelta =
          prev?.weight_kg != null && r.weight_kg != null ? r.weight_kg - prev.weight_kg : null;

        return (
          <Card key={r.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.date}>{new Date(r.recorded_at).toLocaleDateString()}</Text>
              <Text style={[styles.category, { color: category.color }]}>{category.label}</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{r.bmi?.toFixed(1) ?? '—'}</Text>
                <Text style={styles.muted}>BMI</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{r.weight_kg ?? '—'}</Text>
                <Text style={styles.muted}>
                  kg{weightDelta != null ? ` (${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)})` : ''}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{r.body_fat_pct ?? '—'}</Text>
                <Text style={styles.muted}>% fat</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{r.muscle_mass_kg ?? '—'}</Text>
                <Text style={styles.muted}>kg muscle</Text>
              </View>
            </View>
            {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md },
  category: { fontWeight: '700', fontSize: fontSizes.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.primary, fontSize: fontSizes.lg, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: 2, textAlign: 'center' },
  notes: { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: spacing.sm, fontStyle: 'italic' },
});
