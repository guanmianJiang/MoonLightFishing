const guidance={
 dart:{seen:'鱼影追着饵转，旁边泛起细纹',action:'轻提鱼饵',why:'吊住它的胃口，等咬实再提竿',tactic:'tease'},
 peck:{seen:'饵边冒出细泡，小鱼正在试探',action:'轻提鱼饵',why:'小鱼在试探，轻提一次就够',tactic:'tease'},
 deep:{seen:'鱼影从深处向饵游来',action:'收紧半圈',why:'先收住松线，盯下一次拉力',tactic:'shorten'},
 broad:{seen:'鱼影绕饵打转，浮漂还没沉',action:'稳住不动',why:'它还在试探，别惊走它',tactic:'wait'},
 steady:{seen:'饵旁水纹一闪，又安静了',action:'稳住不动',why:'还没咬牢，等它自己拉沉浮漂',tactic:'wait'}
};
export function biteGuidance(signalId){return guidance[signalId]||guidance.steady}
export const BITE_READ_MS=6500;
export function biteReadRemaining(p,now=Date.now()){
 return Math.max(0,BITE_READ_MS-(now-(p?.decisionAt||now)));
}
