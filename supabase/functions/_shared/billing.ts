// Store abstraction for subscriptions (M8). The billing function depends on this interface only.
// Field names follow the Google Play Developer API v3 reference (purchases.subscriptionsv2).

export type StoreState = 'active' | 'grace' | 'on_hold' | 'paused' | 'canceled' | 'expired' | 'pending';

export type StorePurchase = {
  state: StoreState;
  productId: string | null;
  expiresAt: string | null;
  obfuscatedAccountId: string | null; // set by the app at checkout: hash of the purchaser's user id
  acknowledged: boolean;
};

export interface BillingProvider {
  name: 'google_play' | 'mock';
  get(productId: string, token: string): Promise<StorePurchase>;
  acknowledge(productId: string, token: string): Promise<void>;
}

// Checkout binds a purchase to the account that made it (Play: obfuscatedAccountIdAndroid).
export async function accountTag(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`babyjournal:${userId}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
}

const GOOGLE_STATES: Record<string, StoreState> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
  SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING: 'pending',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
};

type GoogleSubscription = {
  subscriptionState?: string;
  acknowledgementState?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
};

export function mapGoogle(g: GoogleSubscription): StorePurchase {
  // Several line items only happen with add-ons; the latest expiry is the paid-through date.
  const items = g.lineItems ?? [];
  const latest = items.reduce<{ productId?: string; expiryTime?: string } | null>(
    (best, li) => (!best || (li.expiryTime ?? '') > (best.expiryTime ?? '') ? li : best),
    null,
  );
  return {
    state: GOOGLE_STATES[g.subscriptionState ?? ''] ?? 'expired',
    productId: latest?.productId ?? null,
    expiresAt: latest?.expiryTime ?? null,
    obfuscatedAccountId: g.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    acknowledged: g.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  };
}

type ServiceAccount = { client_email: string; private_key: string };
const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// OAuth2 service-account flow (RFC 7523) with Web Crypto; no Google SDK needed.
async function accessToken(sa: ServiceAccount, fetchFn: typeof fetch): Promise<string> {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
  });
  if (!r.ok) throw new Error(`google auth ${r.status}`);
  return (await r.json()).access_token;
}

export function googlePlay(packageName: string, serviceAccount: ServiceAccount, fetchFn: typeof fetch = fetch): BillingProvider {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases`;
  return {
    name: 'google_play',
    async get(_productId, token) {
      const auth = await accessToken(serviceAccount, fetchFn);
      const r = await fetchFn(`${base}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { authorization: `Bearer ${auth}` } });
      if (!r.ok) throw new Error(`google get ${r.status}`);
      return mapGoogle(await r.json());
    },
    async acknowledge(productId, token) {
      const auth = await accessToken(serviceAccount, fetchFn);
      const r = await fetchFn(`${base}/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, {
        method: 'POST',
        headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) throw new Error(`google acknowledge ${r.status}`);
    },
  };
}

// Local/CI only (BILLING_PROVIDER=mock). Tokens look like `mock:<state>:<accountTag>:<nonce>`.
export const mockAcknowledged = new Set<string>();
export function mockBilling(): BillingProvider {
  return {
    name: 'mock',
    get(productId, token) {
      const [prefix, state, account] = token.split(':');
      if (prefix !== 'mock' || !state) return Promise.reject(new Error('unknown mock token'));
      const days = state === 'expired' ? -1 : 30;
      return Promise.resolve({
        state: state as StoreState,
        productId,
        expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
        obfuscatedAccountId: account || null,
        acknowledged: mockAcknowledged.has(token),
      });
    },
    acknowledge(_productId, token) {
      mockAcknowledged.add(token);
      return Promise.resolve();
    },
  };
}
