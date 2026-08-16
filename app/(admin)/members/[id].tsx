import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Screen } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type {
  BmiRecord,
  DietPlan,
  Membership,
  Profile,
  TrainerSession,
  TrainerSessionStatus,
  WorkoutPlan,
} from '@/types/database';

function trainerSessionTone(status: TrainerSessionStatus) {
  if (status === 'confirmed') return 'success' as const;
  if (status === 'requested') return 'warning' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const; // completed
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: adminProfile } = useAuth();

  const [member, setMember] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bmiRecords, setBmiRecords] = useState<BmiRecord[]>([]);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [trainerSessions, setTrainerSessions] = useState<TrainerSession[]>([]);

  // Membership form
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savingMembership, setSavingMembership] = useState(false);

  // BMI form
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [savingBmi, setSavingBmi] = useState(false);

  // Diet/workout plan forms
  const [dietTitle, setDietTitle] = useState('');
  const [dietContent, setDietContent] = useState('');
  const [savingDiet, setSavingDiet] = useState(false);
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutContent, setWorkoutContent] = useState('');
  const [savingWorkout, setSavingWorkout] = useState(false);

  // Trainer session form
  const [tsTrainerName, setTsTrainerName] = useState('');
  const [tsDate, setTsDate] = useState('');
  const [tsTime, setTsTime] = useState('');
  const [tsNotes, setTsNotes] = useState('');
  const [savingTrainerSession, setSavingTrainerSession] = useState(false);
  const [busyTrainerSessionId, setBusyTrainerSessionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;

    const [profileRes, membershipRes, bmiRes, dietRes, workoutRes, trainerSessionsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('memberships')
        .select('*')
        .eq('member_id', id)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('bmi_records').select('*').eq('member_id', id).order('recorded_at', { ascending: false }).limit(5),
      supabase
        .from('diet_plans')
        .select('*')
        .eq('member_id', id)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_plans')
        .select('*')
        .eq('member_id', id)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('trainer_sessions')
        .select('*')
        .eq('member_id', id)
        .order('session_date', { ascending: false })
        .order('start_time', { ascending: false }),
    ]);

    setMember(profileRes.data as Profile);
    setMembership(membershipRes.data as Membership | null);
    setBmiRecords((bmiRes.data as BmiRecord[]) ?? []);
    setDietPlan(dietRes.data as DietPlan | null);
    setWorkoutPlan(workoutRes.data as WorkoutPlan | null);
    setTrainerSessions((trainerSessionsRes.data as TrainerSession[]) ?? []);

    if (membershipRes.data) {
      setPlanName((membershipRes.data as Membership).plan_name);
      setStartDate((membershipRes.data as Membership).start_date);
      setEndDate((membershipRes.data as Membership).end_date);
    }
    if (dietRes.data) {
      setDietTitle((dietRes.data as DietPlan).title);
      setDietContent((dietRes.data as DietPlan).content);
    }
    if (workoutRes.data) {
      setWorkoutTitle((workoutRes.data as WorkoutPlan).title);
      setWorkoutContent((workoutRes.data as WorkoutPlan).content);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveMembership = async () => {
    if (!id || !planName || !startDate || !endDate) {
      Alert.alert('Missing info', 'Fill in plan name, start date, and end date (YYYY-MM-DD).');
      return;
    }
    setSavingMembership(true);
    const payload = {
      member_id: id,
      plan_name: planName,
      start_date: startDate,
      end_date: endDate,
      updated_by: adminProfile?.id,
    };
    const { error } = membership
      ? await supabase.from('memberships').update(payload).eq('id', membership.id)
      : await supabase.from('memberships').insert(payload);
    setSavingMembership(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await loadData();
  };

  const handleSaveBmi = async () => {
    if (!id || (!weight && !bodyFat && !muscleMass)) {
      Alert.alert('Missing info', 'Enter at least a weight or body fat % from the BMI machine.');
      return;
    }
    setSavingBmi(true);
    const weightNum = weight ? Number(weight) : null;
    const heightNum = height ? Number(height) : null;
    const bmiValue =
      weightNum && heightNum ? Number((weightNum / (heightNum / 100) ** 2).toFixed(1)) : null;

    const { error } = await supabase.from('bmi_records').insert({
      member_id: id,
      recorded_at: todayIso(),
      weight_kg: weightNum,
      height_cm: heightNum,
      bmi: bmiValue,
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
      muscle_mass_kg: muscleMass ? Number(muscleMass) : null,
      recorded_by: adminProfile?.id,
    });
    setSavingBmi(false);
    if (error) {
      Alert.alert('Could not save reading', error.message);
      return;
    }
    setWeight('');
    setHeight('');
    setBodyFat('');
    setMuscleMass('');
    await loadData();
  };

  const handleSaveDietPlan = async () => {
    if (!id || !dietTitle || !dietContent) {
      Alert.alert('Missing info', 'Enter a title and the plan content.');
      return;
    }
    setSavingDiet(true);
    const payload = {
      member_id: id,
      created_by: adminProfile?.id,
      title: dietTitle,
      content: dietContent,
      start_date: todayIso(),
      is_active: true,
    };
    const { error } = dietPlan
      ? await supabase.from('diet_plans').update(payload).eq('id', dietPlan.id)
      : await supabase.from('diet_plans').insert(payload);
    setSavingDiet(false);
    if (error) {
      Alert.alert('Could not save diet plan', error.message);
      return;
    }
    await loadData();
  };

  const handleSaveWorkoutPlan = async () => {
    if (!id || !workoutTitle || !workoutContent) {
      Alert.alert('Missing info', 'Enter a title and the plan content.');
      return;
    }
    setSavingWorkout(true);
    const payload = {
      member_id: id,
      created_by: adminProfile?.id,
      title: workoutTitle,
      content: workoutContent,
      start_date: todayIso(),
      is_active: true,
    };
    const { error } = workoutPlan
      ? await supabase.from('workout_plans').update(payload).eq('id', workoutPlan.id)
      : await supabase.from('workout_plans').insert(payload);
    setSavingWorkout(false);
    if (error) {
      Alert.alert('Could not save workout plan', error.message);
      return;
    }
    await loadData();
  };

  const handleAssignTrainerSession = async () => {
    if (!id || !tsDate || !tsTime) {
      Alert.alert('Missing info', 'Enter a date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }
    setSavingTrainerSession(true);
    // Admin-assigned sessions start 'confirmed' — no request/approval step needed
    // when the admin is the one initiating it (unlike member-requested sessions).
    const { error } = await supabase.from('trainer_sessions').insert({
      member_id: id,
      trainer_name: tsTrainerName.trim() || 'TBD',
      requested_by: 'admin',
      session_date: tsDate,
      start_time: `${tsTime}:00`,
      status: 'confirmed',
      notes: tsNotes.trim() || null,
    });
    setSavingTrainerSession(false);
    if (error) {
      Alert.alert('Could not assign session', error.message);
      return;
    }
    setTsTrainerName('');
    setTsDate('');
    setTsTime('');
    setTsNotes('');
    await loadData();
  };

  const updateTrainerSessionStatus = async (sessionId: string, status: TrainerSessionStatus) => {
    setBusyTrainerSessionId(sessionId);
    const { error } = await supabase.from('trainer_sessions').update({ status }).eq('id', sessionId);
    setBusyTrainerSessionId(null);
    if (error) {
      Alert.alert('Could not update session', error.message);
      return;
    }
    await loadData();
  };

  if (!member) {
    return (
      <Screen>
        <EmptyState message="Loading member…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.memberName}>{member.full_name}</Text>
        {membership && (
          <Badge
            label={membership.status.replace('_', ' ')}
            tone={membership.status === 'active' ? 'success' : membership.status === 'expiring_soon' ? 'warning' : 'danger'}
          />
        )}
      </View>
      <Text style={styles.muted}>{member.phone ?? 'No phone on file'}</Text>

      <Card>
        <Text style={styles.cardTitle}>Membership</Text>
        <Input label="Plan name" value={planName} onChangeText={setPlanName} placeholder="Monthly / Quarterly / Annual" />
        <Input label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-08-01" />
        <Input label="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="2026-09-01" />
        <Button label="Save membership" onPress={handleSaveMembership} loading={savingMembership} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Log BMI machine reading</Text>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          </View>
          <View style={styles.formField}>
            <Input label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input label="Body fat %" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" />
          </View>
          <View style={styles.formField}>
            <Input label="Muscle mass (kg)" value={muscleMass} onChangeText={setMuscleMass} keyboardType="decimal-pad" />
          </View>
        </View>
        <Button label="Save reading" onPress={handleSaveBmi} loading={savingBmi} />

        {bmiRecords.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.subheading}>Recent readings</Text>
            {bmiRecords.map((r) => (
              <Text key={r.id} style={styles.muted}>
                {new Date(r.recorded_at).toLocaleDateString()} — {r.weight_kg ?? '—'}kg, BMI {r.bmi ?? '—'}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Diet plan</Text>
        <Input label="Title" value={dietTitle} onChangeText={setDietTitle} placeholder="Cutting phase — Aug" />
        <Input
          label="Plan content"
          value={dietContent}
          onChangeText={setDietContent}
          placeholder="Breakfast: ... Lunch: ... Dinner: ..."
          multiline
          numberOfLines={5}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <Button label="Save diet plan" onPress={handleSaveDietPlan} loading={savingDiet} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Workout plan</Text>
        <Input label="Title" value={workoutTitle} onChangeText={setWorkoutTitle} placeholder="Push/Pull/Legs split" />
        <Input
          label="Plan content"
          value={workoutContent}
          onChangeText={setWorkoutContent}
          placeholder="Day 1: Bench 4x8, ... Day 2: ..."
          multiline
          numberOfLines={5}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <Button label="Save workout plan" onPress={handleSaveWorkoutPlan} loading={savingWorkout} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Trainer sessions</Text>
        <Input label="Trainer name" value={tsTrainerName} onChangeText={setTsTrainerName} placeholder="e.g. Coach Raj" />
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input label="Date (YYYY-MM-DD)" value={tsDate} onChangeText={setTsDate} placeholder="2026-08-20" />
          </View>
          <View style={styles.formField}>
            <Input label="Time (HH:MM)" value={tsTime} onChangeText={setTsTime} placeholder="18:00" />
          </View>
        </View>
        <Input label="Notes (optional)" value={tsNotes} onChangeText={setTsNotes} placeholder="Focus area, goals, etc." />
        <Button label="Assign session" onPress={handleAssignTrainerSession} loading={savingTrainerSession} />

        {trainerSessions.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.subheading}>Session history</Text>
            {trainerSessions.map((s) => (
              <View key={s.id} style={styles.sessionItem}>
                <View style={styles.sessionTopRow}>
                  <Text style={styles.muted}>
                    {new Date(s.session_date).toLocaleDateString()} · {s.start_time.slice(0, 5)} · {s.trainer_name}
                  </Text>
                  <Badge label={s.status} tone={trainerSessionTone(s.status)} />
                </View>
                {(s.status === 'requested' || s.status === 'confirmed') && (
                  <View style={styles.sessionActions}>
                    {s.status === 'requested' && (
                      <Pressable
                        disabled={busyTrainerSessionId === s.id}
                        onPress={() => updateTrainerSessionStatus(s.id, 'confirmed')}
                      >
                        <Text style={styles.actionLink}>Confirm</Text>
                      </Pressable>
                    )}
                    {s.status === 'confirmed' && (
                      <Pressable
                        disabled={busyTrainerSessionId === s.id}
                        onPress={() => updateTrainerSessionStatus(s.id, 'completed')}
                      >
                        <Text style={styles.actionLink}>Complete</Text>
                      </Pressable>
                    )}
                    <Pressable
                      disabled={busyTrainerSessionId === s.id}
                      onPress={() => updateTrainerSessionStatus(s.id, 'cancelled')}
                    >
                      <Text style={[styles.actionLink, { color: colors.danger }]}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: fontSizes.sm, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  subheading: { color: colors.textMuted, fontSize: fontSizes.xs, marginBottom: spacing.xs, fontWeight: '700' },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1 },
  sessionItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  sessionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  sessionActions: { flexDirection: 'row', gap: spacing.md },
  actionLink: { color: colors.primary, fontSize: fontSizes.xs, fontWeight: '700' },
});
