import { exportHtml, localDay } from '../../supabase/functions/_shared/export-doc';

test('export page escapes user text and links photos', () => {
  const html = exportHtml(
    [
      {
        name: 'Noah <3',
        birth_date: '2026-09-01',
        family: "Noah's family",
        milestones: [{ title: 'First smile', occurred_on: '2026-09-20' }],
        logs: [],
        memories: [
          {
            id: 'm1',
            occurred_at: '2026-09-26T07:00:00Z',
            raw_text: '<script>alert(1)</script>',
            story_text: null,
            author: 'Mom',
            photo: 'photos/m1.jpg',
            comments: [{ author: 'Grandma', body: 'Cute & sweet', created_at: '2026-09-26T08:00:00Z' }],
          },
        ],
      },
    ],
    '2026-09-27',
  );
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('Noah &lt;3');
  expect(html).toContain('<img src="photos/m1.jpg"');
  expect(html).toContain('Grandma: Cute &amp; sweet');
  expect(html).toContain('2026-09-20 — First smile');
});

test('export days follow the family timezone', () => {
  expect(localDay('2026-09-27T07:00:00Z', 'Pacific/Honolulu')).toBe('2026-09-26');
  expect(localDay('2026-09-27T07:00:00Z', 'Asia/Seoul')).toBe('2026-09-27');
});

test('videos are linked, not embedded, and the link is escaped', () => {
  const html = exportHtml(
    [
      {
        name: 'Noah',
        birth_date: null,
        family: 'F',
        milestones: [],
        logs: [],
        memories: [
          { id: 'v1', occurred_at: '2026-09-26T07:00:00Z', raw_text: null, story_text: null, author: null, photo: 'photos/v1.jpg', video: 'https://r2.example/v1.mp4?a=1&b=2', comments: [] },
        ],
      },
    ],
    '2026-09-27',
  );
  expect(html).toContain('href="https://r2.example/v1.mp4?a=1&amp;b=2"');
  expect(html).toContain('<img src="photos/v1.jpg"');
});
