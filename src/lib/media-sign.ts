import { supabase } from '@/lib/supabase';

// media-sign errors keep their HTTP status (for retry decisions) and carry the server's reason
// (e.g. "storage quota exceeded", which the sync badge shows as storage full).
export async function mediaSign<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('media-sign', { body });
  if (error) {
    const detail = await (error.context as Response | undefined)?.json?.().catch(() => null);
    if (detail?.error) error.message = detail.error;
    throw error;
  }
  return data as T;
}
