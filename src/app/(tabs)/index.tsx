import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { DailyStory } from '@/components/daily-story';
import { MemoryImage } from '@/components/memory-image';
import { Button, Card, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayNumber, formatDate, formatTime, greeting, localDayKey, onThisDayLabel } from '@/lib/dates';
import { listEvents, listMemories, useLocal, type LocalMemory } from '@/lib/local-db';
import { summarizeDay, summaryLine } from '@/lib/tracker';
import { atLeast, useBaby } from '@/state/app';

const TILE = 72;

// One of today's memories at a glance: the photo, or the first words of a note. Details are one tap away.
function MomentTile({ memory }: { memory: LocalMemory }) {
  const theme = useTheme();
  const hasPhoto = memory.thumb_path || memory.thumb_asset_id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${memory.raw_text || 'Photo'}, ${formatTime(memory.occurred_at)}`}
      onPress={() => router.push(`/memory/${memory.id}`)}>
      {hasPhoto ? (
        <MemoryImage localUri={memory.thumb_path} assetId={memory.thumb_asset_id} style={{ width: TILE, height: TILE, borderRadius: Radius.sm }} />
      ) : (
        <View style={{ width: TILE, height: TILE, borderRadius: Radius.sm, backgroundColor: theme.background, padding: Spacing.xs, justifyContent: 'center' }}>
          <Text variant="caption" numberOfLines={3}>
            {memory.raw_text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const baby = useBaby();
  const memories = useLocal(() => listMemories(baby.id));
  const now = new Date();
  const todayKey = localDayKey(now);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const events = useLocal(() => listEvents(baby.id, dayStart)).map((e) => ({ ...e, data: JSON.parse(e.data) as Record<string, unknown> }));
  const summary = summarizeDay(events, now, now);
  // TODAY stays a glance: counts plus a tile per memory (newest first); the memory screen has the details.
  const todayMemories = memories.filter((m) => localDayKey(new Date(m.occurred_at)) === todayKey);
  const hasLogs = summary.feeds > 0 || summary.diapers > 0 || summary.sleepMinutes > 0 || summary.sleeping;
  const hero = memories.find((m) => m.photo_path || m.display_asset_id);
  // The big photo is only the newest; the strip keeps the next few photo memories one tap away.
  const recent = memories.filter((m) => m.id !== hero?.id && (m.thumb_path || m.thumb_asset_id)).slice(0, 12);
  // ponytail: looks at memories on this device (newest 500); query the server when archives grow.
  const rediscovered = memories
    .map((m) => ({ m, label: onThisDayLabel(m.occurred_at, now) }))
    .filter((x): x is { m: typeof x.m; label: string } => x.label !== null);
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

      {recent.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="label">Recent moments</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {recent.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`Memory from ${formatDate(m.occurred_at)}`}
                onPress={() => router.push(`/memory/${m.id}`)}>
                <MemoryImage localUri={m.thumb_path} assetId={m.thumb_asset_id} style={{ width: 120, height: 120, borderRadius: Radius.md }} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {rediscovered.length > 0 && (
        <Card>
          <Text variant="caption" color="textSecondary">
            On this day ❤️
          </Text>
          {rediscovered.slice(0, 3).map(({ m, label }) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push(`/memory/${m.id}`)} style={{ gap: Spacing.sm }}>
              {(m.photo_path || m.display_asset_id) && (
                <MemoryImage localUri={m.photo_path} assetId={m.display_asset_id} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md }} />
              )}
              <Text variant="label">{label}</Text>
              <Text color="textSecondary" numberOfLines={2}>
                {m.raw_text ?? formatDate(m.occurred_at)}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
      <Card>
        <Text variant="label">Today</Text>
        {todayMemories.length === 0 && !hasLogs ? (
          <Text color="textSecondary">No moments yet today. Your first one takes about 10 seconds.</Text>
        ) : (
          <Text variant="caption" color="textSecondary">
            {[
              todayMemories.length > 0 && `${todayMemories.length} ${todayMemories.length === 1 ? 'moment' : 'moments'}`,
              hasLogs && summaryLine(summary),
              summary.sleeping && 'sleeping now',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        {todayMemories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {todayMemories.map((m) => (
              <MomentTile key={m.id} memory={m} />
            ))}
          </ScrollView>
        )}
      </Card>
      <DailyStory
        babyId={baby.id}
        day={todayKey}
        moments={todayMemories.length}
        notes={todayMemories.filter((m) => (m.raw_text?.trim().length ?? 0) >= 3).length}
        canEdit={atLeast(baby.role, 'contributor')}
      />
      <Button label="Capture a moment" variant="accent" onPress={() => router.navigate('/capture')} />
    </Screen>
  );
}
