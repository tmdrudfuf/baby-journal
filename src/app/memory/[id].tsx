import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { MemoryImage } from '@/components/memory-image';
import { MemorySocial } from '@/components/memory-social';
import { SyncBadge } from '@/components/sync-badge';
import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { formatDate, formatTime } from '@/lib/dates';
import { getMemory, markDeleting, updateText, useLocal } from '@/lib/local-db';
import { confirmMilestone, discardStory, dismissMilestone, editStory, regenerateStory, syncNow } from '@/lib/sync';
import { atLeast, useApp } from '@/state/app';

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baby, session } = useApp();
  const memory = useLocal(() => getMemory(id));
  const [draft, setDraft] = useState<string | null>(null);
  const [storyDraft, setStoryDraft] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!memory || memory.status === 'deleting') {
    return (
      <Screen>
        <Text color="textSecondary">This memory is no longer here.</Text>
      </Screen>
    );
  }

  const m = memory; // non-null from here on (hoisted functions below cannot see the narrowing)
  const role = baby?.role ?? 'viewer';
  const canEdit =
    (memory.author_id === session?.user.id && atLeast(role, 'contributor')) || atLeast(role, 'caregiver');
  const hasPhoto = memory.photo_path || memory.display_asset_id;

  function saveText() {
    updateText(m.id, (draft ?? '').trim());
    setDraft(null);
    syncNow(baby?.id);
  }

  async function act(fn: () => Promise<void>) {
    setAiError(null);
    try {
      await fn();
    } catch {
      setAiError('Could not save that choice. Check your connection and try again.');
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this memory?', 'It will be removed for everyone in your family. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          markDeleting(m.id);
          syncNow(baby?.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      {hasPhoto && (
        <MemoryImage localUri={memory.photo_path} assetId={memory.display_asset_id} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.lg }} />
      )}
      <Text variant="caption" color="textSecondary">
        {formatDate(memory.occurred_at)} · {formatTime(memory.occurred_at)}
      </Text>
      {memory.author_name && (
        <Text variant="caption" color="textSecondary">
          Recorded by {memory.author_name}
        </Text>
      )}
      <SyncBadge memory={memory} />
      {draft === null ? (
        <>
          {memory.raw_text ? <Text>{memory.raw_text}</Text> : <Text color="textSecondary">No words yet.</Text>}
          {canEdit && <Button variant="ghost" label={memory.raw_text ? 'Edit text' : 'Add words'} onPress={() => setDraft(memory.raw_text ?? '')} />}
        </>
      ) : (
        <>
          <Field label="What happened?" value={draft} onChangeText={setDraft} multiline autoFocus style={{ minHeight: 120, textAlignVertical: 'top' }} />
          <Button label="Save" onPress={saveText} />
          <Button variant="ghost" label="Cancel" onPress={() => setDraft(null)} />
        </>
      )}
      {canEdit && memory.milestone_candidate === 1 && memory.milestone_title && (
        <Card accessibilityRole="summary">
          <Text variant="caption" color="textSecondary">
            Possible milestone ✨
          </Text>
          <Text variant="title">{memory.milestone_title}</Text>
          <Text color="textSecondary">{formatDate(memory.occurred_at)}</Text>
          <Button label="Save milestone" variant="accent" onPress={() => act(() => confirmMilestone(memory, memory.milestone_title ?? ''))} />
          <Button label="Not a milestone" variant="ghost" onPress={() => act(() => dismissMilestone(memory))} />
        </Card>
      )}
      {memory.story_text && (
        <Card>
          <Text variant="caption" color="textSecondary">
            Suggested for your journal
          </Text>
          {storyDraft === null ? (
            <>
              <Text>{memory.story_text}</Text>
              {canEdit && (
                <>
                  <Button label="Edit suggestion" variant="ghost" onPress={() => setStoryDraft(memory.story_text ?? '')} />
                  <Button label="Try another suggestion" variant="ghost" onPress={() => act(async () => {
                    if (!(await regenerateStory(memory))) setAiError('AI suggestions are unavailable right now. Your memory is saved.');
                  })} />
                  <Button label="Discard suggestion" variant="ghost" onPress={() => act(() => discardStory(memory))} />
                </>
              )}
            </>
          ) : (
            <>
              <Field label="Your journal words" value={storyDraft} onChangeText={setStoryDraft} multiline autoFocus style={{ minHeight: 120, textAlignVertical: 'top' }} />
              <Button label="Save" onPress={() => act(async () => {
                await editStory(memory, storyDraft);
                setStoryDraft(null);
              })} />
              <Button variant="ghost" label="Cancel" onPress={() => setStoryDraft(null)} />
            </>
          )}
        </Card>
      )}
      {aiError && <Text color="textSecondary">{aiError}</Text>}
      {memory.status === 'synced' && session && <MemorySocial memory={memory} userId={session.user.id} />}
      {canEdit && <Button variant="ghost" label="Delete memory" onPress={confirmDelete} />}
    </Screen>
  );
}
