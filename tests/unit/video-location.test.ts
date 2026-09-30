import { stripVideoLocation } from '@/lib/video-location';

const box = (kind: string, ...body: (string | Uint8Array)[]) => {
  const parts = body.map((b) => (typeof b === 'string' ? Uint8Array.from(b, (c) => c.charCodeAt(0)) : b));
  const size = 8 + parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(Uint8Array.from(kind, (c) => c.charCodeAt(0)), 4);
  let at = 8;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const text = (b: Uint8Array) => String.fromCharCode(...b);

function handleFor(bytes: Uint8Array) {
  return {
    offset: 0 as number | null,
    readBytes(n: number) {
      const at = this.offset ?? 0;
      this.offset = at + n;
      return bytes.slice(at, Math.min(at + n, bytes.length));
    },
    writeBytes(b: Uint8Array) {
      bytes.set(b, this.offset ?? 0);
      this.offset = (this.offset ?? 0) + b.length;
    },
  };
}

test('blanks Android ©xyz and iPhone ISO 6709 locations, leaves samples alone', () => {
  const samples = box('trak', box('stco', '+12.3456+123.4567')); // looks like a coordinate, must stay
  const android = box('udta', box('©xyz', '\u0000\u0012\u0015Ç+37.5665+126.9780/'));
  const apple = box('meta', box('ilst', box('data', '+37.5665+126.9780+012.345/')));
  const file = new Uint8Array([
    ...box('ftyp', 'isom'),
    ...box('mdat', '+37.5665+126.9780/ raw frames'),
    ...box('moov', box('mvhd', 'x'), samples, android, apple),
  ]);
  const before = file.length;

  expect(stripVideoLocation(handleFor(file), file.length)).toBe(2);
  const out = text(file);
  expect(file.length).toBe(before);
  expect(out).toContain('+00.0000+000.0000/');
  expect(out).toContain('+00.0000+000.0000+000.000/');
  expect(out).not.toContain('126.9780/\u0000'); // udta/meta copies gone
  expect(out).toContain('+12.3456+123.4567'); // stco untouched
  expect(out).toContain('+37.5665+126.9780/ raw frames'); // mdat untouched
});

test('leaves files without a location or that are not MP4 alone', () => {
  const plain = new Uint8Array([...box('ftyp', 'isom'), ...box('moov', box('mvhd', 'x'))]);
  const copy = plain.slice();
  expect(stripVideoLocation(handleFor(plain), plain.length)).toBe(0);
  expect(plain).toEqual(copy);
  const junk = new Uint8Array([0, 0, 0, 2, 1, 2, 3, 4, 5, 6]);
  expect(stripVideoLocation(handleFor(junk), junk.length)).toBe(0);
});
