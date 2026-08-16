import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, EmptyState, Input, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { ClassType, GymClass } from '@/types/database';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ClassWithType extends GymClass {
  class_type: ClassType;
  booked_count: number;
}

export default function AdminClassesScreen() {
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [classes, setClasses] = useState<ClassWithType[]>([]);

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('18:00');
  const [duration, setDuration] = useState('45');
  const [capacity, setCapacity] = useState('15');
  const [saving, setSaving] = useState(false);
  const [addingType, setAddingType] = useState(false);

  const loadData = useCallback(async () => {
    const [typesRes, classesRes] = await Promise.all([
      supabase.from('class_types').select('*').eq('is_active', true).order('name'),
      supabase
        .from('classes')
        .select('*, class_type:class_types(*)')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true }),
    ]);

    const types = (typesRes.data as ClassType[]) ?? [];
    setClassTypes(types);
    if (!selectedTypeId && types.length > 0) setSelectedTypeId(types[0].id);

    const classIds = (classesRes.data ?? []).map((c: any) => c.id);
    const { data: capacityRows } = await supabase
      .from('class_capacity_view')
      .select('*')
      .in('class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000']);

    const withCounts: ClassWithType[] = (classesRes.data ?? []).map((c: any) => ({
      ...c,
      booked_count: (capacityRows ?? []).find((cap: any) => cap.class_id === c.id)?.booked_count ?? 0,
    }));
    setClasses(withCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddClassType = async () => {
    if (!newTypeName.trim()) return;
    setAddingType(true);
    const { data, error } = await supabase
      .from('class_types')
      .insert({ name: newTypeName.trim() })
      .select()
      .single();
    setAddingType(false);
    if (error) {
      Alert.alert('Could not add class type', error.message);
      return;
    }
    setNewTypeName('');
    setSelectedTypeId(data.id);
    await loadData();
  };

  const handleCreateClass = async () => {
    if (!selectedTypeId) {
      Alert.alert('Pick a class type', 'Choose or add a class type first.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('classes').insert({
      class_type_id: selectedTypeId,
      trainer_name: trainerName || null,
      day_of_week: Number(dayOfWeek),
      recurrence: 'weekly',
      start_time: `${startTime}:00`,
      duration_minutes: Number(duration) || 45,
      capacity: Number(capacity) || 15,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not create class', error.message);
      return;
    }
    setTrainerName('');
    await loadData();
  };

  const toggleActive = async (cls: ClassWithType) => {
    const { error } = await supabase
      .from('classes')
      .update({ is_active: !cls.is_active })
      .eq('id', cls.id);
    if (error) {
      Alert.alert('Could not update class', error.message);
      return;
    }
    await loadData();
  };

  return (
    <Screen>
      <ScreenHeader title="Classes" subtitle="Schedule yoga, boxing, zumba, hyrox & more" />

      <Card>
        <Text style={styles.cardTitle}>Class types</Text>
        <View style={styles.chipRow}>
          {classTypes.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setSelectedTypeId(t.id)}
              style={[styles.chip, selectedTypeId === t.id && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selectedTypeId === t.id && styles.chipTextSelected]}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Input placeholder="New class type (e.g. Pilates)" value={newTypeName} onChangeText={setNewTypeName} />
          </View>
        </View>
        <Button label="Add class type" variant="secondary" onPress={handleAddClassType} loading={addingType} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Schedule a weekly session</Text>
        <Input label="Trainer name" value={trainerName} onChangeText={setTrainerName} placeholder="e.g. Coach Raj" />
        <Text style={styles.subheading}>Day of week</Text>
        <View style={styles.chipRow}>
          {DAY_NAMES.map((d, idx) => (
            <Pressable
              key={d}
              onPress={() => setDayOfWeek(String(idx))}
              style={[styles.chip, dayOfWeek === String(idx) && styles.chipSelected]}
            >
              <Text style={[styles.chipText, dayOfWeek === String(idx) && styles.chipTextSelected]}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Input label="Start time (HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="18:00" />
          </View>
          <View style={styles.formField}>
            <Input label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
          </View>
        </View>
        <Input label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
        <Button label="Create class" onPress={handleCreateClass} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Scheduled classes</Text>
        {classes.length === 0 && <EmptyState message="No classes scheduled yet." />}
        {classes.map((cls) => (
          <View key={cls.id} style={styles.classRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.className}>{cls.class_type?.name}</Text>
              <Text style={styles.muted}>
                {cls.day_of_week !== null ? DAY_NAMES[cls.day_of_week] : cls.session_date} ·{' '}
                {cls.start_time.slice(0, 5)} · {cls.trainer_name ?? 'No trainer set'} ·{' '}
                {cls.booked_count}/{cls.capacity}
              </Text>
            </View>
            <Pressable onPress={() => toggleActive(cls)}>
              <Text style={[styles.toggleLabel, { color: cls.is_active ? colors.success : colors.textMuted }]}>
                {cls.is_active ? 'Active' : 'Paused'}
              </Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  subheading: { color: colors.textMuted, fontSize: fontSizes.sm, marginBottom: spacing.xs, marginTop: spacing.xs },
  muted: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: fontSizes.xs, fontWeight: '600' },
  chipTextSelected: { color: colors.primary },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1 },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  className: { color: colors.text, fontWeight: '700', fontSize: fontSizes.sm },
  toggleLabel: { fontSize: fontSizes.xs, fontWeight: '700' },
});
