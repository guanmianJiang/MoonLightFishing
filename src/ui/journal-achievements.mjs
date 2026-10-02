import {FISH,SPOTS} from '../data/catalog.mjs';
import {spotUnlocked} from '../engine.mjs';
import {normalizeWaterChronicle,spotChronicleView} from '../spot-chronicle.mjs';
import {discoveryJournal} from '../discovery-notes.mjs';
import {uiIcon} from './icons.mjs';
import {migrateFightRecords} from '../fish-behavior.mjs';

const list=value=>Array.isArray(value)?value:[];
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const journalPageIds=['water','atlas','collection','clues','gear','basket','shop'];
export const validJournalPage=id=>journalPageIds.includes(id);

export function journalAchievements(save={}){
 save=save&&typeof save==='object'?save:{};
 const chronicle=normalizeWaterChronicle(save.waterChronicle),log=list(save.log);
 const settled=Object.values(chronicle.spots).flatMap(spot=>spot.recent.filter(item=>['landed','object'].includes(item.kind)).map(item=>({id:item.fishId,spot:item.spot})));
 const entries=[...log,...list(save.collection),...list(save.tracked),...settled];
 const fightRecords=migrateFightRecords(save.fightRecords);
 const records=FISH.map(fish=>{
  const matches=entries.filter(item=>item?.id===fish.id),places=SPOTS.filter(spot=>matches.some(item=>item.spot===spot.id)||chronicle.spots[spot.id].fish[fish.id]>0);
  const report=fightRecords[fish.id];
  const known=matches.length>0||places.length>0||(!fish.object&&!!report&&typeof report==='object');
  const weights=matches.map(item=>item.weight).filter(value=>Number.isFinite(value)&&value>0);
  return {id:fish.id,name:fish.name,object:!!fish.object,known,bestWeight:weights.length?Math.max(...weights):null,places:places.map(spot=>spot.name),grade:typeof report?.grade==='string'?report.grade:null};
 });
 const live=records.filter(item=>!item.object),objects=records.filter(item=>item.object),notes=discoveryJournal(save);
 const current=SPOTS.find(spot=>spot.id===save.spot&&spotUnlocked(save,spot.id))||SPOTS[0];
 return {records,fishKnown:live.filter(item=>item.known).length,fishTotal:live.length,objectsKnown:objects.filter(item=>item.known).length,
  supported:notes.filter(note=>note.state==='supported').length,observations:notes.length,placesOpen:SPOTS.filter(spot=>spotUnlocked(save,spot.id)).length,
  collection:list(save.collection).length,latest:log.filter(item=>FISH.some(fish=>fish.id===item?.id)).slice(0,3),next:spotChronicleView(save,current.id),busy:!!save.pending};
}

function image(id,thumb){const url=thumb?.(id);return typeof url==='string'&&/^(?:\.\/|\/|assets\/|data:image\/(?:png|webp|jpeg);base64,)/.test(url)?`<img src="${escape(url)}" alt="" loading="lazy">`:uiIcon('release');}

export function renderJournalOverview(save,thumb){
 const a=journalAchievements(save),next=a.next;
 const recent=a.latest.map(item=>{const fish=FISH.find(fish=>fish.id===item.id),spot=SPOTS.find(spot=>spot.id===item.spot);return `<article class="journal-recent-item">${image(item.id,thumb)}<div><strong>${escape(fish.name)}</strong><small>${escape(spot?.name||'地点未记下')}${Number.isFinite(item.weight)&&item.weight>0?' · '+item.weight.toFixed(3)+' kg':''}</small></div></article>`;}).join('');
 return `<section class="journal-overview"><div class="journal-section-head"><span>你的月隐湾</span><h3>每一次相遇，都留下了一点线索</h3></div><div class="journal-achievements"><button type="button" data-book-page="atlas"><strong>${a.fishKnown}<small> / ${a.fishTotal}</small></strong><span>已遇鱼种</span></button><button type="button" data-book-page="water" data-journal-details><strong>${a.placesOpen}<small> / ${SPOTS.length}</small></strong><span>开放水域</span></button><button type="button" data-book-page="water" data-journal-details><strong>${a.supported}</strong><span>观察获支持</span></button></div><p class="journal-evidence-note">从已保存的相遇与水域履历回看；旧记录可能不完整。</p><section class="journal-next"><span>下一竿可以试</span><h3>${escape(next.name)}</h3><p>${escape(next.next)}</p>${a.busy?'<small>这一竿结束后，再来选下一处落点。</small>':`<button type="button" class="journal-primary" data-prepare-spot="${escape(next.id)}">按这个线索选落点 ${uiIcon('cast')}</button>`}</section><div class="journal-section-head"><h3>最近留下的相遇</h3><button type="button" data-book-page="atlas">看图鉴 ${uiIcon('chevron')}</button></div>${recent?`<div class="journal-recent-list">${recent}</div>`:'<div class="journal-empty"><strong>第一尾，还在水里等你</strong><p>完成一次钓获后，这里会留下相遇；收藏仅为少数样本保留位置。</p></div>'}<button type="button" class="journal-collection-link" data-book-page="collection">个人收藏 · ${a.collection} 个样本 ${uiIcon('chevron')}</button></section>`;
}

export function renderEncounterAtlas(save,thumb){
 const a=journalAchievements(save);
 const group=object=>a.records.filter(record=>record.object===object).map(record=>{
  if(!record.known)return `<article class="atlas-card atlas-unknown"><div class="atlas-visual">${uiIcon('release')}</div><strong>未留记录</strong><small>${object?'水底还有未知的东西':'等一次新的相遇'}</small></article>`;
  const fish=FISH.find(fish=>fish.id===record.id);
  return `<details class="atlas-card"><summary><div class="atlas-visual">${image(record.id,thumb)}</div><span class="atlas-kind">${object?'水底拾获':'已遇见'}</span><strong>${escape(record.name)}</strong><small>${record.bestWeight!==null?record.bestWeight.toFixed(3)+' kg · 留存最大重量':'重量尚未记下'}</small><span class="atlas-expand">展开手记 ${uiIcon('chevron')}</span></summary><div class="atlas-detail"><p>${escape(fish.desc)}</p><p>相遇地点：${escape(record.places.join('、')||'旧记录未记下地点')}</p>${record.grade?`<p>最佳搏鱼评级：${escape(record.grade)}</p>`:''}</div></details>`;
 }).join('');
 return `<section class="encounter-atlas"><div class="journal-section-head"><h3>相遇图鉴</h3><span>${a.fishKnown} / ${a.fishTotal} 鱼种</span></div><p class="journal-evidence-note">图鉴回看已有相遇，不占收藏位。展开已遇条目查看纪录与习性。</p><div class="atlas-grid">${group(false)}</div><div class="journal-section-head"><h3>水底拾获</h3><span>${a.objectsKnown} / ${a.records.filter(item=>item.object).length}</span></div><div class="atlas-grid">${group(true)}</div></section>`;
}
