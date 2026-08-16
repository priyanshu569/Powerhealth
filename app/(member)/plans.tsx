import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, EmptyState, Input, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { DietPlan, WorkoutPlan, WorkoutLog } from '@/types/database';

export default function MemberPlansScreen() {
  const { profile } = useAuth();
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const [dietRes, workoutRes, logsRes] = await Promise.all([
      supabase
        .from('diet_plans')
        .select('*')
        .eq('member_id', profile.id)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_plans')
        .select('*')
        .eq('member_id', profile.id)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_logs')
        .select('*')
        .eq('member_id', profile.id)
        .order('logged_at', { ascending: false })
        .limit(10),
    ]);

    setDietPlan(dietRes.data as DietPlan | null);
    setWorkoutPlan(workoutRes.data as WorkoutPlan | null);
    setLogs((logsRes.data as WorkoutLog[]) ?? []);
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

  const handleLogWorkout = async () => {
    if (!profile || !exercise) {
      Alert.alert('Missing info', 'Enter at least an exercise name.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('workout_logs').insert({
      member_id: profile.id,
      exercise,
      sets: sets ? Number(sets) : null,
      reps: reps ? Number(reps) : null,
      weight_kg: weight ? Number(weight) : null,
      logged_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save log', error.message);
      return;
    }
    setExercise('');
    setSets('');
    setReps('');
    setWeight('');
    await loadData();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="My Plans" subtitle="Diet & workout guidance from your trainer" />

      <Card>
        <Text style={styles.cardTitle}>Diet plan</Text>
        {dietPlan ? (
          <>
            <Text style={styles.planTitle}>{dietPlan.title}</Text>
            <Text style={styles.planContent}>{dietPlan.content}</Text>
          </>
        ) : (
          <EmptyState message="No active diet plan yet — ask your trainer to set one up." />
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Workout plan</Text>
        {workoutPlan ? (
          <>
            <Text style={styles.planTitle}>{workoutPlan.title}</Text>
            <Text style={styles.planContent}>{workoutPlan.content}</Text>
          </>
        ) : (
          <EmptyState message="No active workout plan yet — ask your trainer to set one up." />
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Log a workout</Text>
        <Input label="Exercise" value={exercise} onChangeText={setExercise} placeholder="Bench press" />
        <View style={styles.logRow}>
          <View style={styles.logField}>
            <Input label="Sets" value={sets} onChangeText={setSets} keyboardType="number-pad" placeholder="3" />
          </View>
          <View style={styles.logField}>
            <Input label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="10" />
          </View>
          <View style={styles.logField}>
            <Input label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="40" />
          </View>
        </View>
        <Button label="Save log" onPress={handleLogWorkout} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Recent logs</Text>
        {logs.length === 0 && <EmptyState message="No workouts logged yet." />}
        {logs.map((log) => (
          <View key={log.id} style={styles.logItem}>
            <Text style={styles.logExercise}>{log.exercise}</Text>
            <Text style={styles.muted}>
              {[log.sets && `${log.sets} sets`, log.reps && `${log.reps} reps`, log.weight_kg && `${log.weight_kg}kg`]
                .filter(Boolean)
                .join(' · ') || '—'}{' '}
              · {new Date(log.logged_at).toLocaleDateString()}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  planTitle: { color: colors.primary, fontWeight: '700', fontSize: fontSizes.sm, marginBottom: spacing.xs },
  planContent: { color: colors.text, fontSize: fontSizes.sm, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: 2 },
  logRow: { flexDirection: 'row', gap: spacing.sm },
  logField: { flex: 1 },
  logItem: { marginTop: spacing.sm },
  logExercise: { color: colors.text, fontWeight: '600', fontSize: fontSizes.sm },
});
