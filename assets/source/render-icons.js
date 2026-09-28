// Regenerate: npm i --no-save @resvg/resvg-js && node assets/source/render-icons.js assets/images
// Baby Journal mark: a baby peeking over an open journal (mint pages, peach face). Palette A, 2026-09-27.
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const out = process.argv[2];
const mark = ({ book, page, face, curl, ink, cheek }) => `
  <path d="M50 50 C41 45 28 44 18 46 L18 80 C28 78 41 79 50 84 Z" fill="${book}"/>
  <path d="M50 50 C59 45 72 44 82 46 L82 80 C72 78 59 79 50 84 Z" fill="${page}"/>
  <circle cx="50" cy="36" r="15" fill="${face}"/>
  <path d="M47 22 C47 17 54 17 53 22" stroke="${curl}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M43 36 q2 2 4 0 M53 36 q2 2 4 0" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  ${cheek ? `<circle cx="41" cy="41" r="2.4" fill="${cheek}"/><circle cx="59" cy="41" r="2.4" fill="${cheek}"/>` : ''}
  <path d="M47 44 q3 2 6 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
const svg = (body, bg, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}<g transform="translate(50 52) scale(${scale}) translate(-50 -52)">${body}</g></svg>`;
const render = (name, s, size) => fs.writeFileSync(`${out}/${name}.png`, new Resvg(s, { fitTo: { mode: 'width', value: size } }).render().asPng());
const COLORS = { book: '#9FD3BC', page: '#B8E0CD', face: '#FFD9C4', curl: '#E9A58A', ink: '#7A4B3A', cheek: '#F6A9A0' };
// Android themed icons keep only the shape (alpha) and tint it, so the monochrome icon is a silhouette.
const MONO = { book: '#000', page: '#000', face: '#000', curl: '#000', ink: '#000', cheek: null };
const BG = '#FFF3EC';
render('icon', svg(mark(COLORS), BG, 1), 1024);
render('android-icon-foreground', svg(mark(COLORS), null, 0.62), 512); // adaptive safe zone
render('android-icon-background', svg('', BG), 512);
render('android-icon-monochrome', svg(mark(MONO), null, 0.62), 432);
render('splash-icon', svg(mark(COLORS), null, 1), 512);
render('favicon', svg(mark(COLORS), BG, 1), 48);
console.log('rendered');
