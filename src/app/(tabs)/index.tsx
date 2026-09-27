import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { MemoryImage } from '@/components/memory-image';
import { Button, Card, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { dayNumber, formatTime, greeting, localDayKey } from '@/lib/dates';
import { listMemories, useLocal } from '@/lib/local-db';
import { useBaby } from '@/state/app';

export default function HomeScreen() {
  const baby = useBaby();
  const memories = useLocal(() => listMemories(baby.id));
  const now = new Date();
  const todayKey = localDayKey(now);
  const today = memories.filter((m) => localDayKey(new Date(m.occurred_at)) === todayKey);
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
        {today.length === 0 ? (
          <Text color="textSecondary">No moments yet today. Your first one takes about 10 seconds.</Text>
        ) : (
          today.map((m) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push(`/memory/${m.id}`)} style={{ flexDirection: 'row', gap: Spacing.md, minHeight: 32 }}>
              <Text color="textSecondary">{formatTime(m.occurred_at)}</Text>
              <Text numberOfLines={1} style={{ flex: 1 }}>
                {m.raw_text || 'Photo'}
              </Text>
            </Pressable>
          ))
        )}
      </Card>
      <Button label="Capture a moment" variant="accent" onPress={() => router.navigate('/capture')} />
    </Screen>
  );
}
