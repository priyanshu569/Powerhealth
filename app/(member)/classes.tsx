import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, Button, Card, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { ClassBooking, ClassType, GymClass } from '@/types/database';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ClassWithDetails extends GymClass {
  class_type: ClassType;
  booked_count: number;
  my_booking: ClassBooking | null;
}

export default function MemberClassesScreen() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    if (!profile) return;

    const { data: classRows, error } = await supabase
      .from('classes')
      .select('*, class_type:class_types(*)')
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.warn('[classes] load failed', error.message);
      return;
    }

    const classIds = (classRows ?? []).map((c: any) => c.id);

    // class_capacity_view is a public aggregate (see supabase/migrations) so
    // members can see seat counts without RLS exposing other members' rows.
    const [{ data: capacityRows }, { data: myBookingRows }] = await Promise.all([
      supabase
        .from('class_capacity_view')
        .select('*')
        .in('class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('class_bookings').select('*').eq('member_id', profile.id).neq('status', 'cancelled'),
    ]);

    const withDetails: ClassWithDetails[] = (classRows ?? []).map((c: any) => {
      const capacity = (capacityRows ?? []).find((cap: any) => cap.class_id === c.id);
      const myBooking = (myBookingRows ?? []).find((b: any) => b.class_id === c.id) ?? null;
      return {
        ...c,
        booked_count: capacity?.booked_count ?? 0,
        my_booking: myBooking,
      };
    });

    setClasses(withDetails);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const handleBook = async (cls: ClassWithDetails) => {
    if (!profile) return;
    setBookingId(cls.id);
    const isFull = cls.booked_count >= cls.capacity;
    const { error } = await supabase.from('class_bookings').insert({
      class_id: cls.id,
      member_id: profile.id,
      status: isFull ? 'waitlisted' : 'booked',
    });
    setBookingId(null);
    if (error) {
      Alert.alert('Booking failed', error.message);
      return;
    }
    await loadClasses();
  };

  const handleCancel = async (booking: ClassBooking) => {
    setBookingId(booking.class_id);
    const { error } = await supabase
      .from('class_bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);
    setBookingId(null);
    if (error) {
      Alert.alert('Could not cancel', error.message);
      return;
    }
    await loadClasses();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="Classes" subtitle="Yoga, boxing, zumba, hyrox & more" />

      {classes.length === 0 && <EmptyState message="No classes scheduled yet. Check back soon." />}

      {classes.map((cls) => {
        const isFull = cls.booked_count >= cls.capacity;
        const isBusy = bookingId === cls.id;
        return (
          <Card key={cls.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.className}>{cls.class_type?.name ?? cls.title}</Text>
                <Text style={styles.muted}>
                  {cls.recurrence === 'weekly' && cls.day_of_week !== null
                    ? DAY_NAMES[cls.day_of_week]
                    : cls.session_date}{' '}
                  · {cls.start_time.slice(0, 5)} · {cls.duration_minutes} min
                </Text>
                {cls.trainer_name && (
                  <Text style={styles.muted}>Trainer: {cls.trainer_name}</Text>
                )}
                <Text style={styles.muted}>
                  {cls.booked_count}/{cls.capacity} booked
                </Text>
              </View>
              {cls.my_booking ? (
                <Badge
                  label={cls.my_booking.status}
                  tone={cls.my_booking.status === 'waitlisted' ? 'warning' : 'success'}
                />
              ) : (
                <Badge label={isFull ? 'full' : 'open'} tone={isFull ? 'danger' : 'neutral'} />
              )}
            </View>

            <View style={{ marginTop: spacing.sm }}>
              {cls.my_booking ? (
                <Button
                  label="Cancel booking"
                  variant="secondary"
                  loading={isBusy}
                  onPress={() => handleCancel(cls.my_booking!)}
                />
              ) : (
                <Button
                  label={isFull ? 'Join waitlist' : 'Book spot'}
                  loading={isBusy}
                  onPress={() => handleBook(cls)}
                />
              )}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  className: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: 2 },
});
