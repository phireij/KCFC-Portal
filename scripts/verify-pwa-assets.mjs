import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
const manifest = JSON.parse(await readFile('public/manifest.json','utf8'));
assert.equal(manifest.name,'KCFC Portal');
assert.equal(manifest.short_name,'KCFC Portal');
assert.equal(manifest.description,'The member and ministry portal for the Koiwa Church Filipino Community.');
assert.equal(manifest.id,'/'); assert.equal(manifest.scope,'/'); assert.equal(manifest.start_url,'/');
assert.equal(manifest.display,'standalone');
const html = await readFile('index.html','utf8');
const viewport = html.match(/name="viewport" content="([^"]+)"/)?.[1];
assert.equal(viewport,'width=device-width, initial-scale=1.0','Zoom must remain available');
const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);
let checked = 0;
for (const file of (await readdir('public')).filter(n=>n.endsWith('.png'))) {
  const bytes = await readFile(`public/${file}`);
  assert.ok(bytes.subarray(0,8).equals(pngSignature),`${file}: invalid PNG signature`);
  // Force full decoding, not just header parsing, to catch corrupt IDAT payloads.
  const {info} = await sharp(bytes,{failOn:'warning'}).raw().toBuffer({resolveWithObject:true});
  const expected = file.startsWith('apple-touch')?180:file==='favicon.png'?32:file.includes('192')?192:512;
  assert.equal(info.width,expected,`${file}: width`);assert.equal(info.height,expected,`${file}: height`);
  checked++;
}
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith('/') && !icon.src.startsWith('//'));
  const bytes = await readFile(`public${icon.src.split('?')[0]}`);
  if (icon.type==='image/png') {
    const meta=await sharp(bytes).metadata();
    assert.equal(icon.sizes,`${meta.width}x${meta.height}`);
    if (icon.purpose==='maskable') {
      assert.match(icon.src,/logo-maskable-/);
      const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
        const i=(y*info.width+x)*4;
        assert.equal(data[i+3],255,'Maskable canvas must be opaque');
        if(Math.hypot(x-info.width/2,y-info.height/2)>info.width*.4+1)
          assert.deepEqual([...data.subarray(i,i+3)],[20,20,17],'Artwork outside maskable safe zone');
      }
    }
  }
}
for (const match of html.matchAll(/href="([^"]+\.png(?:\?[^"]*)?)"/g)) await readFile(`public${match[1].split('?')[0]}`);
console.log(`PWA identity, zoom, manifest references and ${checked} PNG signatures/full decodes/dimensions verified.`);
