// "My First Year" (§21, §66): the year's story in the app, and a print-ready PDF.
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { View } from 'react-native';

import { MemoryImage, signedUrl } from '@/components/memory-image';
import { Button, Card, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/dates';
import { listEvents, listMemories, listMilestones, useLocal, type LocalMemory } from '@/lib/local-db';
import { plural } from '@/lib/tracker';
import { buildYearStory, type YearStory } from '@/lib/yearly';
import { useBaby } from '@/state/app';

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const lastDay = (to: Date) => new Date(to.getTime() - 86_400_000).toISOString();

// Photos become data URIs so the PDF works offline and never contains expiring links.
async function photoDataUri(m: LocalMemory): Promise<string | null> {
  try {
    if (m.photo_path) return `data:image/jpeg;base64,${await new File(m.photo_path).base64()}`;
    if (!m.display_asset_id) return null;
    const url = await signedUrl(m.display_asset_id);
    if (!url) return null;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

async function storyHtml(story: YearStory, title: string, byId: Map<string, LocalMemory>) {
  const months = await Promise.all(
    story.months.map(async (mo) => {
      const m = mo.highlight ? byId.get(mo.highlight.id) : undefined;
      const img = m ? await photoDataUri(m) : null;
      return `<section class="month"><h2>Month ${mo.index}</h2>
        ${img ? `<img src="${img}">` : ''}
        ${mo.highlight?.milestone ? `<p class="ms">✨ ${esc(mo.highlight.milestone)}</p>` : ''}
        ${m?.raw_text ? `<p>${esc(m.raw_text)}</p>` : ''}
        <p class="date">${m ? esc(formatDate(m.occurred_at)) : 'No moments saved this month.'}</p>
      </section>`;
    }),
  );
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A5; margin: 14mm; }
    body { font-family: Georgia, serif; color: #2E2A26; }
    h1 { font-size: 30px; margin: 0 0 4px; } h2 { font-size: 18px; color: #4F6B53; }
    .sub, .date { color: #6B625A; font-size: 12px; } .ms { color: #B0643A; font-weight: bold; }
    .cover { page-break-after: always; padding-top: 40%; text-align: center; }
    .month { page-break-inside: avoid; margin-bottom: 18px; }
    img { width: 100%; border-radius: 10px; }
    ul { padding-left: 18px; }
  </style></head><body>
    <div class="cover"><h1>${esc(title)}</h1>
      <p class="sub">${esc(formatDate(story.from.toISOString()))} – ${story.complete ? esc(formatDate(lastDay(story.to))) : 'so far'}</p>
      <p class="sub">${plural(story.counts.memories, 'moment')} · ${plural(story.counts.photos, 'photo')}</p></div>
    ${story.milestones.length ? `<h2>Milestones</h2><ul>${story.milestones.map((m) => `<li>${esc(formatDate(`${m.occurred_on}T12:00:00`))} — ${esc(m.title)}</li>`).join('')}</ul>` : ''}
    ${months.join('\n')}
  </body></html>`;
}

export default function YearScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const year = Math.max(1, Number(n) || 1);
  const baby = useBaby();
  const memories = useLocal(() => listMemories(baby.id));
  const milestones = useLocal(() => listMilestones(baby.id));
  const events = useLocal(() => listEvents(baby.id, '1970-01-01'));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!baby.birth_date) {
    return (
      <Screen>
        <Text color="textSecondary">Add {baby.name}&apos;s birthday to see the yearly story.</Text>
      </Screen>
    );
  }
  const byMemory = new Map(milestones.map((m) => [m.memory_id, m.title]));
  const byId = new Map(memories.map((m) => [m.id, m]));
  const story = buildYearStory(
    baby.birth_date,
    year,
    new Date(),
    memories.map((m) => ({
      id: m.id,
      occurred_at: m.occurred_at,
      hasPhoto: !!(m.photo_path || m.display_asset_id),
      text: m.raw_text,
      milestone: byMemory.get(m.id) ?? null,
    })),
    milestones,
    events,
  );
  const title = year <= ORDINAL.length ? `${baby.name}'s ${ORDINAL[year - 1]} year` : `${baby.name}'s year ${year}`;

  async function savePdf() {
    setBusy(true);
    setMessage('Making your PDF…');
    try {
      const { uri } = await Print.printToFileAsync({ html: await storyHtml(story, title, byId) });
      // A readable file name instead of a random id.
      const named = new File(Paths.cache, `${title.replace(/[^\p{L}\p{N} '-]/gu, '')}.pdf`);
      if (named.exists) named.delete();
      new File(uri).moveSync(named);
      setMessage(null);
      await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
    } catch {
      setMessage('Could not make the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="display">{title}</Text>
      <Text color="textSecondary">
        {formatDate(story.from.toISOString())} – {story.complete ? formatDate(lastDay(story.to)) : 'so far'}
      </Text>
      <Card>
        <Text>
          {plural(story.counts.memories, 'moment')} · {plural(story.counts.photos, 'photo')} · {plural(story.counts.feeds, 'feed')} logged
        </Text>
      </Card>
      {story.milestones.length > 0 && (
        <Card>
          <Text variant="label">Milestones</Text>
          {story.milestones.map((m) => (
            <Text key={m.title + m.occurred_on}>
              ✨ {m.title} <Text color="textSecondary">· {formatDate(`${m.occurred_on}T12:00:00`)}</Text>
            </Text>
          ))}
        </Card>
      )}
      {story.months.map((mo) => {
        const m = mo.highlight ? byId.get(mo.highlight.id) : undefined;
        return (
          <Card key={mo.index}>
            <Text variant="label">Month {mo.index}</Text>
            {m && (m.photo_path || m.display_asset_id) && (
              <MemoryImage localUri={m.photo_path} assetId={m.display_asset_id} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md }} />
            )}
            {m?.raw_text ? <Text>{m.raw_text}</Text> : null}
            <Text variant="caption" color="textSecondary">
              {m ? formatDate(m.occurred_at) : 'No moments saved this month.'}
            </Text>
          </Card>
        );
      })}
      <View style={{ gap: Spacing.sm }}>
        <Button label="Save as PDF" variant="accent" onPress={savePdf} disabled={busy} />
        {message && <Text color="textSecondary">{message}</Text>}
      </View>
    </Screen>
  );
}
