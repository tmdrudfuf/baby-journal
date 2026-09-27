import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { MemoryImage } from '@/components/memory-image';
import { Button, Field, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { insertMemory } from '@/lib/local-db';
import { choosePhoto, recoverPendingPhoto, storePhoto, takePhoto, type PickedPhoto } from '@/lib/media';
import { syncNow } from '@/lib/sync';
import { atLeast, useApp, useBaby } from '@/state/app';

export default function CaptureScreen() {
  const baby = useBaby();
  const { session } = useApp();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Android can kill the app while the camera is open; recover that photo.
  useEffect(() => {
    recoverPendingPhoto()
      .then((p) => {
        if (p) {
          setPhoto(p);
          setCapturedAt(new Date());
        }
      })
      .catch(() => undefined);
  }, []);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    try {
      const p = source === 'camera' ? await takePhoto() : await choosePhoto();
      if (p) {
        setPhoto(p);
        setCapturedAt(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const id = Crypto.randomUUID(); // client id makes offline retries idempotent
      const files = photo ? await storePhoto(id, photo) : { original_path: null, photo_path: null, thumb_path: null };
      insertMemory({
        id,
        family_id: baby.family_id,
        baby_id: baby.id,
        author_id: session?.user.id ?? null,
        occurred_at: (capturedAt ?? new Date()).toISOString(),
        type: photo ? 'photo' : 'note',
        raw_text: text.trim() || null,
        ...files,
      });
      setPhoto(null);
      setCapturedAt(null);
      setText('');
      syncNow(baby.id); // background; the memory is already safe on the device
      router.navigate('/journal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!atLeast(baby.role, 'contributor')) {
    return (
      <Screen>
        <Text variant="display">Capture</Text>
        <Text color="textSecondary">
          You can see, react to and comment on {baby.name}&apos;s memories. Ask a parent to make you a contributor to add your own.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="display">Capture</Text>
      {photo ? (
        <View style={{ gap: Spacing.sm }}>
          <MemoryImage localUri={photo.uri} assetId={null} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg }} label="Selected photo" />
          <Button variant="ghost" label="Remove photo" onPress={() => setPhoto(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Camera" onPress={() => pick('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Photos" onPress={() => pick('library')} />
          </View>
        </View>
      )}
      <Field
        label="What happened?"
        value={text}
        onChangeText={setText}
        placeholder="A few words are enough"
        multiline
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />
      {error && <Text color="textSecondary">{error}</Text>}
      <Button label="Save memory" variant="accent" onPress={save} disabled={busy || (!photo && !text.trim())} />
    </Screen>
  );
}
