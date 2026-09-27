// Opt-in daily reminder (§62). Local notification, no server, no tracking. Never guilt-based.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type Reminder = { enabled: boolean; hour: number; minute: number };

const KEY = 'daily-reminder';
const DEFAULT: Reminder = { enabled: false, hour: 20, minute: 0 };

export function getReminder(): Reminder {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT;
  }
}

// Returns false when the user declined notification permission.
export async function setReminder(r: Reminder): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (r.enabled) {
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) {
      localStorage.setItem(KEY, JSON.stringify({ ...r, enabled: false }));
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Gentle reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'A little moment from today?', body: 'A photo or a few words is plenty. No pressure.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: 'reminders' },
    });
  }
  localStorage.setItem(KEY, JSON.stringify(r));
  return true;
}
