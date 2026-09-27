// Quick Log (§12, §61): most entries are a single tap, saved on the device first.
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatTime } from '@/lib/dates';
import { endEvent, insertEvent, latestEvent, markEventDeleting, useLocal, type NewEvent } from '@/lib/local-db';
import { syncNow } from '@/lib/sync';
import { describe, parseMeasure, type EventKind } from '@/lib/tracker';
import { useApp, useBaby } from '@/state/app';

type Panel = null | 'feed' | 'diaper' | 'growth' | 'bottle';

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: Spacing.sm }}>{children}</View>;
}
function Cell({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

export function QuickLog() {
  const baby = useBaby();
  const { session } = useApp();
  const [panel, setPanel] = useState<Panel>(null);
  const [amount, setAmount] = useState('');
  const [growth, setGrowth] = useState({ weight: '', height: '', head: '' });
  const [last, setLast] = useState<{ id: string; text: string } | null>(null);
  const sleep = useLocal(() => latestEvent(baby.id, 'sleep'));
  const sleeping = sleep && !sleep.ended_at ? sleep : null;

  // Point events (feed, diaper, growth) and a started sleep all have ended_at = null.
  function log(kind: EventKind, data: Record<string, unknown> = {}) {
    const now = new Date().toISOString();
    const e: NewEvent = {
      id: Crypto.randomUUID(),
      family_id: baby.family_id,
      baby_id: baby.id,
      author_id: session?.user.id ?? null,
      kind,
      started_at: now,
      ended_at: null,
      data,
      note: null,
    };
    insertEvent(e);
    const text = kind === 'sleep' ? 'Sleep started' : describe({ ...e, data }, new Date());
    setLast({ id: e.id, text: `${text} at ${formatTime(now)}` });
    setPanel(null);
    setAmount('');
    syncNow(baby.id);
  }

  // Takes the id as an argument: the React Compiler would otherwise read sleeping.id during render.
  function wake(sleepId: string) {
    endEvent(sleepId, new Date().toISOString());
    setLast({ id: '', text: `Woke up at ${formatTime(new Date().toISOString())}` });
    syncNow(baby.id);
  }

  function undo() {
    if (last?.id) markEventDeleting(last.id);
    setLast(null);
    syncNow(baby.id);
  }

  function saveGrowth() {
    const data: Record<string, number> = {};
    const w = parseMeasure(growth.weight, 30);
    const h = parseMeasure(growth.height, 150);
    const c = parseMeasure(growth.head, 70);
    if (w) data.weight_kg = w;
    if (h) data.height_cm = h;
    if (c) data.head_cm = c;
    if (!Object.keys(data).length) return;
    log('growth', data);
    setGrowth({ weight: '', height: '', head: '' });
  }

  return (
    <Card>
      <Text variant="label">Quick log</Text>
      {sleeping ? (
        <Button label={`Wake up · asleep since ${formatTime(sleeping.started_at)}`} variant="accent" onPress={() => wake(sleeping.id)} />
      ) : null}
      <Row>
        <Cell>
          <Button label="Feed" onPress={() => setPanel(panel === 'feed' ? null : 'feed')} />
        </Cell>
        <Cell>
          {!sleeping && <Button label="Sleep" onPress={() => log('sleep')} />}
          {sleeping && <Button label="Sleeping…" disabled />}
        </Cell>
      </Row>
      <Row>
        <Cell>
          <Button label="Diaper" onPress={() => setPanel(panel === 'diaper' ? null : 'diaper')} />
        </Cell>
        <Cell>
          <Button label="Growth" onPress={() => setPanel(panel === 'growth' ? null : 'growth')} />
        </Cell>
      </Row>

      {panel === 'feed' && (
        <>
          <Row>
            <Cell>
              <Button variant="ghost" label="Breast L" onPress={() => log('feed', { method: 'breast', side: 'left' })} />
            </Cell>
            <Cell>
              <Button variant="ghost" label="Breast R" onPress={() => log('feed', { method: 'breast', side: 'right' })} />
            </Cell>
          </Row>
          <Row>
            <Cell>
              <Button variant="ghost" label="Bottle" onPress={() => setPanel('bottle')} />
            </Cell>
            <Cell>
              <Button variant="ghost" label="Solid food" onPress={() => log('feed', { method: 'solid' })} />
            </Cell>
          </Row>
        </>
      )}
      {panel === 'bottle' && (
        <>
          <Field label="Amount (ml, optional)" value={amount} onChangeText={setAmount} keyboardType="numeric" autoFocus />
          <Button
            label="Log bottle"
            onPress={() => {
              const ml = parseMeasure(amount, 500);
              log('feed', ml ? { method: 'bottle', amount_ml: Math.round(ml) } : { method: 'bottle' });
            }}
          />
        </>
      )}
      {panel === 'diaper' && (
        <Row>
          <Cell>
            <Button variant="ghost" label="Wet" onPress={() => log('diaper', { type: 'wet' })} />
          </Cell>
          <Cell>
            <Button variant="ghost" label="Dirty" onPress={() => log('diaper', { type: 'dirty' })} />
          </Cell>
          <Cell>
            <Button variant="ghost" label="Both" onPress={() => log('diaper', { type: 'both' })} />
          </Cell>
        </Row>
      )}
      {panel === 'growth' && (
        <>
          <Field label="Weight (kg)" value={growth.weight} onChangeText={(weight) => setGrowth({ ...growth, weight })} keyboardType="decimal-pad" />
          <Field label="Height (cm)" value={growth.height} onChangeText={(height) => setGrowth({ ...growth, height })} keyboardType="decimal-pad" />
          <Field label="Head (cm)" value={growth.head} onChangeText={(head) => setGrowth({ ...growth, head })} keyboardType="decimal-pad" />
          <Button label="Save measurement" onPress={saveGrowth} />
        </>
      )}

      {last && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Text color="textSecondary" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            ✓ {last.text}
          </Text>
          {last.id ? <Button variant="ghost" label="Undo" onPress={undo} /> : null}
        </View>
      )}
    </Card>
  );
}
