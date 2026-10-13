import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,sanitize,addRecipe,setProductCount,basket} from '../dist/core.js';
import {RECIPES} from '../dist/data.js';

test('unknown inherited object keys cannot become saved products or recipes',()=>{
  const ids=['constructor','__proto__','toString',['r001'],['shop_015']];
  const saved=sanitize({version:1,portionPolicy:2,
    selected:ids.map(id=>({id,portions:1,day:0})),favorites:ids,pantry:ids,
    manual:JSON.parse('{"constructor":2,"__proto__":3,"toString":1}'),productFavorites:ids});
  assert.deepEqual(saved.selected,[]);
  assert.deepEqual(saved.favorites,[]);
  assert.deepEqual(saved.pantry,[]);
  assert.deepEqual(saved.productFavorites,[]);
  assert.deepEqual(saved.manual,{});
  assert.deepEqual(basket(saved),[]);
  for(const id of ids){assert.equal(setProductCount(saved,id,1),false);assert.equal(addRecipe(saved,id),false);}
});

test('adding a recipe always respects current ingredient exclusions',()=>{
  const s=defaults(),r=RECIPES.find(x=>x.ingredients.some(i=>i.id==='salmon'));
  s.profile.excluded='рыба';
  assert.equal(addRecipe(s,r.id),false);
  assert.deepEqual(s.selected,[]);
});
