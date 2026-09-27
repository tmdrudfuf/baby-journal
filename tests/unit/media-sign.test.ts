import { mediaSign } from '@/lib/media-sign';
import { isPermanent } from '@/lib/sync-policy';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));

// Shape of supabase-js FunctionsHttpError: message is generic, the Response is in `context`.
const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: new Response(JSON.stringify(body), { status }) });

test('returns data on success', async () => {
  mockInvoke.mockResolvedValueOnce({ data: { bytes: 10 }, error: null });
  await expect(mediaSign({ action: 'confirm' })).resolves.toEqual({ bytes: 10 });
});

test("quota errors carry the server's reason and stay permanent", async () => {
  mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(403, { error: 'storage quota exceeded' }) });
  const e = (await mediaSign({ action: 'confirm' }).catch((x: unknown) => x)) as Error;
  expect(e.message).toBe('storage quota exceeded'); // the sync badge shows "storage is full"
  expect(isPermanent(e)).toBe(true);
});

test('server errors stay retryable', async () => {
  mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(503, { error: 'storage unavailable' }) });
  expect(isPermanent(await mediaSign({ action: 'confirm' }).catch((x) => x))).toBe(false);
});
