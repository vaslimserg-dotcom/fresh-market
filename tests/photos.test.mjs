import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RECIPES} from '../dist/data.js';
import {recipePhoto,recipePhotoCredit,RECIPE_PHOTO_COUNT} from '../dist/recipe-photos.js';

test('every recipe has a distinct, compact local photograph with source and license',()=>{
  const paths=new Set(),sources=new Set(),hashes=new Set();
  const credits=JSON.parse(readFileSync(new URL('../dist/assets/credits.json',import.meta.url)));
  assert.equal(RECIPE_PHOTO_COUNT,RECIPES.length);
  for(const r of RECIPES){
    const path=recipePhoto(r),credit=recipePhotoCredit(r);
    assert.match(path,/^assets\/[a-z0-9-]+\.jpg$/,r.title);
    assert.ok(!paths.has(path),`${r.id}: repeated photograph path`);paths.add(path);
    const bytes=readFileSync(new URL('../dist/'+path,import.meta.url));
    assert.ok(bytes.length>1000&&bytes.length<=200000,`${r.id}: photo file size`);
    assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
    const digest=createHash('sha256').update(bytes).digest('hex');
    assert.ok(!hashes.has(digest),`${r.id}: duplicate photograph content`);hashes.add(digest);
    assert.ok(credit?.author&&credit.license,`${r.id}: missing author or license`);
    assert.match(credit.sourceUrl,/^https:\/\//);assert.match(credit.licenseUrl,/^https?:\/\//);
    assert.ok(!sources.has(credit.sourceUrl),`${r.id}: reused source`);sources.add(credit.sourceUrl);
    assert.equal(credits.recipe_photo_assignments[r.id],path);
    assert.ok(credits.images.some(image=>image.filename===path.split('/').pop()),`${r.id}: missing source record`);
  }
  assert.equal(hashes.size,RECIPES.length);
});
