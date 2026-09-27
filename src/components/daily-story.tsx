import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Button, Card, Field, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// Daily Story (§14): "You captured N moments today" plus an optional AI narrative the family can
// save, edit, regenerate or discard. Online only; the day's memories are already safe either way.
export const DAILY_MIN_NOTES = 3; // keep in sync with supabase/functions/_shared/ai.ts

type Story = { story_text: string | null; saved: boolean };

export function DailyStory({ babyId, day, moments, notes, canEdit }: { babyId: string; day: string; moments: number; notes: number; canEdit: boolean }) {
  const [story, setStory] = useState<Story | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);

  const load = useCallback(() => {
    supabase
      .from('daily_stories')
      .select('story_text, saved')
      .eq('baby_id', babyId)
      .eq('day', day)
      .maybeSingle()
      .then(({ data }) => setStory(data));
  }, [babyId, day]);
  useFocusEffect(load);

  async function run(fn: () => PromiseLike<{ error: unknown }>, failure: string) {
    setBusy(true);
    setMessage(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setMessage(failure);
    load();
  }

  async function write(regenerate: boolean) {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('ai-journal', {
      body: { kind: 'daily', baby_id: babyId, day, regenerate, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    setBusy(false);
    setNeedsPlan(data?.reason === 'plan');
    if (data?.reason === 'plan') setMessage('Daily Story is part of Plus.');
    else if (error || !['done', 'unchanged'].includes(data?.status)) {
      setMessage(data?.status === 'disabled' ? 'AI suggestions are turned off for your family.' : 'Could not write a story right now. Your moments are saved.');
    }
    load();
  }

  const save = (text?: string) =>
    run(
      () => supabase.from('daily_stories').update(text === undefined ? { saved: true } : { saved: true, edited: true, story_text: text.trim() }).eq('baby_id', babyId).eq('day', day),
      'Could not save. Check your connection.',
    );
  const discard = () => run(() => supabase.from('daily_stories').delete().eq('baby_id', babyId).eq('day', day), 'Could not discard. Check your connection.');

  if (!story?.story_text && (notes < DAILY_MIN_NOTES || !canEdit)) return null;

  return (
    <Card>
      <Text variant="caption" color="textSecondary">
        {story?.saved ? "Today's story" : `You captured ${moments} moments today.`}
      </Text>
      {draft !== null ? (
        <>
          <Field label="Your words" value={draft} onChangeText={setDraft} multiline autoFocus style={{ minHeight: 120, textAlignVertical: 'top' }} />
          <Button label="Save" disabled={busy} onPress={() => save(draft).then(() => setDraft(null))} />
          <Button variant="ghost" label="Cancel" onPress={() => setDraft(null)} />
        </>
      ) : story?.story_text ? (
        <>
          <Text>{story.story_text}</Text>
          {canEdit && (
            <>
              {!story.saved && <Button label="Save to journal" disabled={busy} onPress={() => save()} />}
              <Button variant="ghost" label="Edit" disabled={busy} onPress={() => setDraft(story.story_text ?? '')} />
              <Button variant="ghost" label="Try another" disabled={busy} onPress={() => write(true)} />
              <Button variant="ghost" label="Discard" disabled={busy} onPress={discard} />
            </>
          )}
        </>
      ) : (
        <Button variant="ghost" label="Write today's story" disabled={busy} onPress={() => write(false)} />
      )}
      {message && <Text color="textSecondary">{message}</Text>}
      {needsPlan && <Button variant="ghost" label="See plans" onPress={() => router.push('/plans')} />}
    </Card>
  );
}
