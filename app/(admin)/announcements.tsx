import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, EmptyState, Input, Screen, ScreenHeader } from '@/components/ui';
import { colors, fontSizes, spacing } from '@/constants/theme';
import type { Announcement } from '@/types/database';

export default function AdminAnnouncementsScreen() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[admin/announcements] load failed', error.message);
      return;
    }
    setAnnouncements((data as Announcement[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAnnouncements();
    }, [loadAnnouncements])
  );

  const handlePost = async () => {
    if (!title || !body) {
      Alert.alert('Missing info', 'Enter a title and message.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('announcements').insert({
      title,
      body,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not post', error.message);
      return;
    }
    setTitle('');
    setBody('');
    await loadAnnouncements();
  };

  return (
    <Screen>
      <ScreenHeader title="Announcements" subtitle="Broadcast to all members" />

      <Card>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="New Hyrox sessions added!" />
        <Input
          label="Message"
          value={body}
          onChangeText={setBody}
          placeholder="Starting this Monday, join our new Hyrox sessions at 7am..."
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <Button label="Post announcement" onPress={handlePost} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>History</Text>
        {announcements.length === 0 && <EmptyState message="No announcements posted yet." />}
        {announcements.map((a) => (
          <View key={a.id} style={styles.item}>
            <Text style={styles.itemTitle}>{a.title}</Text>
            <Text style={styles.muted}>{a.body}</Text>
            <Text style={styles.date}>{new Date(a.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.md, marginBottom: spacing.sm },
  item: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemTitle: { color: colors.text, fontWeight: '700', fontSize: fontSizes.sm },
  muted: { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: 2 },
  date: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: spacing.xs },
});
