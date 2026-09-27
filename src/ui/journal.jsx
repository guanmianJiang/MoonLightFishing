import {For, createSignal} from 'solid-js';
import {render} from 'solid-js/web';

const pages = {
  basket: ['鱼篓', '今日鱼篓', '将值得留下的鱼带回岸边。'],
  shop: ['商店', '海边鱼市', '用这一竿的收获准备下一竿。'],
  collection: ['收藏', '个人收藏', '给少数值得记住的相遇留个位置。'],
  water: ['水域', '水域手记', '读懂天气、位置与鱼群留下的线索。'],
  gear: ['钓组', '我的钓组', '在熟悉水域的过程中慢慢调整装备。'],
  clues: ['鱼口', '鱼口记录', '回看水面曾给出的每一次暗示。'],
};

export function mountJournalUI(headingRoot, tabsRoot, onTab) {
  const [active, setActive] = createSignal('basket');
  const disposeHeading = render(() => <>
    <span class="eyebrow">月隐湾 · 手记</span>
    <h2 id="bookTitle">{pages[active()][1]}</h2>
    <p id="bookSubtitle">{pages[active()][2]}</p>
  </>, headingRoot);
  const disposeTabs = render(() => <For each={Object.entries(pages)}>{([id, page]) =>
    <button type="button" data-tab={id} classList={{active: active() === id}}
      aria-current={active() === id ? 'page' : undefined}
      onClick={() => { if (active() !== id) onTab(id); }}>{page[0]}</button>
  }</For>, tabsRoot);
  return {
    update: setActive,
    dispose() { disposeHeading(); disposeTabs(); },
  };
}
