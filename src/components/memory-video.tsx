// Plays a memory's clip: the local file when this device has it, otherwise a signed R2 URL.
// Until the URL arrives (or offline) the still frame stands in.
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import type { ImageStyle } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';

import { MemoryImage, signedUrl } from '@/components/memory-image';

type Props = {
  localUri: string | null;
  assetId: string | null;
  poster: { localUri: string | null; assetId: string | null };
  style: StyleProp<ViewStyle>;
};

export function MemoryVideo({ localUri, assetId, poster, style }: Props) {
  const [remote, setRemote] = useState<string | null>(null);
  useEffect(() => {
    if (localUri || !assetId) return;
    let alive = true;
    signedUrl(assetId).then((url) => alive && setRemote(url ?? null));
    return () => {
      alive = false;
    };
  }, [localUri, assetId]);

  const uri = localUri ?? remote;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  if (!uri) return <MemoryImage localUri={poster.localUri} assetId={poster.assetId} style={style as StyleProp<ImageStyle>} video />;
  return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}
