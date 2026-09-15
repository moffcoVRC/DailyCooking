export const KEY='mainichi-dinner-v1';
export function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function addDay(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return dateKey(d);}
export function monday(key){const d=new Date(key+'T12:00:00');return addDay(key,-((d.getDay()+6)%7));}
export const FIXED_NG=['辛い物','ピーマン','レンコン','ししゃも','苦い物'];
export function initialState(){return {version:1,plannerVersion:3,plans:{},checks:{},history:{},family:['自分','娘','孫'].map((name,i)=>({id:String(i),name,ng:[],dislike:[]}))};}
const normalize=t=>String(t).trim().replace(/辛い(?:物|もの)/g,'辛い').replace(/苦い(?:物|もの)/g,'苦い').replace(/れんこん|蓮根/g,'レンコン').replace(/シシャモ/g,'ししゃも');
export function matches(menu,tag){const t=normalize(tag);if(!t)return false;const values=[...menu.tags,...menu.ingredients.map(i=>i.name),...menu.seasonings].map(normalize);if(t==='辛い')return values.some(v=>/辛い|唐辛子|豆板醤|ラー油|カレー粉|キムチ|わさび|からし/.test(v));if(t==='苦い')return values.some(v=>/苦い|ゴーヤ|にがうり|苦瓜|春菊|菜の花|ふきのとう/.test(v));return values.some(v=>v.includes(t));}
export function migrateState(s){if(s.plannerVersion!==3){s.plans={};s.checks={};delete s.excluded;s.plannerVersion=3;}return s;}
function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function mainIngredient(menu){
  // Meat/fish present in the meal takes precedence over accompanying eggs or tofu.
  const tags=menu.tags;
  for(const [tag,group] of [['牛肉','beef'],['豚肉','pork'],['鶏肉','chicken'],['魚','fish']])if(tags.includes(tag))return group;
  if(menu.ingredients.some(i=>/豆腐|厚揚げ|油揚げ/.test(i.name)))return 'tofu';
  if(tags.includes('卵'))return 'egg';
  return 'vegetable';
}
const mod=(n,d)=>((n%d)+d)%d;
export function ensurePlan(s,date,menus){
  migrateState(s);
  const start=monday(date),ng=[...FIXED_NG,...s.family.flatMap(f=>f.ng)];
  const pool=menus.filter(m=>!ng.some(t=>matches(m,t))).filter((m,i,a)=>a.findIndex(x=>x.id===m.id||x.name===m.name)===i);
  pool.sort((a,b)=>hash(a.id+'dinner-v3')-hash(b.id+'dinner-v3')||a.id.localeCompare(b.id));
  const groups={};for(const m of pool)(groups[mainIngredient(m)]??=[]).push(m);
  // Two weeks: beef once, with distinct categories across Sunday/Monday as well.
  const template=['pork','fish','chicken','tofu','pork','fish','egg','chicken','pork','fish','tofu','beef','chicken','egg'];
  if(groups.vegetable)template.splice(10,0,'vegetable');
  const cycle=template.filter(g=>groups[g]).filter((g,i,a)=>i===0||g!==a[i-1]);
  if(cycle.length>1&&cycle[0]===cycle.at(-1))cycle.pop();
  const used=new Set();
  const first=Math.round((Date.parse(start+'T12:00:00Z')-Date.parse('2026-09-14T12:00:00Z'))/86400000);
  for(let i=0;i<7;i++){
    const d=addDay(start,i),day=first+i,pos=cycle.length?mod(day,cycle.length):0,group=cycle[pos];
    let m;
    if(group){
      const list=groups[group],perCycle=cycle.filter(g=>g===group).length;
      const occurrence=Math.floor(day/cycle.length)*perCycle+cycle.slice(0,pos).filter(g=>g===group).length;
      const offset=mod(occurrence,list.length);
      // Never reuse a recipe within the week, even if filters leave too few dishes.
      m=Array.from({length:list.length},(_,j)=>list[(offset+j)%list.length]).find(x=>!used.has(x.id));
      if(m)used.add(m.id);
    }
    const next=m?{status:'planned',menuId:m.id}:{status:'empty'};
    if(s.plans[d]?.menuId!==next.menuId||s.plans[d]?.status!==next.status)delete s.checks[d];
    s.plans[d]=next;
  }
  return s.plans[date];
}
export function eat(s,date,rating=null){const p=s.plans[date];if(p?.status!=='planned')throw Error('この日は食事を記録できません。');if(s.history[date]&&s.history[date].menuId!==p.menuId)throw Error('この日には別の料理の食事記録があります。先に記録を取り消してください。');if(date>dateKey())throw Error('未来の日の食事は記録できません。');if(![null,'like','neutral','dislike'].includes(rating))throw Error('評価が不正です。');s.history[date]={menuId:p.menuId,rating,by:'family'};}
export function lastEaten(s,id){return Object.keys(s.history).filter(d=>s.history[d].menuId===id).sort().at(-1);}
export function favoriteIds(s){const latest={};Object.keys(s.history).sort().forEach(d=>{const h=s.history[d];if(h.rating!==null)latest[h.menuId]=h.rating;});return Object.keys(latest).filter(id=>latest[id]==='like');}
