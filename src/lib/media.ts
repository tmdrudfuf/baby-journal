// Photo capture + local storage. A photo is copied into app storage before we report success (§28, §54).
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { t } from '@/lib/i18n';
import { stripVideoLocation } from '@/lib/video-location';

export type PickedPhoto = { uri: string; width: number; height: number };
export type PickedVideo = { uri: string; kind: 'video' };

export const VIDEO_MAX_SECONDS = 30;

// Sizes are the long edge in px. Re-encoding also strips EXIF (incl. GPS) from uploaded copies.
const VARIANTS = { display: { edge: 1600, compress: 0.82 }, thumbnail: { edge: 400, compress: 0.7 } } as const;

function first(result: ImagePicker.ImagePickerResult): PickedPhoto | null {
  if (result.canceled || !result.assets?.length) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

export async function takePhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error(t('Camera permission is needed to take a photo.'));
  return first(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
}

export async function choosePhoto(): Promise<PickedPhoto | null> {
  return first(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));
}

// Android only honours the length limit when recording, so picked clips are checked here too.
// Only mp4 is accepted: it plays everywhere and is what phone cameras record.
function firstVideo(result: ImagePicker.ImagePickerResult): PickedVideo | null {
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  if ((a.duration ?? 0) > (VIDEO_MAX_SECONDS + 1) * 1000) throw new Error(t('Videos can be up to 30 seconds.'));
  const mp4 = a.mimeType === 'video/mp4' || /\.mp4$/i.test(a.fileName ?? a.uri);
  if (!mp4) throw new Error(t('This video format is not supported. Try a video recorded with the phone camera.'));
  return { uri: a.uri, kind: 'video' };
}

export async function takeVideo(): Promise<PickedVideo | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error(t('Camera permission is needed to record a video.'));
  return firstVideo(await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: VIDEO_MAX_SECONDS }));
}

export async function chooseVideo(): Promise<PickedVideo | null> {
  return firstVideo(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: VIDEO_MAX_SECONDS }));
}

// Android may kill the app while the camera is open; this returns the photo taken meanwhile.
// Only meaningful right after a process restart, so it runs once per launch: re-running on
// a screen remount could resurrect an already-used result.
let recoveryChecked = false;
export async function recoverPendingPhoto(): Promise<PickedPhoto | null> {
  if (recoveryChecked) return null;
  recoveryChecked = true;
  const result = await ImagePicker.getPendingResultAsync();
  if (!result || !('canceled' in result)) return null;
  return first(result);
}

function memoryDir(memoryId: string) {
  return new Directory(Paths.document, 'memories', memoryId);
}

async function variant(photo: PickedPhoto, name: keyof typeof VARIANTS, dir: Directory) {
  const { edge, compress } = VARIANTS[name];
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > edge) {
    ctx.resize(photo.width >= photo.height ? { width: edge } : { height: edge });
  }
  const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress });
  const dest = new File(dir, `${name}.jpg`);
  new File(saved.uri).moveSync(dest);
  return dest.uri;
}

export async function storePhoto(memoryId: string, photo: PickedPhoto) {
  const dir = memoryDir(memoryId);
  dir.create({ intermediates: true, idempotent: true });
  const src = new File(photo.uri);
  const original = new File(dir, `original.${src.extension.replace('.', '') || 'jpg'}`);
  src.copySync(original);
  return {
    original_path: original.uri,
    photo_path: await variant(photo, 'display', dir),
    thumb_path: await variant(photo, 'thumbnail', dir),
  };
}

// The clip is kept as-is; a still frame becomes the usual display/thumbnail images so every
// photo view (Home, Journal, slideshow, PDF) works for videos too.
// ponytail: no re-encoding; add compression if clips make storage the main upgrade reason.
export async function storeVideo(memoryId: string, video: PickedVideo) {
  const dir = memoryDir(memoryId);
  dir.create({ intermediates: true, idempotent: true });
  const clip = new File(dir, 'playback.mp4');
  new File(video.uri).copySync(clip);
  const handle = clip.open(FileMode.ReadWrite);
  try {
    stripVideoLocation(handle, clip.size);
  } finally {
    handle.close();
  }
  const frame = await getThumbnailAsync(clip.uri, { time: 0, quality: 0.9 });
  const still = { uri: frame.uri, width: frame.width, height: frame.height };
  return {
    original_path: null,
    video_path: clip.uri,
    photo_path: await variant(still, 'display', dir),
    thumb_path: await variant(still, 'thumbnail', dir),
  };
}

export function deleteLocalFiles(memoryId: string) {
  const dir = memoryDir(memoryId);
  if (dir.exists) dir.delete();
}

export function deleteAllLocalFiles() {
  const dir = new Directory(Paths.document, 'memories');
  if (dir.exists) dir.delete();
}
