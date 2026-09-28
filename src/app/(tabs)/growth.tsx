import { Alert, Pressable, View } from 'react-native';

import { SyncBadge } from '@/components/sync-badge';
import { Card, Screen, Text } from '@/components/ui';
import { Spacing, TouchTarget } from '@/constants/theme';
import { formatDate, formatTime, localDayKey } from '@/lib/dates';
import { latestEvent, listEvents, markEventDeleting, useLocal, type LocalEvent } from '@/lib/local-db';
import { syncNow } from '@/lib/sync';
import { describe, measurement, summarizeDay, summaryLine } from '@/lib/tracker';
import { atLeast, useApp, useBaby } from '@/state/app';
import { t } from '@/lib/i18n';

const DAYS_SHOWN = 7;
const parse = (e: LocalEvent) => ({ ...e, data: JSON.parse(e.data) as Record<string, unknown> });

export default function GrowthScreen() {
  const baby = useBaby();
  const { session } = useApp();
  const now = new Date();
  // Include the day before the window so sleeps crossing midnight are counted.
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_SHOWN).toISOString();
  const events = useLocal(() => listEvents(baby.id, since)).map(parse);
  const growth = useLocal(() => latestEvent(baby.id, 'growth'));
  const today = summarizeDay(events, now, now);

  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const key = localDayKey(new Date(e.started_at));
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  function remove(e: ReturnType<typeof parse>) {
    const mine = e.author_id === session?.user.id;
    if (!((mine && atLeast(baby.role, 'contributor')) || atLeast(baby.role, 'caregiver'))) return;
    Alert.alert(t('Delete this entry?'), describe(e, new Date()), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: () => {
          markEventDeleting(e.id);
          syncNow(baby.id);
        },
      },
    ]);
  }

  return (
    <Screen>
      <Text variant="display">{t('Growth')}</Text>
      <Card>
        <Text variant="label">{t('Today')}</Text>
        <Text>{summaryLine(today)}</Text>
        {today.sleeping && <Text color="textSecondary">{t('Sleeping now')}</Text>}
      </Card>
      {growth && (
        <Card>
          <Text variant="label">{t('Latest measurement')}</Text>
          <Text>{measurement(parse(growth).data)}</Text>
          <Text variant="caption" color="textSecondary">
            {formatDate(growth.started_at)}
          </Text>
        </Card>
      )}
      {events.length === 0 && (
        <Card>
          <Text color="textSecondary">{t('Log feeds, sleep and diapers from the Capture tab. Most take one tap.')}</Text>
        </Card>
      )}
      {[...byDay.entries()].map(([key, list]) => (
        <Card key={key}>
          <Text variant="label">{formatDate(list[0].started_at)}</Text>
          {list.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityHint={t('Long press to delete this entry')}
              accessibilityActions={[{ name: 'longpress', label: t('Delete entry') }]}
              onAccessibilityAction={() => remove(e)}
              onLongPress={() => remove(e)}
              style={{ flexDirection: 'row', gap: Spacing.md, minHeight: TouchTarget, alignItems: 'center' }}>
              <Text color="textSecondary">{formatTime(e.started_at)}</Text>
              <View style={{ flex: 1 }}>
                <Text>{describe(e, now)}</Text>
                {e.status !== 'synced' && <SyncBadge memory={{ status: e.status, attempts: e.attempts, last_error: e.last_error }} />}
              </View>
            </Pressable>
          ))}
        </Card>
      ))}
      {events.length > 0 && (
        <Text variant="caption" color="textSecondary">
          {t('Press and hold an entry to delete it.')}
        </Text>
      )}
    </Screen>
  );
}
