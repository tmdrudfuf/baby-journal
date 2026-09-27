import { uploadKey } from '../../supabase/functions/media-sign/keys';

const fam = 'aaaaaaaa-0000-4000-8000-000000000000';
const mem = 'bbbbbbbb-0000-4000-8000-000000000000';

test('builds family-namespaced key', () => {
  expect(uploadKey({ family_id: fam, memory_id: mem, variant: 'display', ext: 'webp' })).toBe(
    `families/${fam}/memories/${mem}/display.webp`,
  );
});

test.each([
  ['path traversal id', { family_id: '../x', memory_id: mem, variant: 'display', ext: 'jpg' }],
  ['unknown variant', { family_id: fam, memory_id: mem, variant: '../../etc', ext: 'jpg' }],
  ['unknown extension', { family_id: fam, memory_id: mem, variant: 'display', ext: 'exe' }],
])('rejects %s', (_, req) => {
  expect(() => uploadKey(req)).toThrow();
});
