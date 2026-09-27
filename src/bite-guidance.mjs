const guidance={
 dart:{seen:'浮漂连点，鱼影追着饵转',action:'轻提鱼饵',why:'吊住它的胃口，等咬实再提竿',tactic:'tease'},
 peck:{seen:'漂尖轻点，饵边冒出细泡',action:'轻提鱼饵',why:'小鱼在试探，轻提一次就够',tactic:'tease'},
 deep:{seen:'鱼线忽然松了，正往远处走',action:'收紧半圈',why:'先收住松线，盯下一次拉力',tactic:'shorten'},
 broad:{seen:'鱼影绕饵打转，浮漂还没沉',action:'稳住不动',why:'它还在试探，别惊走它',tactic:'wait'},
 steady:{seen:'浮漂横移一下，又停住了',action:'稳住不动',why:'还没咬牢，等它自己拉沉浮漂',tactic:'wait'}
};
export function biteGuidance(signalId){return guidance[signalId]||guidance.steady}
export const BITE_READ_MS=6500;
export function biteReadRemaining(p,now=Date.now()){
 return Math.max(0,BITE_READ_MS-(now-(p?.decisionAt||now)));
}
