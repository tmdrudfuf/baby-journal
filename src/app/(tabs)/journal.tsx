import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AskJournal } from '@/components/ask-journal';
import { MemoryImage } from '@/components/memory-image';
import { SyncBadge } from '@/components/sync-badge';
import { Button, Card, Field, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTime } from '@/lib/dates';
import { listMemories, listMilestones, searchMemories, useLocal, type LocalMemory } from '@/lib/local-db';
import { monthsWithMemories, monthTitle } from '@/lib/monthly';
import { syncNow } from '@/lib/sync';
import { atLeast, useBaby } from '@/state/app';
import { t } from '@/lib/i18n';

function MemoryCard({ memory, milestone }: { memory: LocalMemory; milestone?: string }) {
  const hasPhoto = memory.thumb_path || memory.thumb_asset_id;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('Memory from {date}', { date: formatDate(memory.occurred_at) })} onPress={() => router.push(`/memory/${memory.id}`)}>
      <Card>
        {hasPhoto && (
          <MemoryImage localUri={memory.photo_path} assetId={memory.display_asset_id} video={memory.type === 'video'} style={{ width: '100%', aspectRatio: 1, borderRadius: Radius.md }} />
        )}
        {milestone && <Text variant="label">✨ {milestone}</Text>}
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
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const memories = useLocal(() => (searching ? searchMemories(baby.id, query) : listMemories(baby.id)));
  const months = searching ? [] : monthsWithMemories(memories.map((m) => m.occurred_at));
  const [refreshing, setRefreshing] = useState(false);
  const milestoneOf = new Map(useLocal(() => listMilestones(baby.id)).map((m) => [m.memory_id, m.title]));

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
        renderItem={({ item }) => <MemoryCard memory={item} milestone={milestoneOf.get(item.id)} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Text variant="display">{t('Journal')}</Text>
            <Field label={t('Search')} value={query} onChangeText={setQuery} placeholder={t('First smile, bath, Grandma…')} returnKeyType="search" />
            <AskJournal babyId={baby.id} question={query} canEdit={atLeast(baby.role, 'contributor')} />
            {months.length > 0 && (
              <>
                <Text variant="label" style={{ marginTop: Spacing.md }}>
                  {t('Monthly memories')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingVertical: Spacing.sm }}>
                  {baby.birth_date && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("{name}'s first year", { name: baby.name })}
                      onPress={() => router.push('/year/1')}
                      style={{ backgroundColor: theme.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, minHeight: 48, justifyContent: 'center' }}>
                      <Text variant="label" color="onPrimary">
                        ★ {t('First year')}
                      </Text>
                    </Pressable>
                  )}
                  {months.map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${monthTitle(key)} memories`}
                      onPress={() => router.push(`/month/${key}`)}
                      style={{ backgroundColor: theme.accent, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, minHeight: 48, justifyContent: 'center' }}>
                      <Text variant="label" color="onAccent">
                        ▶ {monthTitle(key)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          searching ? (
            <Card>
              <Text color="textSecondary">{t('No memories contain the exact words “{q}”.', { q: query.trim() })}</Text>
            </Card>
          ) : (
          <Card>
            <Text color="textSecondary">{t('Your memories will appear here, newest first.')}</Text>
            <Button label={t('Capture the first one')} variant="accent" onPress={() => router.navigate('/capture')} />
          </Card>
          )
        }
      />
    </SafeAreaView>
  );
}
