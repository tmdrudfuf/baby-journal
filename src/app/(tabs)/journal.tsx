import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemoryImage } from '@/components/memory-image';
import { SyncBadge } from '@/components/sync-badge';
import { Button, Card, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTime } from '@/lib/dates';
import { listMemories, useLocal, type LocalMemory } from '@/lib/local-db';
import { syncNow } from '@/lib/sync';
import { useBaby } from '@/state/app';

function MemoryCard({ memory }: { memory: LocalMemory }) {
  const hasPhoto = memory.thumb_path || memory.thumb_asset_id;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Memory from ${formatDate(memory.occurred_at)}`} onPress={() => router.push(`/memory/${memory.id}`)}>
      <Card>
        {hasPhoto && (
          <MemoryImage localUri={memory.photo_path} assetId={memory.display_asset_id} style={{ width: '100%', aspectRatio: 1, borderRadius: Radius.md }} />
        )}
        {memory.raw_text && <Text numberOfLines={4}>{memory.raw_text}</Text>}
        <Text variant="caption" color="textSecondary">
          {formatDate(memory.occurred_at)} · {formatTime(memory.occurred_at)}
        </Text>
        <SyncBadge memory={memory} />
      </Card>
    </Pressable>
  );
}

export default function JournalScreen() {
  const baby = useBaby();
  const theme = useTheme();
  const memories = useLocal(() => listMemories(baby.id));
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await syncNow(baby.id, { force: true });
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={memories}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MemoryCard memory={item} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={<Text variant="display">Journal</Text>}
        ListEmptyComponent={
          <Card>
            <Text color="textSecondary">Your memories will appear here, newest first.</Text>
            <Button label="Capture the first one" variant="accent" onPress={() => router.navigate('/capture')} />
          </Card>
        }
      />
    </SafeAreaView>
  );
}
