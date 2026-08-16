import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Push tokens are tied to an EAS project — `eas init` writes this into
// app.json once the project is linked. Until then this is undefined and
// registration silently no-ops rather than failing.
function getEasProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

export async function registerForPushNotifications(memberId: string): Promise<void> {
  // Remote push requires a physical device (simulators/emulators can't
  // receive them) and, since Expo SDK 53, an EAS development/production
  // build — Expo Go no longer supports remote push at all.
  if (!Device.isDevice) return;

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn('[push] no EAS project ID in app.json — run `eas init` to enable push notifications');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase
    .from('push_tokens')
    .upsert({ member_id: memberId, token }, { onConflict: 'member_id,token' });
  if (error) {
    console.warn('[push] failed to register token', error.message);
  }
}

// Best-effort cleanup so a signed-out device stops receiving another
// member's pushes if someone else logs in on the same phone afterward.
export async function unregisterCurrentDevicePush(memberId: string): Promise<void> {
  if (!Device.isDevice) return;
  const projectId = getEasProjectId();
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('member_id', memberId).eq('token', token);
  } catch {
    // not worth surfacing an error on sign-out over
  }
}
