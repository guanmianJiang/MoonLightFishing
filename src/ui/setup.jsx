import {For, Show, createSignal} from 'solid-js';
import {render} from 'solid-js/web';
import {SPOTS, BAITS, spotUnlocked} from '../engine.mjs';
import {explorationProgress} from '../progression-guide.mjs';
import {selectedBaitCopy} from './fishing-ui-state.mjs';

const habitat = {
  reed: '入门 · 浅层小鱼',
  bridge: '进阶 · 大型鱼与沉水物',
  deep: '挑战 · 深水与异常目标',
};

function Spot({spot, selection, onSelect}) {
  const active = () => selection().spot === spot.id;
  const unlocked = () => spotUnlocked(selection(), spot.id);
  const detail = () => active()
    ? `当前垂钓 · ${habitat[spot.id]}`
    : unlocked()
      ? `已开放 · ${habitat[spot.id]}`
      : `探索 ${selection().exploration}/${spot.unlock} 解锁`;
  const style = {'--spot-x': `${spot.x}%`, top: `${spot.y}%`};
  const content = () => <>
    <span class="spot-order" aria-hidden="true">≈</span>
    <span class="spot-copy"><strong>{spot.name}</strong><small>{detail()}</small></span>
  </>;
  return <Show when={active()} fallback={
    <button type="button" classList={{spot: true, waiting: selection().pending, locked: !unlocked()}}
      style={style} data-spot={spot.id} disabled={selection().pending}
      aria-label={`选择钓点：${spot.name}，${unlocked() ? '已开放' : `需要探索进度 ${spot.unlock}`}`}
      onClick={() => onSelect(spot.id)}>{content()}</button>
  }>
    <span class="spot active" style={style} data-spot={spot.id}
      aria-label={`当前钓点：${spot.name}`}>{content()}</span>
  </Show>;
}

function Bait({bait, selection, onSelect}) {
  return <button type="button" class={`bait bait-${bait.id}`}
    data-bait={bait.id}
    classList={{selected: selection().bait === bait.id}}
    disabled={selection().pending}
    aria-label={`选择${bait.name}，${bait.desc}`}
    aria-pressed={selection().bait === bait.id} title={bait.effect}
    onClick={() => onSelect(bait.id)}>
    <span class="symbol"><img src={`./assets/models/fishing-details/bait_${bait.id}.png?v=art4`}
      alt="" width="44" height="44" /></span>
    <span class="bait-copy"><strong>{bait.name}</strong><small>{bait.desc}</small></span>
  </button>;
}

export function mountSetupUI(spotsRoot, baitsRoot, onSpot, onBait) {
  const [selection, setSelection] = createSignal({spot: '', bait: '', pending: false, knowledge: 0, exploration: 0});
  const disposeSpots = render(() => <For each={SPOTS}>{spot =>
    <Spot spot={spot} selection={selection} onSelect={onSpot} />
  }</For>, spotsRoot);
  const disposeBaits = render(() => <For each={BAITS}>{bait =>
    <Bait bait={bait} selection={selection} onSelect={onBait} />
  }</For>, baitsRoot);
  return {
    update(state) {
      const next = {spot: state.spot, bait: state.bait, pending: !!state.pending, knowledge: state.knowledge, exploration: explorationProgress(state), log: state.log};
      const previous = selection();
      if (Object.keys(next).some(key => next[key] !== previous[key])) setSelection(next);
      const copy = selectedBaitCopy(state.bait);
      document.getElementById('baitHintName').textContent = copy.name;
      document.getElementById('baitHintEffect').textContent = copy.effect;
    },
    dispose() { disposeSpots(); disposeBaits(); },
  };
}
