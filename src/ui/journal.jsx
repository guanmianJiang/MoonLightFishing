import {For, createSignal} from 'solid-js';
import {render} from 'solid-js/web';
import {uiIcon} from './icons.mjs';
import {validJournalPage} from './journal-achievements.mjs';

const pages = {
  water: ['手记', '我的水域手记', '回看相遇，带着一条线索再抛一竿。'],
  atlas: ['图鉴', '相遇图鉴', '已遇见的鱼与水底拾获，都有一页可回看的记录。'],
  collection: ['收藏', '个人收藏', '给少数值得记住的相遇留个位置。'],
  clues: ['技巧', '鱼口与搏鱼手记', '回看鱼的习性，找到下一次更从容的操作。'],
  gear: ['钓组', '我的钓组', '在熟悉水域的过程中慢慢调整装备。'],
  basket: ['鱼篓', '今日鱼篓', '将值得留下的鱼带回岸边。'],
  shop: ['商店', '海边鱼市', '用这一竿的收获准备下一竿。'],
};

export function mountJournalUI(headingRoot, tabsRoot, onTab) {
  const [active, setActive] = createSignal('water');
  const [counts,setCounts]=createSignal({});
  const primary=['water','atlas','collection'],secondary=['clues','gear','basket','shop'];
  const countLabel=id=>id==='water'?`${counts().placesOpen??1} 处开放`:id==='atlas'?`${counts().fishKnown??0} 种相遇`:`${counts().collection??0} 个样本`;
  const disposeHeading = render(() => <>
    <span class="eyebrow">月隐湾 · 手记</span>
    <h2 id="bookTitle">{pages[active()][1]}</h2>
    <p id="bookSubtitle">{pages[active()][2]}</p>
  </>, headingRoot);
  const tabButton=id=><button type="button" data-tab={id} classList={{active: active() === id}}
      aria-current={active() === id ? 'page' : undefined} aria-pressed={active() === id}
      onClick={() => { if (active() !== id) onTab(id); }}><span class="tab-icon" innerHTML={uiIcon(id==='atlas'?'release':id)} /><span>{pages[id][0]}<small>{primary.includes(id)?countLabel(id):''}</small></span></button>;
  const disposeTabs = render(() => <><div class="journal-primary-tabs"><For each={primary}>{tabButton}</For></div>
    <details class="journal-secondary-nav" open={secondary.includes(active())}><summary>{secondary.includes(active())?pages[active()][1]:'技巧与工具'}<span>更多入口</span></summary><div><For each={secondary}>{tabButton}</For></div></details></>, tabsRoot);
  return {
    update(id,summary={}){setActive(validJournalPage(id)?id:'water');setCounts(summary);},
    dispose() { disposeHeading(); disposeTabs(); },
  };
}
