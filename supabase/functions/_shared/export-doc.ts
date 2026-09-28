// Builds the human-readable part of a data export (§37). Pure: no Deno/npm imports (Jest-tested).

export type ExportMemory = {
  id: string;
  occurred_at: string;
  raw_text: string | null;
  story_text: string | null;
  author: string | null;
  photo: string | null; // path inside the zip, e.g. photos/<id>.jpg (a video's still frame)
  video?: string | null; // signed download link (24 h): clips are too large to zip
  comments: { author: string | null; body: string; created_at: string }[];
};

export type ExportBaby = {
  name: string;
  birth_date: string | null;
  family: string;
  memories: ExportMemory[];
  milestones: { title: string; occurred_on: string }[];
  logs: { kind: string; started_at: string; ended_at: string | null; data: unknown }[];
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Calendar day in the family's timezone (an evening memory must not show as the next day).
export const localDay = (iso: string, timeZone: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone });

export function exportHtml(babies: ExportBaby[], exportedAt: string, timeZone = 'UTC'): string {
  const day = (iso: string) => localDay(iso, timeZone);
  const sections = babies
    .map(
      (b) => `
<section>
  <h1>${esc(b.name)}</h1>
  <p class="meta">${esc(b.family)}${b.birth_date ? ` · born ${esc(b.birth_date)}` : ''}</p>
  ${b.milestones.length ? `<h2>Milestones</h2><ul>${b.milestones.map((m) => `<li>${esc(m.occurred_on)} — ${esc(m.title)}</li>`).join('')}</ul>` : ''}
  <h2>Memories</h2>
  ${b.memories
    .map(
      (m) => `<article>
    <p class="meta">${esc(day(m.occurred_at))}${m.author ? ` · ${esc(m.author)}` : ''}</p>
    ${m.photo ? `<img src="${esc(m.photo)}" alt="">` : ''}
    ${m.video ? `<p><a href="${esc(m.video)}">▶ Download video (link works for 24 hours)</a></p>` : ''}
    ${m.raw_text ? `<p>${esc(m.raw_text)}</p>` : ''}
    ${m.story_text ? `<p class="story">${esc(m.story_text)}</p>` : ''}
    ${m.comments.map((c) => `<p class="comment">${esc(c.author ?? 'Family member')}: ${esc(c.body)}</p>`).join('')}
  </article>`,
    )
    .join('\n')}
</section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Baby Journal export</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#FAF6EF;color:#2E2A26}
article{background:#F1E9DC;border-radius:16px;padding:16px;margin:16px 0}img{max-width:100%;border-radius:12px}
.meta{color:#6B625A;font-size:14px}.story{font-style:italic}.comment{color:#6B625A}
</style></head><body>
<p class="meta">Exported ${esc(exportedAt)}. Full data is in journal.json.</p>
${sections}
</body></html>`;
}
