// Pure helpers for media-sign (no Deno/npm imports so Jest can test them).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VARIANTS = ['thumbnail', 'display', 'original', 'poster', 'playback'] as const;
export const EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
};
export const URL_TTL_SECONDS = 300;

export type UploadRequest = { family_id: string; memory_id: string; variant: string; ext: string };

// Keys are derived server-side, never taken from the client (no path injection).
export function uploadKey(req: UploadRequest): string {
  if (!UUID.test(req.family_id) || !UUID.test(req.memory_id)) throw new Error('invalid id');
  if (!(VARIANTS as readonly string[]).includes(req.variant)) throw new Error('invalid variant');
  if (!(req.ext in EXTENSIONS)) throw new Error('invalid extension');
  return `families/${req.family_id.toLowerCase()}/memories/${req.memory_id.toLowerCase()}/${req.variant}.${req.ext}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
