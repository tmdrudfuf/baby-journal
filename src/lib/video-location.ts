// Blanks the recording location that phones write into MP4 metadata (moov/udta ©xyz on Android,
// moov/meta ISO 6709 values on iPhone). Coordinates become +00.0000+000.0000 in place, so box sizes
// and the video itself are untouched. Only moov's udta/meta children are scanned, never sample tables.

type Handle = { offset: number | null; readBytes(length: number): Uint8Array; writeBytes(bytes: Uint8Array): void };

const ISO6709 = /[+-]\d{2}(?:\.\d+)?[+-]\d{3}(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)?/g;
const ZERO = 0x30;

function type(b: Uint8Array, at: number) {
  return String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
}

function u32(b: Uint8Array, at: number) {
  return ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
}

// Box header at `at` inside `b`: [size, headerLength]. size 0 = to the end of the container.
function header(b: Uint8Array, at: number, end: number): [number, number] {
  const size = u32(b, at);
  if (size === 1) return [u32(b, at + 8) * 2 ** 32 + u32(b, at + 12), 16];
  return [size === 0 ? end - at : size, 8];
}

/** Returns how many coordinates were blanked. */
export function blankLocation(bytes: Uint8Array): number {
  let blanked = 0;
  for (let at = 8; at + 8 <= bytes.length; ) {
    const [size] = header(bytes, at, bytes.length);
    if (size < 8) break;
    const kind = type(bytes, at + 4);
    if (kind === 'udta' || kind === 'meta') {
      const end = Math.min(at + size, bytes.length);
      let text = '';
      for (let i = at; i < end; i += 8192) text += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, end)));
      for (const m of text.matchAll(ISO6709)) {
        for (let i = 0; i < m[0].length; i++) {
          const c = m[0].charCodeAt(i);
          if (c >= ZERO && c <= 0x39) bytes[at + m.index + i] = ZERO;
        }
        blanked++;
      }
    }
    at += size;
  }
  return blanked;
}

/** Walks the top-level boxes of an MP4 and blanks the location inside moov. */
export function stripVideoLocation(file: Handle, fileSize: number): number {
  let at = 0;
  while (at + 8 <= fileSize) {
    file.offset = at;
    const head = file.readBytes(16);
    const [size, headerLength] = header(head, 0, fileSize - at);
    if (size < headerLength) return 0; // not an MP4 we understand; leave it alone
    if (type(head, 4) === 'moov') {
      file.offset = at;
      const moov = file.readBytes(size);
      const blanked = blankLocation(moov.subarray(headerLength - 8));
      if (blanked) {
        file.offset = at;
        file.writeBytes(moov);
      }
      return blanked;
    }
    at += size;
  }
  return 0;
}
