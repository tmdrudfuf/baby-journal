import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics';
import { accountTag, getStore, manageUrl, verify, type Offer, type VerifyResult } from '@/lib/billing';
import { supabase } from '@/lib/supabase';
import { useApp, useBaby } from '@/state/app';
import { t } from '@/lib/i18n';

type Plan = { id: string; storage_bytes: number; max_members: number; originals: boolean; ai_daily: boolean; ai_ask: boolean };

const label = (id: string) => ({ free: t('Free'), plus: t('Plus'), family: t('Family') })[id] ?? id;
const gb = (b: number) => `${Math.round(b / 1024 ** 3)} GB`;
const features = (p: Plan) =>
  [
    t('{size} photo storage', { size: gb(p.storage_bytes) }),
    t('Up to {n} family members', { n: p.max_members }),
    p.ai_daily && t('AI Daily Story'),
    p.ai_ask && t('Ask your journal (AI answers)'),
    p.originals && t('Original-quality backup'),
  ].filter(Boolean) as string[];

const messages = (): Record<string, string> => ({
  pending: t('Your payment is pending. Your plan updates as soon as Google Play confirms it.'),
  'not configured': t('Subscriptions are not available yet.'),
  'store error': t('Google Play could not be reached. Try again or use Restore purchases later.'),
});
const describe = (r: VerifyResult) =>
  r.status === 'done'
    ? t("You're on {plan}. Thank you!", { plan: label(r.plan_id ?? '') })
    : (messages()[r.status] ?? messages()[r.reason ?? ''] ?? t('Something went wrong.'));

export default function PlansScreen() {
  const baby = useBaby();
  const { session, refresh } = useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isOwner = baby.role === 'owner';

  const load = useCallback(() => {
    supabase.from('plans').select('*').order('storage_bytes').then(({ data }) => setPlans((data as Plan[]) ?? []));
    supabase.rpc('family_usage', { fid: baby.family_id }).then(({ data }) => setCurrent(data?.[0]?.plan_id ?? null));
    getStore()
      .then((s) => s.offers())
      .then(setOffers)
      .catch(() => setOffers([]));
  }, [baby.family_id]);
  useFocusEffect(load);
  useFocusEffect(useCallback(() => track('plans_viewed'), []));

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch {
      setMessage(t('The purchase was not completed.'));
    }
    setBusy(false);
    load();
    refresh();
  }

  const buy = (offer: Offer) =>
    run(async () => {
      track('upgrade_started');
      const store = await getStore();
      const owned = await store.buy(offer, await accountTag(session?.user.id ?? ''));
      const result = await verify(baby.family_id, owned);
      if (result.status === 'done') track('upgrade_completed');
      return describe(result);
    });

  const restore = () =>
    run(async () => {
      const owned = await (await getStore()).owned();
      if (!owned.length) return t('No subscriptions found for this Google account.');
      let last: VerifyResult = { status: 'unavailable' };
      for (const o of owned) last = await verify(baby.family_id, o);
      return describe(last);
    });

  return (
    <Screen>
      <Text variant="display">{t('Plans')}</Text>
      <Text color="textSecondary">
        {t(
          'Your memories always stay yours. If a subscription ends, nothing is deleted: you keep viewing and downloading everything, and only new uploads beyond the Free storage pause.',
        )}
      </Text>
      {plans.map((p) => {
        const planOffers = (offers ?? []).filter((o) => o.productId.startsWith(`${p.id}_`));
        return (
          <Card key={p.id}>
            <Text variant="title">
              {label(p.id)}
              {current === p.id ? t(' · your plan') : ''}
            </Text>
            {features(p).map((f) => (
              <Text key={f} color="textSecondary">
                • {f}
              </Text>
            ))}
            {isOwner &&
              current !== p.id &&
              planOffers.map((o) => (
                <Button key={o.productId} label={`${o.price} / ${o.period}`} variant="accent" disabled={busy} onPress={() => buy(o)} />
              ))}
            {planOffers.length > 0 && (
              <Text variant="caption" color="textSecondary">
                {t(
                  'Renews automatically at the price shown until you cancel in Google Play. Cancel anytime; the plan stays until the end of the paid period.',
                )}
              </Text>
            )}
          </Card>
        );
      })}
      {!isOwner && <Text color="textSecondary">{t('Only the family owner can change the plan.')}</Text>}
      {offers !== null && offers.length === 0 && <Text color="textSecondary">{t('Subscriptions are not available on this device yet.')}</Text>}
      {message && <Text>{message}</Text>}
      {isOwner && <Button variant="ghost" label={t('Restore purchases')} disabled={busy} onPress={restore} />}
      <Button variant="ghost" label={t('Manage subscription in Google Play')} onPress={() => Linking.openURL(manageUrl())} />
    </Screen>
  );
}
