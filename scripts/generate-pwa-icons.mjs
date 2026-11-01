// Rasterize existing artwork only; do not redraw or reinterpret branding.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const source = await readFile('public/logo.svg');
const favicon = await readFile('public/favicon.svg');
for (const [name, size] of [['logo-v4-192.png',192],['logo-v4.png',512],['logo.png',512],...['apple-touch-icon','apple-touch-icon-v4','apple-touch-icon-v5','apple-touch-icon-precomposed','apple-touch-icon-precomposed-v4','apple-touch-icon-precomposed-v5'].map(n=>[`${n}.png`,180])]) {
  await sharp(source).resize(size,size).png().toFile(`public/${name}`);
}
await sharp(favicon).resize(32,32).png().toFile('public/favicon.png');
// Keep ALL existing artwork inside the maskable central safe-zone circle:
// a 56%-width square has its corners within a radius of 40% of canvas width.
for (const size of [192,512]) {
  const inner = Math.floor(size * .56);
  const inset = Math.floor((size-inner)/2);
  const artwork = await sharp(source).resize(inner,inner).png().toBuffer();
  await sharp({create:{width:size,height:size,channels:4,background:'#141411'}})
    .composite([{input:artwork,left:inset,top:inset}]).png().toFile(`public/logo-maskable-${size}.png`);
}
console.log('PWA raster assets regenerated from unchanged repository SVGs.');
