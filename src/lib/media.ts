// Photo capture + local storage. A photo is copied into app storage before we report success (§28, §54).
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { uri: string; width: number; height: number };

// Sizes are the long edge in px. Re-encoding also strips EXIF (incl. GPS) from uploaded copies.
const VARIANTS = { display: { edge: 1600, compress: 0.82 }, thumbnail: { edge: 400, compress: 0.7 } } as const;

function first(result: ImagePicker.ImagePickerResult): PickedPhoto | null {
  if (result.canceled || !result.assets?.length) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

export async function takePhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission is needed to take a photo.');
  return first(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
}

export async function choosePhoto(): Promise<PickedPhoto | null> {
  return first(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));
}

// Android may kill the app while the camera is open; this returns the photo taken meanwhile.
export async function recoverPendingPhoto(): Promise<PickedPhoto | null> {
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

export function deleteLocalFiles(memoryId: string) {
  const dir = memoryDir(memoryId);
  if (dir.exists) dir.delete();
}

export function deleteAllLocalFiles() {
  const dir = new Directory(Paths.document, 'memories');
  if (dir.exists) dir.delete();
}
