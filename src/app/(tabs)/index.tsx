import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { MemoryImage } from '@/components/memory-image';
import { Button, Card, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { dayNumber, formatTime, greeting, localDayKey } from '@/lib/dates';
import { listEvents, listMemories, useLocal } from '@/lib/local-db';
import { describe, formatDuration, summarizeDay } from '@/lib/tracker';
import { useBaby } from '@/state/app';

export default function HomeScreen() {
  const baby = useBaby();
  const memories = useLocal(() => listMemories(baby.id));
  const now = new Date();
  const todayKey = localDayKey(now);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const events = useLocal(() => listEvents(baby.id, dayStart)).map((e) => ({ ...e, data: JSON.parse(e.data) as Record<string, unknown> }));
  const summary = summarizeDay(events, now, now);
  // TODAY mixes memories and tracker entries, oldest first like a diary page (§11).
  const today = [
    ...memories
      .filter((m) => localDayKey(new Date(m.occurred_at)) === todayKey)
      .map((m) => ({ key: m.id, at: m.occurred_at, text: m.raw_text || 'Photo', memoryId: m.id as string | null })),
    ...events
      .filter((e) => localDayKey(new Date(e.started_at)) === todayKey)
      .map((e) => ({ key: e.id, at: e.started_at, text: describe(e, now), memoryId: null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const hero = memories.find((m) => m.photo_path || m.display_asset_id);
  const day = baby.birth_date ? dayNumber(baby.birth_date, now) : null;

  return (
    <Screen>
      <Text variant="caption" color="textSecondary">
        {greeting(now)}
      </Text>
      <View>
        <Text variant="display">{baby.name}</Text>
        {day && day > 0 && <Text color="textSecondary">Day {day}</Text>}
      </View>

      {hero && (
        <Pressable accessibilityRole="button" accessibilityLabel="Open latest photo" onPress={() => router.push(`/memory/${hero.id}`)}>
          <MemoryImage localUri={hero.photo_path} assetId={hero.display_asset_id} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.lg }} />
        </Pressable>
      )}
      {day && day > 0 && (
        <Text variant="title" style={{ textAlign: 'center' }}>
          {day} {day === 1 ? 'day' : 'days'} together
        </Text>
      )}

      <Card>
        <Text variant="label">Today</Text>
        {events.length > 0 && (
          <Text variant="caption" color="textSecondary">
            {summary.feeds} feeds · {formatDuration(summary.sleepMinutes)} sleep · {summary.diapers} diapers{summary.sleeping ? ' · sleeping now' : ''}
          </Text>
        )}
        {today.length === 0 ? (
          <Text color="textSecondary">No moments yet today. Your first one takes about 10 seconds.</Text>
        ) : (
          today.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole={item.memoryId ? 'button' : 'text'}
              disabled={!item.memoryId}
              onPress={() => item.memoryId && router.push(`/memory/${item.memoryId}`)}
              style={{ flexDirection: 'row', gap: Spacing.md, minHeight: 32 }}>
              <Text color="textSecondary">{formatTime(item.at)}</Text>
              <Text numberOfLines={1} style={{ flex: 1 }}>
                {item.text}
              </Text>
            </Pressable>
          ))
        )}
      </Card>
      <Button label="Capture a moment" variant="accent" onPress={() => router.navigate('/capture')} />
    </Screen>
  );
}
