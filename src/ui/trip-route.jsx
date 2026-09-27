import {For, createSignal} from 'solid-js';
import {render} from 'solid-js/web';

export function mountTripRoute(root, onOpen) {
  const [trip, setTrip] = createSignal({number: 1, castsLeft: 4, goal: '', progress: 0, target: 1, complete: false});
  const dispose = render(() => <aside class="route-card" aria-label="本轮目标">
    <div class="route-card__top"><span>本轮目标</span><strong>第 {trip().number} 轮</strong></div>
    <div class="route-card__goal">{trip().goal}</div>
    <div class="route-card__progress">
      <span>进度 {trip().progress}/{trip().target}</span>
      <span class="route-card__casts" aria-label={`剩余 ${trip().castsLeft} 竿`}>
        <For each={[0, 1, 2, 3]}>{index => <i classList={{spent: index >= trip().castsLeft}} />}</For>
      </span>
    </div>
    <button type="button" onClick={onOpen}>查看水域手记 <span aria-hidden="true">↗</span></button>
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
      };
      const previous = trip();
      if (Object.keys(next).some(key => next[key] !== previous[key])) setTrip(next);
    },
    dispose,
  };
}
