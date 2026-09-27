// Monthly Memories slideshow (§20): title card, then the month's highlights. Auto-advances unless
// the viewer prefers reduced motion or pauses it.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemoryImage } from '@/components/memory-image';
import { Text } from '@/components/ui';
import { Palette, Spacing, TouchTarget } from '@/constants/theme';
import { ageLabel, formatDate } from '@/lib/dates';
import { listMemories, listMilestones, useLocal, type LocalMemory } from '@/lib/local-db';
import { track } from '@/lib/analytics';
import { monthKey, monthTitle, selectHighlights } from '@/lib/monthly';
import { useBaby } from '@/state/app';

const SLIDE_MS = 5000;

export default function MonthScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const baby = useBaby();
  const { width } = useWindowDimensions();
  const memories = useLocal(() => listMemories(baby.id)).filter((m) => monthKey(new Date(m.occurred_at)) === key);
  const milestones = useLocal(() => listMilestones(baby.id));
  const byMemory = new Map(milestones.map((m) => [m.memory_id, m.title]));
  const byId = new Map(memories.map((m) => [m.id, m]));
  const highlights = selectHighlights(
    memories.map((m) => ({
      id: m.id,
      occurred_at: m.occurred_at,
      hasPhoto: !!(m.photo_path || m.display_asset_id),
      text: m.raw_text,
      milestone: byMemory.get(m.id) ?? null,
    })),
  );
  const slides: ({ kind: 'title' } | { kind: 'memory'; memory: LocalMemory; milestone: string | null })[] = [
    { kind: 'title' },
    ...highlights.flatMap((h) => {
      const memory = byId.get(h.id);
      return memory ? [{ kind: 'memory' as const, memory, milestone: h.milestone }] : [];
    }),
  ];

  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    track('monthly_story_viewed');
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (!playing || reduceMotion || index >= slides.length - 1) return;
    const t = setTimeout(() => list.current?.scrollToIndex({ index: index + 1, animated: true }), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, playing, reduceMotion, slides.length]);

  const [y, m] = key.split('-').map(Number);
  const monthEnd = new Date(y, m, 0);
  const age = baby.birth_date ? ageLabel(baby.birth_date, monthEnd < new Date() ? monthEnd : new Date()) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.night }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={{ width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={28} color={Palette.mist} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause slideshow' : 'Play slideshow'}
          onPress={() => setPlaying(!playing)}
          style={{ width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={playing && !reduceMotion ? 'pause' : 'play'} size={26} color={Palette.mist} />
        </Pressable>
      </View>
      <FlatList
        ref={list}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s, i) => (s.kind === 'title' ? 'title' : s.memory.id + i)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScrollBeginDrag={() => setPlaying(false)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.md }}>
            {item.kind === 'title' ? (
              <>
                <Text variant="display" style={{ color: Palette.mist }}>
                  {monthTitle(key)}
                </Text>
                <Text variant="title" style={{ color: Palette.mistSoft }}>
                  {baby.name}
                  {age ? ` · ${age}` : ''}
                </Text>
                <Text style={{ color: Palette.mistSoft }}>
                  {highlights.length === 0 ? 'No moments this month yet.' : `${highlights.length} moments to remember`}
                </Text>
              </>
            ) : (
              <>
                {(item.memory.photo_path || item.memory.display_asset_id) && (
                  <MemoryImage
                    localUri={item.memory.photo_path}
                    assetId={item.memory.display_asset_id}
                    style={{ width: '100%', flex: 1, maxHeight: 520, borderRadius: 24 }}
                  />
                )}
                {item.milestone && (
                  <Text variant="title" style={{ color: Palette.apricot }}>
                    ✨ {item.milestone}
                  </Text>
                )}
                {item.memory.raw_text && <Text style={{ color: Palette.mist }}>{item.memory.raw_text}</Text>}
                <Text variant="caption" style={{ color: Palette.mistSoft }}>
                  {formatDate(item.memory.occurred_at)}
                </Text>
              </>
            )}
          </View>
        )}
      />
      <Text variant="caption" style={{ color: Palette.mistSoft, textAlign: 'center', padding: Spacing.sm }}>
        {index + 1} / {slides.length}
      </Text>
    </SafeAreaView>
  );
}
