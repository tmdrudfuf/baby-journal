// deno test --config supabase/functions/_shared/deno.json supabase/functions/_shared/
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { googlePlay, mapGoogle } from './billing.ts';

Deno.test('maps a Google subscription to our states', () => {
  assertEquals(
    mapGoogle({
      subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
      lineItems: [{ productId: 'plus_monthly', expiryTime: '2026-10-01T00:00:00Z' }, { productId: 'plus_monthly', expiryTime: '2026-11-01T00:00:00Z' }],
      externalAccountIdentifiers: { obfuscatedExternalAccountId: 'abc' },
    }),
    { state: 'grace', productId: 'plus_monthly', expiresAt: '2026-11-01T00:00:00Z', obfuscatedAccountId: 'abc', acknowledged: false },
  );
  assertEquals(mapGoogle({ subscriptionState: 'SUBSCRIPTION_STATE_SOMETHING_NEW' }).state, 'expired'); // unknown never grants
});

Deno.test('google provider signs a service-account JWT and calls the documented endpoints', async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'],
  );
  const pkcs8 = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))));
  const sa = { client_email: 'svc@example.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n` };
  const calls: { url: string; method: string; body?: string }[] = [];
  const fakeFetch = ((url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body?.toString() });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return Promise.resolve(Response.json({ access_token: 'at' }));
    if (url.endsWith(':acknowledge')) return Promise.resolve(new Response(null, { status: 200 }));
    return Promise.resolve(Response.json({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'plus_yearly', expiryTime: '2027-01-01T00:00:00Z' }] }));
  }) as typeof fetch;

  const play = googlePlay('com.tmdrudfuf.babyjournal', sa, fakeFetch);
  assertEquals((await play.get('plus_yearly', 'tok/1')).state, 'active');
  await play.acknowledge('plus_yearly', 'tok/1');

  const assertion = new URLSearchParams(calls[0].body).get('assertion') ?? '';
  const [header, claims, sig] = assertion.split('.');
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', pair.publicKey,
    Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(`${header}.${claims}`),
  );
  assertEquals(verified, true);
  assertEquals(JSON.parse(atob(claims.replace(/-/g, '+').replace(/_/g, '/'))).scope, 'https://www.googleapis.com/auth/androidpublisher');
  assertEquals(calls[1].url, 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tmdrudfuf.babyjournal/purchases/subscriptionsv2/tokens/tok%2F1');
  assertEquals(calls[3].url, 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tmdrudfuf.babyjournal/purchases/subscriptions/plus_yearly/tokens/tok%2F1:acknowledge');
  assertEquals(calls[3].method, 'POST');
});

Deno.test('store errors surface as failures', async () => {
  const failing = (() => Promise.resolve(new Response('no', { status: 401 }))) as typeof fetch;
  const sa = { client_email: 'x', private_key: 'not a key' };
  await assertRejects(() => googlePlay('p', sa, failing).get('plus_monthly', 't'));
});
