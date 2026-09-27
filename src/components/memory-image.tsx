// Shows a memory photo: the local file when this device has it, otherwise a signed R2 URL.
import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import type { StyleProp } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const cache = new Map<string, { url: string; expires: number }>();
let queue: { id: string; resolve: (url: string | null) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

// Batches all thumbnails requested in the same tick into one media-sign call.
function signedUrl(assetId: string): Promise<string | null> {
  const hit = cache.get(assetId);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    queue.push({ id: assetId, resolve });
    timer ??= setTimeout(flush, 0);
  });
}

async function flush() {
  const pending = queue;
  queue = [];
  timer = null;
  for (let i = 0; i < pending.length; i += 100) {
    const batch = pending.slice(i, i + 100);
    const { data } = await supabase.functions
      .invoke('media-sign', { body: { action: 'download', asset_ids: [...new Set(batch.map((b) => b.id))] } })
      .catch(() => ({ data: null }));
    const expires = Date.now() + ((data?.expires_in ?? 300) - 30) * 1000;
    for (const b of batch) {
      const url: string | undefined = data?.urls?.[b.id];
      if (url) cache.set(b.id, { url, expires });
      b.resolve(url ?? null);
    }
  }
}

type Props = { localUri: string | null; assetId: string | null; style: StyleProp<ImageStyle>; label?: string };

export function MemoryImage({ localUri, assetId, style, label }: Props) {
  const theme = useTheme();
  const [remote, setRemote] = useState<string | null>(null);

  useEffect(() => {
    if (localUri || !assetId) return;
    let alive = true;
    signedUrl(assetId).then((url) => alive && setRemote(url));
    return () => {
      alive = false;
    };
  }, [localUri, assetId]);

  // cacheKey = asset id, so a fresh signature doesn't re-download the same image.
  const source = localUri ? { uri: localUri } : remote && assetId ? { uri: remote, cacheKey: assetId } : null;
  return (
    <Image
      source={source}
      style={[{ backgroundColor: theme.surface }, style]}
      contentFit="cover"
      transition={150}
      accessibilityLabel={label ?? 'Memory photo'}
    />
  );
}
