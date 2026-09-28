// Reactions + comments for one synced memory. Online-only; updates live via Realtime.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Field, Text } from '@/components/ui';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import type { LocalMemory } from '@/lib/local-db';
import { supabase } from '@/lib/supabase';
import { t, tn } from '@/lib/i18n';

type Comment = { id: string; body: string; created_at: string; author_id: string | null; author: { display_name: string | null } | null };

export function MemorySocial({ memory, userId }: { memory: LocalMemory; userId: string }) {
  const theme = useTheme();
  const [hearts, setHearts] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      supabase.from('reactions').select('user_id').eq('memory_id', memory.id),
      supabase
        .from('comments')
        .select('id, body, created_at, author_id, author:profiles!comments_author_profile_fk(display_name)')
        .eq('memory_id', memory.id)
        .order('created_at'),
    ]).then(([r, c]) => {
      if (r.data) setHearts(r.data.map((x) => x.user_id));
      if (c.data) setComments(c.data as Comment[]);
    });
  }, [memory.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`memory:${memory.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `memory_id=eq.${memory.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `memory_id=eq.${memory.id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [memory.id, load]);

  const mine = hearts.includes(userId);

  async function toggleHeart() {
    setError(null);
    const { error: e } = mine
      ? await supabase.from('reactions').delete().eq('memory_id', memory.id).eq('user_id', userId)
      : await supabase.from('reactions').insert({ memory_id: memory.id, family_id: memory.family_id });
    if (e) setError(t('Could not save. Check your connection.'));
    load();
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    const { error: e } = await supabase.from('comments').insert({ memory_id: memory.id, family_id: memory.family_id, body });
    if (e) return setError(t('Could not send. Check your connection.'));
    setDraft('');
    load();
  }

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine ? t('Remove your heart') : t('Add a heart')}
        accessibilityState={{ selected: mine }}
        onPress={toggleHeart}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: TouchTarget }}>
        <Ionicons name={mine ? 'heart' : 'heart-outline'} size={28} color={theme.accent} />
        <Text>{hearts.length === 0 ? t('Send some love') : tn(hearts.length, '{n} heart', '{n} hearts')}</Text>
      </Pressable>
      {comments.map((c) => (
        <View key={c.id} style={{ gap: 2 }}>
          <Text variant="caption" color="textSecondary">
            {c.author?.display_name || t('Family member')} · {formatDate(c.created_at)}
          </Text>
          <Text>{c.body}</Text>
        </View>
      ))}
      <Field label={t('Add a comment')} value={draft} onChangeText={setDraft} placeholder={t('Write something kind')} multiline />
      <Button variant="ghost" label={t('Send')} onPress={send} disabled={!draft.trim()} />
      {error && <Text color="textSecondary">{error}</Text>}
    </Card>
  );
}
