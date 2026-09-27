// Subscriptions (M8). The only writer of purchases and store entitlements; the client never sets a plan.
//
// POST { action: 'verify', family_id, product_id, purchase_token } (family owner; also used for restore)
//   -> { status: 'done' | 'pending' | 'unavailable', plan_id?, reason? }
// POST { action: 'refresh' } (service role; pg_cron) -> { refreshed }
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { accountTag, googlePlay, mockBilling, type BillingProvider, type StorePurchase } from '../_shared/billing.ts';

const PACKAGE = Deno.env.get('ANDROID_PACKAGE') ?? 'com.tmdrudfuf.babyjournal';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Explicit selection, like AI_PROVIDER: the mock is never a fallback, so mock tokens are rejected in real setups.
function provider(): BillingProvider | null {
  const choice = Deno.env.get('BILLING_PROVIDER');
  if (choice === 'mock') return mockBilling();
  const sa = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  return choice === 'google' && sa ? googlePlay(PACKAGE, JSON.parse(sa)) : null;
}

// The gateway verified the JWT; we only read its role.
function jwtRole(req: Request): string | null {
  try {
    const payload = (req.headers.get('Authorization')?.split(' ')[1] ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role ?? null;
  } catch {
    return null;
  }
}

// Record what the store says, acknowledge (Play refunds unacknowledged purchases after 3 days), rebuild the plan.
async function apply(admin: SupabaseClient, store: BillingProvider, row: { token: string; familyId: string; userId: string | null; productId: string }, p: StorePurchase) {
  let acknowledged = p.acknowledged;
  if (!acknowledged && (p.state === 'active' || p.state === 'grace')) {
    await store.acknowledge(row.productId, row.token);
    acknowledged = true;
  }
  const { error } = await admin.from('purchases').upsert({
    purchase_token: row.token, family_id: row.familyId, user_id: row.userId, provider: store.name,
    product_id: row.productId, state: p.state, expires_at: p.expiresAt, acknowledged, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await admin.rpc('sync_store_entitlement', { fid: row.familyId });
}

async function verify(req: Request, body: Record<string, unknown>, admin: SupabaseClient) {
  if (jwtRole(req) !== 'authenticated') return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: allowedRate } = await db.rpc('hit_rate_limit', { bucket_name: 'billing', max_hits: 30, window_seconds: 3600 });
  if (!allowedRate) return json({ error: 'too many requests' }, 429);

  const { family_id: familyId, product_id: productId, purchase_token: token } = body;
  if (typeof familyId !== 'string' || typeof productId !== 'string' || typeof token !== 'string' || token.length > 4096) {
    return json({ error: 'invalid request' }, 400);
  }
  const { data: isOwner } = await db.rpc('has_family_role', { fid: familyId, min_role: 'owner' });
  if (!isOwner) return json({ error: 'forbidden' }, 403);
  const { data: product } = await admin.from('plan_products').select('plan_id').eq('product_id', productId).maybeSingle();
  if (!product) return json({ error: 'unknown product' }, 400);

  const store = provider();
  if (!store) return json({ status: 'unavailable', reason: 'not configured' });

  // A token binds to one family forever: the same purchase cannot upgrade a second family.
  const { data: existing } = await admin.from('purchases').select('family_id, user_id').eq('purchase_token', token).maybeSingle();
  if (existing && existing.family_id !== familyId) return json({ error: 'purchase belongs to another family' }, 409);

  let p: StorePurchase;
  try {
    p = await store.get(productId, token);
  } catch (e) {
    console.error('store lookup failed', (e as Error).message); // never log the token
    return json({ status: 'unavailable', reason: 'store error' });
  }
  if (p.productId && p.productId !== productId) return json({ error: 'product mismatch' }, 400);

  const userId = (await db.auth.getUser()).data.user?.id ?? null;
  // The first binding must come from the account that bought it; later restores by the family are fine.
  if (!existing && p.obfuscatedAccountId && userId && p.obfuscatedAccountId !== (await accountTag(userId))) {
    return json({ error: 'purchase belongs to another account' }, 403);
  }
  if (p.state === 'pending') {
    await admin.from('purchases').upsert({ purchase_token: token, family_id: familyId, user_id: userId, provider: store.name, product_id: productId, state: 'pending', expires_at: p.expiresAt });
    return json({ status: 'pending' });
  }
  try {
    await apply(admin, store, { token, familyId, userId: existing?.user_id ?? userId, productId }, p);
  } catch (e) {
    console.error('apply failed', (e as Error).message);
    return json({ status: 'unavailable', reason: 'store error' });
  }
  const { data: plan } = await admin.rpc('family_plan', { fid: familyId });
  return json({ status: 'done', plan_id: (plan as { id: string } | null)?.id ?? 'free' });
}

// Renewals, cancellations, refunds: re-check purchases near their end date.
// ponytail: polling every 6 h; add Play real-time developer notifications (Pub/Sub) for instant updates.
async function refresh(admin: SupabaseClient) {
  const store = provider();
  if (!store) return json({ refreshed: 0 });
  const { data: due } = await admin
    .from('purchases')
    .select('purchase_token, family_id, user_id, product_id')
    .eq('provider', store.name)
    .in('state', ['active', 'grace', 'canceled', 'pending'])
    .lt('expires_at', new Date(Date.now() + 3 * 86_400_000).toISOString())
    .limit(50);
  let refreshed = 0;
  for (const r of due ?? []) {
    try {
      const p = await store.get(r.product_id, r.purchase_token);
      await apply(admin, store, { token: r.purchase_token, familyId: r.family_id, userId: r.user_id, productId: r.product_id }, p);
      refreshed++;
    } catch (e) {
      console.error('refresh failed', (e as Error).message);
    }
  }
  return json({ refreshed });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({}));
  if (body.action === 'refresh') return jwtRole(req) === 'service_role' ? refresh(admin) : json({ error: 'forbidden' }, 403);
  if (body.action === 'verify') return verify(req, body, admin);
  return json({ error: 'unknown action' }, 400);
});
