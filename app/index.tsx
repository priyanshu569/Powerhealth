import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/constants/theme';

// This screen is only ever visible for a frame while app/_layout.tsx
// decides whether to send the user to (auth)/login, (member), or (admin).
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
