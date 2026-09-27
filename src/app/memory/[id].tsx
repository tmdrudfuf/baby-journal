import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { MemoryImage } from '@/components/memory-image';
import { SyncBadge } from '@/components/sync-badge';
import { Button, Field, Screen, Text } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { formatDate, formatTime } from '@/lib/dates';
import { getMemory, markDeleting, updateText, useLocal } from '@/lib/local-db';
import { syncNow } from '@/lib/sync';
import { useApp } from '@/state/app';

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baby, session } = useApp();
  const memory = useLocal(() => getMemory(id));
  const [draft, setDraft] = useState<string | null>(null);

  if (!memory || memory.status === 'deleting') {
    return (
      <Screen>
        <Text color="textSecondary">This memory is no longer here.</Text>
      </Screen>
    );
  }

  const canEdit = memory.author_id === session?.user.id; // ponytail: caregiver edit of others' memories arrives with roles UI (M3)
  const hasPhoto = memory.photo_path || memory.display_asset_id;

  function saveText() {
    updateText(memory!.id, draft!.trim());
    setDraft(null);
    syncNow(baby?.id);
  }

  function confirmDelete() {
    Alert.alert('Delete this memory?', 'It will be removed for everyone in your family. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          markDeleting(memory!.id);
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
      {canEdit && <Button variant="ghost" label="Delete memory" onPress={confirmDelete} />}
    </Screen>
  );
}
