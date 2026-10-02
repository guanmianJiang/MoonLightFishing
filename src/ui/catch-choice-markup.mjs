import {uiIcon} from './icons.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function catchChoiceMarkup(action,{recommended=false,hint=''}={}){
 const id=action?.id||'study',name=action?.name||'做成记录';
 return `<button type="button" class="${recommended?'process-recommended':'process-option'}" ${recommended?'aria-describedby="resultChoiceTitle resultChoiceHelp" ':''}data-process="${escape(id)}"><span class="process-icon">${uiIcon(id)}</span><span class="process-copy"><strong>${escape(name)}</strong><small>${escape(hint)}</small></span><span class="process-arrow">${uiIcon('chevron')}</span></button>`;
}

export function catchDecisionCopy(goal){
 if(!goal||goal.complete||!Number.isFinite(goal.target)||goal.target<=0)return {title:'如何留下这次钓获？',help:'选择一种方式，留下这次相遇'};
 const progress=Number.isFinite(goal.progress)?Math.max(0,Math.min(goal.target,goal.progress)):0;
 if(progress>=goal.target)return {title:'这次约定已完成',help:'选择一种方式，留下这次相遇'};
 return {title:goal.name||'本轮约定',help:`本轮进度 ${progress} / ${goal.target}`};
}
