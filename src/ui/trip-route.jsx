import {For, createSignal} from 'solid-js';
import {render} from 'solid-js/web';
import {progressionGuide} from '../progression-guide.mjs';
import {nextCastThread} from '../next-cast-thread.mjs';
import {weatherAt} from '../engine.mjs';

export function mountTripRoute(root, onOpen, onGuide) {
  const [trip, setTrip] = createSignal({number: 1, castsLeft: 4, goal: '', progress: 0, target: 1, complete: false});
  const [guide, setGuide] = createSignal(progressionGuide(null));
  const dispose = render(() => <aside class="route-card" classList={{opening:!!guide().opening}} aria-label="垂钓路线与本轮目标">
    <div class="route-card__top"><span>下一步</span><strong>{guide().stage}</strong></div>
    <div class="route-card__goal">{guide().title}</div>
    <p class="route-card__detail">{guide().detail}</p>
    <div class="route-card__progress">
      <span>探索 {guide().progress}/{guide().target}</span>
      <span class="route-card__casts" aria-label={`剩余 ${trip().castsLeft} 竿`}>
        <For each={[0, 1, 2, 3]}>{index => <i classList={{spent: index >= trip().castsLeft}} />}</For>
      </span>
    </div>
    <div class="route-card__difficulty">近水提竿 +2 秒 · 远水大鱼更多</div>
    <button class="route-card__primary" type="button" disabled={trip().pending} onClick={() => onGuide(guide().action)}>{guide().action.label}<span aria-hidden="true">↗</span></button>
    <button class="route-card__journal" type="button" onClick={onOpen}>本轮：{trip().goal} {trip().progress}/{trip().target} <span aria-hidden="true">›</span></button>
  </aside>, root);
  return {
    update(state) {
      const next = {
        number: state.trip.number,
        castsLeft: state.trip.castsLeft,
        goal: state.trip.goal.name,
        progress: state.trip.goal.progress,
        target: state.trip.goal.target,
        complete: !!state.trip.goal.complete,
        pending: !!state.pending,
      };
      const previous = trip();
      if (Object.keys(next).some(key => next[key] !== previous[key])) setTrip(next);
      const route = progressionGuide(state);
      const thread = nextCastThread(state, weatherAt(Date.now()).id);
      const nextGuide = thread ? {...route, stage:'下一竿 · 水域线索', title:thread.title, detail:thread.detail, action:thread.action} : route;
      if (JSON.stringify(nextGuide) !== JSON.stringify(guide())) setGuide(nextGuide);
    },
    dispose,
  };
}
