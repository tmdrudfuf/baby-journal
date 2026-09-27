// Regenerate: npm i --no-save @resvg/resvg-js && node assets/source/render-icons.js assets/images
// Baby Journal mark: an open journal (sage) with an apricot heart at the spine. Palette per masterplan §22.
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const out = process.argv[2];
const mark = (book, heart) => `
  <path d="M50 38 C41 32 28 30 18 32 L18 72 C28 70 41 71 50 77 Z" fill="${book}"/>
  <path d="M50 38 C59 32 72 30 82 32 L82 72 C72 70 59 71 50 77 Z" fill="${book}" opacity="0.88"/>
  <path d="M50 33 C47 27 38 27 38 34 C38 40 50 46 50 46 C50 46 62 40 62 34 C62 27 53 27 50 33 Z" fill="${heart}"/>`;
const svg = (body, bg, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}<g transform="translate(50 52) scale(${scale}) translate(-50 -52)">${body}</g></svg>`;
const render = (name, s, size) => fs.writeFileSync(`${out}/${name}.png`, new Resvg(s, { fitTo: { mode: 'width', value: size } }).render().asPng());
const SAGE = '#4F6B53', APRICOT = '#E8A27A', IVORY = '#FAF6EF';
render('icon', svg(mark(SAGE, APRICOT), IVORY, 1), 1024);
render('android-icon-foreground', svg(mark(SAGE, APRICOT), null, 0.62), 512); // adaptive safe zone
render('android-icon-background', svg('', IVORY), 512);
render('android-icon-monochrome', svg(mark('#000', '#000'), null, 0.62), 432);
render('splash-icon', svg(mark(SAGE, APRICOT), null, 1), 512);
render('favicon', svg(mark(SAGE, APRICOT), IVORY, 1), 48);
console.log('rendered');
