import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { MemoryImage } from '@/components/memory-image';
import { MemoryVideo } from '@/components/memory-video';
import { QuickLog } from '@/components/quick-log';
import { Button, Field, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { insertMemory } from '@/lib/local-db';
import { choosePhoto, chooseVideo, recoverPendingPhoto, storePhoto, storeVideo, takePhoto, takeVideo, type PickedPhoto, type PickedVideo } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/lib/sync';
import { atLeast, useApp, useBaby } from '@/state/app';
import { t } from '@/lib/i18n';

export default function CaptureScreen() {
  const baby = useBaby();
  const { session } = useApp();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  // Video is a plan feature; null = unknown (offline): allow picking, the server has the final say.
  const [videoOk, setVideoOk] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      supabase.rpc('family_usage', { fid: baby.family_id }).then(async ({ data }) => {
        const planId = data?.[0]?.plan_id;
        if (!planId) return;
        const { data: plan } = await supabase.from('plans').select('video').eq('id', planId).single();
        setVideoOk(plan?.video ?? null);
      });
    }, [baby.family_id]),
  );

  // Android can kill the app while the camera is open; recover that photo.
  useEffect(() => {
    track('capture_opened');
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
        setVideo(null);
        setCapturedAt(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : String(e));
    }
  }

  async function pickVideo(source: 'camera' | 'library') {
    setError(null);
    try {
      const v = source === 'camera' ? await takeVideo() : await chooseVideo();
      if (v) {
        setVideo(v);
        setPhoto(null);
        setCapturedAt(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function videoMenu() {
    if (videoOk === false) {
      return Alert.alert(t('Video is a Plus feature'), t('Save short video clips (up to 30 seconds) with Plus or Family.'), [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('See plans'), onPress: () => router.push('/plans') },
      ]);
    }
    Alert.alert(t('Add a video'), t('Clips can be up to 30 seconds.'), [
      { text: t('Record'), onPress: () => pickVideo('camera') },
      { text: t('Choose from library'), onPress: () => pickVideo('library') },
      { text: t('Cancel'), style: 'cancel' },
    ]);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const id = Crypto.randomUUID(); // client id makes offline retries idempotent
      const files = video
        ? await storeVideo(id, video)
        : photo
          ? await storePhoto(id, photo)
          : { original_path: null, photo_path: null, thumb_path: null };
      insertMemory({
        id,
        family_id: baby.family_id,
        baby_id: baby.id,
        author_id: session?.user.id ?? null,
        occurred_at: (capturedAt ?? new Date()).toISOString(),
        type: video ? 'video' : photo ? 'photo' : 'note',
        raw_text: text.trim() || null,
        ...files,
      });
      track('memory_created', { has_photo: !!photo, has_text: !!text.trim() });
      if (photo) track('photo_added');
      setPhoto(null);
      setVideo(null);
      setCapturedAt(null);
      setText('');
      syncNow(baby.id); // background; the memory is already safe on the device
      router.navigate('/journal');
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t('Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (!atLeast(baby.role, 'contributor')) {
    return (
      <Screen>
        <Text variant="display">{t('Capture')}</Text>
        <Text color="textSecondary">
          {t("You can see, react to and comment on {name}'s memories. Ask a parent to make you a contributor to add your own.", { name: baby.name })}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="display">{t('Capture')}</Text>
      {video ? (
        <View style={{ gap: Spacing.sm }}>
          <MemoryVideo localUri={video.uri} assetId={null} poster={{ localUri: null, assetId: null }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#000' }} />
          <Button variant="ghost" label={t('Remove video')} onPress={() => setVideo(null)} />
        </View>
      ) : photo ? (
        <View style={{ gap: Spacing.sm }}>
          <MemoryImage localUri={photo.uri} assetId={null} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg }} label={t('Selected photo')} />
          <Button variant="ghost" label={t('Remove photo')} onPress={() => setPhoto(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label={t('Camera')} onPress={() => pick('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('Photos')} onPress={() => pick('library')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('Video')} onPress={videoMenu} />
          </View>
        </View>
      )}
      <Field
        label={t('What happened?')}
        value={text}
        onChangeText={setText}
        placeholder={t('A few words are enough')}
        multiline
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />
      {error && <Text color="textSecondary">{error}</Text>}
      <Button label={t('Save memory')} variant="accent" onPress={save} disabled={busy || (!photo && !video && !text.trim())} />
      <QuickLog />
    </Screen>
  );
}
