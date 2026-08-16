import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { TrainerSession, TrainerSessionStatus } from '@/types/database';

function statusTone(status: TrainerSessionStatus) {
  if (status === 'confirmed') return 'success' as const;
  if (status === 'requested') return 'warning' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const; // completed
}

export default function MemberTrainerScreen() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<TrainerSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [trainerName, setTrainerName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('trainer_sessions')
      .select('*')
      .eq('member_id', profile.id)
      .order('session_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      console.warn('[trainer] load failed', error.message);
      return;
    }
    setSessions((data as TrainerSession[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleRequest = async () => {
    if (!profile || !sessionDate || !startTime) {
      Alert.alert('Missing info', 'Enter a date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('trainer_sessions').insert({
      member_id: profile.id,
      trainer_name: trainerName.trim() || 'Any available trainer',
      requested_by: 'member',
      session_date: sessionDate,
      start_time: `${startTime}:00`,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Request failed', error.message);
      return;
    }
    setTrainerName('');
    setSessionDate('');
    setStartTime('');
    setNotes('');
    await loadSessions();
  };

  const handleCancel = async (session: TrainerSession) => {
    setBusyId(session.id);
    const { error } = await supabase
      .from('trainer_sessions')
      .update({ status: 'cancelled' })
      .eq('id', session.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Could not cancel', error.message);
      return;
    }
    await loadSessions();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="Trainer sessions" subtitle="Request 1-on-1 time with a trainer" />

      <Card>
        <Text style={styles.cardTitle}>Request a session</Text>
        <Input
          label="Preferred trainer (optional)"
          value={trainerName}
          onChangeText={setTrainerName}
          placeholder="e.g. Coach Raj"
        />
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input
              label="Date (YYYY-MM-DD)"
              value={sessionDate}
              onChangeText={setSessionDate}
              placeholder="2026-08-20"
            />
          </View>
          <View style={styles.formField}>
            <Input label="Time (HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="18:00" />
          </View>
        </View>
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Focus area, goals, etc." />
        <Button label="Request session" onPress={handleRequest} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Your sessions</Text>
        {sessions.length === 0 && <EmptyState message="No trainer sessions yet." />}
        {sessions.map((s) => (
          <View key={s.id} style={styles.sessionItem}>
            <View style={styles.sessionTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTrainer}>{s.trainer_name}</Text>
                <Text style={styles.muted}>
                  {new Date(s.session_date).toLocaleDateString()} · {s.start_time.slice(0, 5)}
                </Text>
                {s.notes && <Text style={styles.muted}>{s.notes}</Text>}
              </View>
              <Badge label={s.status} tone={statusTone(s.status)} />
            </View>
            {(s.status === 'requested' || s.status === 'confirmed') && (
              <Button
                label="Cancel"
                variant="secondary"
                loading={busyId === s.id}
                onPress={() => handleCancel(s)}
              />
            )}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1 },
  sessionItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  sessionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionTrainer: { color: colors.text, fontWeight: '700', fontSize: fontSizes.sm },
  muted: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: 2 },
});
