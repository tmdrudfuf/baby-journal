import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { formatDate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Source = { id: string; occurred_at: string; raw_text: string | null };
type Result = { answer: string | null; sources: Source[]; note: string | null };

// AI memory search (M6): meaning-based search over the family's journal, with an optional answer that
// is grounded in (and links to) the memories it came from.
export function AskJournal({ babyId, question, canEdit }: { babyId: string; question: string; canEdit: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const q = question.trim();

  async function ask() {
    setBusy(true);
    setAsked(q);
    // Older memories get indexed a few at a time on first use.
    for (let i = 0; canEdit && i < 20; i++) {
      const { data } = await supabase.functions.invoke('ai-journal', { body: { kind: 'embed_backlog', baby_id: babyId } });
      if (!data?.remaining) break;
    }
    const { data, error } = await supabase.functions.invoke('ai-journal', {
      body: { kind: 'ask', baby_id: babyId, question: q, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    setBusy(false);
    if (error || !data?.sources) return setResult({ answer: null, sources: [], note: 'Could not search right now. Check your connection.' });
    setResult({
      answer: data.answer,
      sources: data.sources,
      note: data.answer ? null : data.sources.length ? 'Here are the memories that seem related.' : 'Nothing in your journal seems related yet.',
    });
  }

  if (q.length < 3) return null;
  return (
    <>
      <Button variant="ghost" label={busy ? 'Looking through your journal…' : `Ask your journal: “${q}”`} disabled={busy} onPress={ask} />
      {result && asked === q && (
        <Card>
          {result.answer && <Text>{result.answer}</Text>}
          {result.note && <Text color="textSecondary">{result.note}</Text>}
          {result.sources.slice(0, 5).map((s) => (
            <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/memory/${s.id}`)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="caption" color="textSecondary">
                {formatDate(s.occurred_at)}
              </Text>
              <Text numberOfLines={2}>{s.raw_text ?? 'Photo'}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}
