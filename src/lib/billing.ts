// Subscriptions (M8). The app only talks to the store to show offers and start checkout; the server
// (`billing` function) verifies every purchase and is the only thing that can change a family's plan.
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import { t } from '@/lib/i18n';

export const PACKAGE_NAME = 'com.tmdrudfuf.babyjournal';
export const PRODUCT_IDS = ['plus_monthly', 'plus_yearly', 'family_monthly', 'family_yearly'];

export type Offer = { productId: string; price: string; period: string; offerToken: string | null };
export type Owned = { productId: string; token: string; finish: () => Promise<void> };

export interface Store {
  offers(): Promise<Offer[]>;
  // Resolves when the store reports the purchase (not yet verified).
  buy(offer: Offer, accountTag: string): Promise<Owned>;
  owned(): Promise<Owned[]>;
}

const periodLabel = (p?: { unit: string; value: number } | null): string => {
  const one: Record<string, string> = { day: t('day'), week: t('week'), month: t('month'), year: t('year') };
  const many: Record<string, string> = { day: t('{n} days'), week: t('{n} weeks'), month: t('{n} months'), year: t('{n} years') };
  if (!p || !one[p.unit]) return '';
  return p.value === 1 ? one[p.unit] : many[p.unit].replace('{n}', String(p.value));
};

// Test-only store (EXPO_PUBLIC_BILLING=mock). The server accepts its tokens only when BILLING_PROVIDER=mock.
function mockStore(): Store {
  const bought: Owned[] = [];
  const prices: Record<string, [string, string]> = {
    plus_monthly: ['$4.99 (test)', 'month'], plus_yearly: ['$39.99 (test)', 'year'],
    family_monthly: ['$7.99 (test)', 'month'], family_yearly: ['$59.99 (test)', 'year'],
  };
  return {
    offers: async () => PRODUCT_IDS.map((productId) => ({ productId, price: prices[productId][0], period: prices[productId][1] === 'month' ? t('month') : t('year'), offerToken: null })),
    async buy(offer, accountTag) {
      const owned = { productId: offer.productId, token: `mock:active:${accountTag}:${Crypto.randomUUID()}`, finish: async () => undefined };
      bought.push(owned);
      return owned;
    },
    owned: async () => bought,
  };
}

// Google Play via expo-iap, loaded only when the plans screen needs it.
// ponytail: compiles against expo-iap 5.8 types; unverified against real Play products until Play Console exists.
async function playStore(): Promise<Store> {
  const iap = await import('expo-iap');
  await iap.initConnection();
  const wrap = (p: { productId: string; purchaseToken?: string | null }, purchase: Parameters<typeof iap.finishTransaction>[0]['purchase']): Owned | null =>
    p.purchaseToken ? { productId: p.productId, token: p.purchaseToken, finish: () => iap.finishTransaction({ purchase, isConsumable: false }).then(() => undefined) } : null;
  return {
    async offers() {
      const products = (await iap.fetchProducts({ skus: PRODUCT_IDS, type: 'subs' })) ?? [];
      return products.flatMap((p) => {
        if (p.platform !== 'android' || p.type !== 'subs') return [];
        const base = p.subscriptionOffers.find((o) => o.offerTokenAndroid);
        return base ? [{ productId: p.id, price: base.displayPrice, period: periodLabel(base.period), offerToken: base.offerTokenAndroid ?? null }] : [];
      });
    },
    buy(offer, accountTag) {
      return new Promise((resolve, reject) => {
        const done = () => { ok.remove(); fail.remove(); };
        const ok = iap.purchaseUpdatedListener((purchase) => {
          if (purchase.productId !== offer.productId) return;
          const owned = wrap(purchase, purchase);
          done();
          if (owned) resolve(owned);
          else reject(new Error('pending'));
        });
        const fail = iap.purchaseErrorListener((e) => { done(); reject(e); });
        iap
          .requestPurchase({
            type: 'subs',
            request: {
              google: {
                skus: [offer.productId],
                subscriptionOffers: offer.offerToken ? [{ sku: offer.productId, offerToken: offer.offerToken }] : null,
                obfuscatedAccountId: accountTag, // lets the server check the buyer
              },
            },
          })
          .catch((e) => { done(); reject(e); });
      });
    },
    async owned() {
      const purchases = await iap.getAvailablePurchases();
      return purchases.flatMap((p) => (PRODUCT_IDS.includes(p.productId) ? [wrap(p, p)].filter((x): x is Owned => !!x) : []));
    },
  };
}

let store: Promise<Store> | null = null;
export function getStore(): Promise<Store> {
  store ??= process.env.EXPO_PUBLIC_BILLING === 'mock' ? Promise.resolve(mockStore()) : playStore();
  store.catch(() => (store = null)); // retry the connection next time
  return store;
}

// Must match accountTag() in supabase/functions/_shared/billing.ts.
export async function accountTag(userId: string): Promise<string> {
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `babyjournal:${userId}`)).slice(0, 64);
}

export type VerifyResult = { status: 'done' | 'pending' | 'unavailable'; plan_id?: string; reason?: string };

// The server acknowledges with Google; finishing afterwards just clears the purchase from the device queue.
export async function verify(familyId: string, owned: Owned): Promise<VerifyResult> {
  const { data, error } = await supabase.functions.invoke('billing', {
    body: { action: 'verify', family_id: familyId, product_id: owned.productId, purchase_token: owned.token },
  });
  if (error) throw error;
  if (data?.status === 'done') await owned.finish().catch(() => undefined);
  return data as VerifyResult;
}

export const manageUrl = (productId?: string) =>
  `https://play.google.com/store/account/subscriptions?package=${PACKAGE_NAME}${productId ? `&sku=${productId}` : ''}`;
