import {For, Show, createSignal} from 'solid-js';
import {render} from 'solid-js/web';
import {SPOTS, BAITS, spotUnlocked} from '../engine.mjs';
import {selectedBaitCopy} from './fishing-ui-state.mjs';
import {spotMarkerView} from '../spot-chronicle.mjs';

function Spot({spot, selection, onSelect}) {
  const active = () => selection().spot === spot.id;
  const unlocked = () => spotUnlocked(selection(), spot.id);
  const marker = () => spotMarkerView(selection(), spot.id, unlocked());
  const style = {'--spot-x': `${spot.x}%`, top: `${spot.y}%`};
  const content = () => <>
    <span class="spot-order" aria-hidden="true">{marker().glyph}</span>
    <span class="spot-copy"><span class="spot-head"><strong>{spot.name}</strong><em class="spot-status">{active() ? '当前' : marker().status}</em></span><small>{active() ? `${marker().shortStatus} · ${marker().hint}` : unlocked() ? marker().hint : marker().detail}</small></span>
  </>;
  return <Show when={active()} fallback={
    <button type="button" classList={{spot: true, waiting: selection().pending, locked: !unlocked()}}
      style={style} data-spot={spot.id} data-state={marker().state} disabled={selection().pending}
      aria-label={`选择钓点：${marker().aria}`}
      onClick={() => onSelect(spot.id)}>{content()}</button>
  }>
    <span class="spot active" style={style} data-spot={spot.id} data-state={marker().state}
      aria-label={`当前钓点：${marker().aria}`}>{content()}</span>
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
  const [selection, setSelection] = createSignal({spot: '', bait: '', pending: false, knowledge: 0, casts: 0, waterChronicle: null});
  const disposeSpots = render(() => <For each={SPOTS}>{spot =>
    <Spot spot={spot} selection={selection} onSelect={onSpot} />
  }</For>, spotsRoot);
  const disposeBaits = render(() => <For each={BAITS}>{bait =>
    <Bait bait={bait} selection={selection} onSelect={onBait} />
  }</For>, baitsRoot);
  return {
    update(state) {
      const next = {spot: state.spot, bait: state.bait, pending: !!state.pending, knowledge: state.knowledge, log: state.log, casts: state.casts, waterChronicle: state.waterChronicle};
      const previous = selection();
      if (Object.keys(next).some(key => next[key] !== previous[key])) setSelection(next);
      const copy = selectedBaitCopy(state.bait);
      document.getElementById('baitHintName').textContent = copy.name;
      document.getElementById('baitHintEffect').textContent = copy.effect;
    },
    dispose() { disposeSpots(); disposeBaits(); },
  };
}
