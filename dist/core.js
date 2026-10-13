import { PRODUCTS, RECIPES } from './data.js';
import { SHOP_EXTRAS } from './shop-data.js';
export const ALL_PRODUCTS={...PRODUCTS,...SHOP_EXTRAS};
export const PRODUCT_ALIASES={shop_015:'turnip',shop_016:'sweet_potato',shop_024:'green_onion',shop_032:'sorrel',shop_204:'squid',shop_251:'polenta',shop_257:'green_lentils',shop_261:'split_peas',shop_278:'lasagna',shop_317:'brussels',shop_339:'puff_pastry'};
export const canonicalProduct=id=>PRODUCT_ALIASES[id]||id;
export const STORE_KEY = 'freshmarket-beta-v1';
export const byId = Object.fromEntries(RECIPES.map(r => [r.id,r]));
export const defaults = () => ({version:1,portionPolicy:2,store:'fresh',selected:[],favorites:[],disliked:[],skipped:[],cooked:[],pantry:[],manual:{},productFavorites:[],fulfillment:{mode:'delivery',address:''},history:[],profile:{goal:'balance',height:170,weight:70,target:65,age:30,activity:'medium',servings:1,kcal:2000,kcalMode:'auto',sex:'unspecified',vegetarian:false,allergens:[],excluded:'',liked:'',maxTime:60,budget:400,configured:false}});
export function sanitize(raw) {
 const s=defaults(); if(!raw||raw.version!==1)return s;
 s.store=raw.store==='avoska'?'avoska':'fresh';
 if(raw.manual&&typeof raw.manual==='object'&&!Array.isArray(raw.manual))for(const [oldId,n] of Object.entries(raw.manual)){const id=canonicalProduct(oldId);if(ALL_PRODUCTS[id]&&Number.isFinite(+n)&&+n>0)s.manual[id]=Math.max(s.manual[id]||0,Math.min(99,Math.floor(+n)));}
 s.productFavorites=[...new Set((Array.isArray(raw.productFavorites)?raw.productFavorites:[]).map(canonicalProduct).filter(id=>ALL_PRODUCTS[id]))];
 if(raw.fulfillment&&typeof raw.fulfillment==='object'){s.fulfillment.mode=raw.fulfillment.mode==='pickup'?'pickup':'delivery';s.fulfillment.address=typeof raw.fulfillment.address==='string'?raw.fulfillment.address.slice(0,160):'';}

 for(const k of ['favorites','disliked','skipped','cooked']) s[k]=[...new Set((Array.isArray(raw[k])?raw[k]:[]).filter(x=>byId[x]))];
 s.pantry=[...new Set((Array.isArray(raw.pantry)?raw.pantry:[]).filter(x=>PRODUCTS[x]))];
 const seen=new Set(); s.selected=(Array.isArray(raw.selected)?raw.selected:[]).filter(x=>x&&byId[x.id]&&!seen.has(x.id)&&seen.add(x.id)).map(x=>({id:x.id,portions:raw.portionPolicy===2?Math.max(1,Math.min(12,Math.round(Number(x.portions)||1))):1,day:Math.max(0,Math.min(6,Math.round(Number(x.day)||0)))}));
 if(raw.profile&&typeof raw.profile==='object') {const p=raw.profile;
  for(const [k,min,max] of [['height',100,230],['weight',30,250],['target',30,250],['age',18,100],['kcal',1200,4500],['maxTime',10,180],['budget',50,1500]]) if(Number.isFinite(+p[k])) s.profile[k]=Math.max(min,Math.min(max,+p[k]));
  if(['balance','lose','gain','explore'].includes(p.goal))s.profile.goal=p.goal;
  if(['low','medium','high'].includes(p.activity))s.profile.activity=p.activity;
  s.profile.kcalMode=p.kcalMode==='manual'?'manual':'auto';
  if(['male','female'].includes(p.sex))s.profile.sex=p.sex;
  s.profile.vegetarian=!!p.vegetarian;s.profile.configured=!!p.configured;
  s.profile.excluded=typeof p.excluded==='string'?p.excluded.slice(0,300):'';
  s.profile.liked=typeof p.liked==='string'?p.liked.slice(0,300):'';
  s.profile.servings=1;
  const known=['молоко','яйца','глютен','рыба','орехи','соя','кунжут','морепродукты'];s.profile.allergens=Array.isArray(p.allergens)?p.allergens.filter(a=>known.includes(a)):[];
 }
 s.history=(Array.isArray(raw.history)?raw.history:[]).filter(x=>x&&typeof x.id==='string'&&Number.isFinite(x.total)&&Number.isFinite(x.count)).slice(0,20);
 s.profile.kcal=calorieEstimate(s.profile).target;
 return s;
}
export function nutrition(r) {return r.ingredients.reduce((v,i)=>v.map((n,k)=>n+(PRODUCTS[i.id].macros[k]||0)*i.amount/100),[0,0,0,0]).map(Math.round);}
// Mifflin–St Jeor estimates resting energy. Activity and goal adjustments
// provide an approximate adult planning target, not a clinical prescription.
export function calorieEstimate(p){
 const round=n=>Math.round(n/50)*50;
 if(p.kcalMode==='manual')return {target:Math.max(1200,Math.min(4500,Number(p.kcal)||2000)),mode:'manual',personalized:false,adjustment:0,maintenance:null};
 const personalized=['male','female'].includes(p.sex)&&[p.weight,p.height,p.age].every(n=>Number.isFinite(+n)&&+n>0);
 const bmr=personalized?10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:-161):null;
 const maintenance=personalized?round(bmr*({low:1.2,medium:1.375,high:1.55}[p.activity]||1.375)):2000;
 const underweight=personalized&&p.weight/(p.height/100)**2<18.5;
 const adjustment=p.goal==='gain'?300:p.goal==='lose'&&!underweight?-300:0;
 const floor=p.sex==='male'?1500:1200;
 const target=Math.max(floor,Math.min(4500,round(maintenance+adjustment)));
 return {target,maintenance,adjustment,mode:'auto',personalized,underweight,limited:target!==round(maintenance+adjustment)};
}
export function productPrice(p,store='fresh'){return Math.round(p.price*(store==='avoska'?0.91:1));}
export function recipeCost(r,store='fresh'){return Math.round(r.ingredients.reduce((n,i)=>n+i.amount/PRODUCTS[i.id].pack*productPrice(PRODUCTS[i.id],store),0));}
export function allergens(r){return [...new Set(r.ingredients.flatMap(i=>PRODUCTS[i.id].allergens||[]))];}
const normalize=value=>String(value||'').toLowerCase().replace(/ё/g,'е').trim();
export const tasteTerms=value=>[...new Set(normalize(value).split(/[,;\n]/).map(x=>x.trim()).filter(Boolean))];
const foodGroups=[
 {terms:['курица','курицу','курятина'],match:/кури/},
 {terms:['индейка','индейку'],match:/инде/},
 {terms:['говядина','говядину'],match:/говя/},
 {terms:['свинина','свинину'],match:/свин/},
 {terms:['мясо'],match:/кури|инде|говя|свин|барани|кролик|мяс/},
 {terms:['рыба','рыбу'],match:/лосос|треск|минта|форел|тунец|тунц|сельд|скумбри|горбуш|судак|рыб/},
 {terms:['грибы','гриб'],match:/гриб|шампиньон|вешенк|опят/},
 {terms:['орехи','орех'],match:/орех|миндал|арахис|фундук|кешью|фисташ/},
 {terms:['помидоры','помидор','томаты','томат'],match:/помидор|томат/},
 {terms:['гречка','гречку'],match:/греч/},
 {terms:['овсянка','овсянку'],match:/овсян/},
 {terms:['творог'],match:/творо/},
 {terms:['яйцо','яйца'],match:/яйц|яич/},
 {terms:['морепродукты'],match:/кревет|кальмар|миди|осьминог|морепродукт/},
 {terms:['лук'],match:/лук/},
 {terms:['кинза','кинзу'],match:/кинз|кориандр|зелень свеж/},
 {terms:['молочные продукты','молочка'],match:/молоко 2|йогурт|творог|сметан|сливки|сыр|моцарел|масло слив|кефир/},
 {terms:['сыр'],match:/сыр|моцарел/},
 {terms:['ягоды'],match:/ягод|клубник|черник|вишн|малин|смородин/},
 {terms:['капуста','капусту'],match:/капуст|брокколи/}
];
export function productMatches(p,term){const name=normalize(p.name),word=normalize(term);if(!word)return false;const group=foodGroups.find(g=>g.terms.includes(word));return group?group.match.test(name):name.includes(word);}
export function eligible(r,p) {
 if(p.vegetarian&&r.ingredients.some(i=>!PRODUCTS[i.id].vegetarian))return false;
 if(allergens(r).some(a=>p.allergens.includes(a)))return false;
 const blocked=tasteTerms(p.excluded);
 return !r.ingredients.some(i=>blocked.some(b=>productMatches(PRODUCTS[i.id],b)));
}
export function basket(s){
 const map={};
 const ensure=id=>map[id]||(map[id]={id,...ALL_PRODUCTS[id],amount:0,recipes:[]});
 for(const item of s.selected){const r=byId[item.id];if(!r)continue;for(const i of r.ingredients){const row=ensure(i.id);row.amount+=i.amount*item.portions;if(!row.recipes.includes(r.id))row.recipes.push(r.id);}}
 for(const [id,count] of Object.entries(s.manual||{}))if(ALL_PRODUCTS[id]&&count>0)ensure(id);
 return Object.values(map).map(i=>{
  const amount=Math.round(i.amount*100)/100;
  const homeAvailable=s.pantry.includes(i.id);
  const recipePacks=homeAvailable?0:Math.ceil((amount-1e-8)/i.pack);
  const manualPacks=s.manual?.[i.id]||0;
  // A manually selected package can fulfil the same recipe need. Do not double it.
  const packs=Math.max(recipePacks,manualPacks);
  const atHome=homeAvailable&&packs===0;
  const price=productPrice(i,s.store);
  return {...i,amount,homeAvailable,atHome,recipePacks,manualPacks,packs,price,total:packs*price,leftover:Math.max(0,Math.round((packs*i.pack-(homeAvailable?0:amount))*100)/100)};
 }).sort((a,b)=>a.atHome-b.atHome||a.aisle.localeCompare(b.aisle,'ru')||a.name.localeCompare(b.name,'ru'));
}
export function setProductCount(s,id,count){
 id=canonicalProduct(id);
 if(!ALL_PRODUCTS[id]||!Number.isFinite(+count))return false;
 if(!s.manual)s.manual={};
 const value=Math.max(0,Math.min(99,Math.floor(+count)));
 if(value)s.manual[id]=value;else delete s.manual[id];
 return true;
}
export function productAllowed(p,profile){
 if(profile.vegetarian&&!p.vegetarian)return false;
 if((p.allergens||[]).some(a=>profile.allergens.includes(a)))return false;
 return !tasteTerms(profile.excluded).some(word=>productMatches(p,word));
}
export function addRecipe(s,id,day=0){if(!byId[id]||s.selected.some(r=>r.id===id))return false;s.selected.push({id,portions:1,day});s.skipped=s.skipped.filter(x=>x!==id);return true;}
export function removeRecipe(s,id){s.selected=s.selected.filter(x=>x.id!==id);}
function tasteContext(s){return {liked:s.favorites.map(id=>byId[id]).filter(Boolean),disliked:(s.disliked||[]).map(id=>byId[id]).filter(Boolean),terms:tasteTerms(s.profile.liked)};}
export function recommendationScore(r,s,seed='',taste=tasteContext(s)){
 const n=nutrition(r),cost=recipeCost(r,s.store);
 let score=0;if(r.time<=s.profile.maxTime)score+=15;if(cost<=s.profile.budget)score+=12;
 if(s.profile.goal==='gain')score+=Math.min(25,n[1]*.55)+Math.min(10,n[0]/75);
 if(s.profile.goal==='lose')score+=Math.max(0,18-Math.abs(n[0]-420)/35)+Math.min(10,n[1]*.3);
 if(s.profile.goal==='balance')score+=Math.max(0,12-Math.abs(n[0]-500)/60);
 score+=Math.min(36,taste.terms.filter(t=>r.ingredients.some(i=>productMatches(PRODUCTS[i.id],t))).length*18);
 score+=Math.min(18,taste.liked.filter(x=>x.family===r.family).length*6);
 // Learn shared central ingredients, not ubiquitous salt, sugar or cooking oil.
 const main=r.ingredients.filter(i=>i.amount>=35).map(i=>i.id);
 score+=Math.min(12,taste.liked.reduce((n,x)=>n+x.ingredients.filter(i=>i.amount>=35&&main.includes(i.id)).length,0)*1.5);
 score-=Math.min(14,taste.disliked.filter(x=>x.family===r.family).length*4);
 if(s.cooked.includes(r.id))score-=8;
 let hash=0;for(const c of (r.id+seed))hash=(hash*31+c.charCodeAt(0))|0;
 return score+Math.abs(hash%1300)/100;
}
export function recommendationReason(r,s){
 if(tasteTerms(s.profile.liked).some(t=>r.ingredients.some(i=>productMatches(PRODUCTS[i.id],t))))return 'С вашими любимыми продуктами';
 if(s.favorites.some(id=>byId[id]?.family===r.family))return 'Похоже на ваши любимые блюда';
 if(r.time<=20)return 'Быстро и под ваш вкус';
 return s.profile.configured?'С учётом вашего вкуса':'Идея для вашего дня';
}
export function recommendations(s,{category='all',quick=false,cheap=false,search='',excludeSelected=true,excludeSkipped=true,seed=''}={}){
 const taste=tasteContext(s);
 return RECIPES.filter(r=>eligible(r,s.profile)&&!(s.disliked||[]).includes(r.id)&&(category==='all'||r.category===category)&&(!quick||r.time<=20)&&(!cheap||recipeCost(r,s.store)<=150)&&(!excludeSelected||!s.selected.some(x=>x.id===r.id))&&(!excludeSkipped||!s.skipped.includes(r.id))&&(!search||[r.title,...r.tags,...r.ingredients.map(i=>PRODUCTS[i.id].name)].join(' ').toLowerCase().includes(search.toLowerCase()))).map(r=>({r,score:recommendationScore(r,s,seed,taste)})).sort((a,b)=>b.score-a.score).map(x=>x.r);
}
export function planDay(s,day=0,seed=''){
 let added=0;
 const families=new Set(s.selected.filter(x=>x.day===day).map(x=>byId[x.id].family));
 for(const category of ['breakfast','lunch','dinner']){
  if(s.selected.some(x=>x.day===day&&byId[x.id].category===category))continue;
  const pool=recommendations(s,{category,seed:seed+day});
  const r=pool.find(x=>!families.has(x.family))||pool[0];
  if(r&&addRecipe(s,r.id,day)){added++;families.add(r.family);}
 }
 return {added};
}
