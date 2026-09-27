const count=(items,pattern)=>items.filter(text=>pattern.test(text)).length;

export function tripStory(trip){
  const changes=Array.isArray(trip?.changes)?trip.changes.filter(x=>typeof x==='string'):[];
  const casts=changes.filter(x=>!x.startsWith('本轮目标')&&!x.startsWith('水域事件')&&!x.startsWith('生态变化'));
  const released=count(casts,/^已放回.+。/),recorded=count(casts,/^已记录/),kept=count(casts,/^已收藏/),basket=count(casts,/^已把.+放入鱼篓/);
  const empty=count(casts,/空钩/);
  const releaseName=casts.find(x=>/^已放回/.test(x))?.match(/^已放回(.+?)。/)?.[1];
  const recordName=casts.find(x=>/^已记录/.test(x))?.match(/^已记录(.+?)，/)?.[1];
  const moments=[released&&(releaseName?`${releaseName}${released>1?'一次次':''}游回水里`:`${released} 尾鱼游回水里`),recorded&&(recordName?`${recordName}的模样留在了手记里`:`留下了 ${recorded} 份观察记录`),kept&&`${kept} 件水边发现被收入收藏`,basket&&`${basket} 尾鱼带回了鱼篓`].filter(Boolean);
  const lead=moments.length?`${moments.join('，')}。这一轮的海湾，有了新的回声。`:
    empty?`这一轮水面很安静，${empty} 竿空钩也留下了等待的线索。`:'这一轮的水面，又留下了新的线索。';
  const notes=[];
  const goal=trip?.goal;
  if(goal){
    notes.push({kind:'goal',label:'本轮目标',title:goal.complete?'这次约定，做到了':'这次约定，留待下一轮',body:goal.complete?
      `${goal.name} · ${goal.progress}/${goal.target}。调查进度 +${goal.reward}。`:
      `${goal.name} · ${goal.progress}/${goal.target}。下轮可以接着尝试。`});
  }
  const rule=trip?.rule;
  if(rule?.triggers>0)notes.push({kind:'event',label:'水域回响',title:`${rule.name}有了回应`,body:`本轮触发 ${rule.triggers} 次，水里的变化已记进手记。`});
  const ecology=changes.filter(x=>x.startsWith('生态变化：')).map(x=>x.slice(5).replace(/。$/,''));
  if(ecology.length){
    const stable=ecology.every(x=>x.includes('基本稳定'));
    notes.push({kind:'ecology',label:'水下近况',title:stable?'鱼群仍循着熟悉的节奏':'下一轮，水下会有新动静',body:stable?
      '鱼群分布暂时平稳。换个钓点，或许能发现新的踪迹。':ecology.join('；')+'。'});
  }
  return {lead,notes};
}
