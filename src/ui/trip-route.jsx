import {createSignal} from 'solid-js';
import {render} from 'solid-js/web';
import {progressionGuide} from '../progression-guide.mjs';
import {nextCastThread} from '../next-cast-thread.mjs';
import {weatherAt} from '../engine.mjs';
import {waterQuestion} from '../water-question.mjs';
import {spotDecisionGuide} from '../spot-chronicle.mjs';

export function mountTripRoute(root, onOpen, onGuide, onQuestion) {
  const [trip, setTrip] = createSignal({number: 1, castsLeft: 4, goal: '', progress: 0, target: 1, complete: false});
  const [guide, setGuide] = createSignal(progressionGuide(null));
  const [question, setQuestion] = createSignal(null);
  let routeDetails;
  let focusedSpot=null,openFocusedSpot=false;
  const dispose = render(() => <aside class="route-card" classList={{opening:!!guide().opening,'spot-focused':!!guide().spotFocus}} aria-label="垂钓路线与本轮目标">
    <details ref={routeDetails} class="route-card__details">
      <summary aria-label="展开或收起下一竿线索">
        <img class="route-card__art" src="./assets/ui/shore-journal.webp" alt="" width="56" height="50" />
        <span class="route-card__copy"><span class="route-card__top"><span>{guide().spotFocus ? '钓点准备' : guide().opening ? '水边时光' : '下一竿线索'}</span><strong>第 {trip().number} 轮 · 余 {trip().castsLeft} 竿</strong></span>
          <strong class="route-card__goal">{guide().title}</strong>
          <span class="route-card__progress"><span>{guide().spotFocus ? '选饵与落点 · 再确认抛竿' : guide().opening ? '选好鱼饵，轻松抛一竿' : `探索 ${guide().progress}/${guide().target}`}</span><span class="route-card__expand">详情 <i aria-hidden="true">⌄</i></span></span>
        </span>
      </summary>
      <div class="route-card__body">
        <p class="route-card__detail">{guide().detail}</p>
        {!guide().spotFocus && <div class="route-card__difficulty">近水多一点提竿余裕 · 远水更有机会遇见大鱼</div>}
        <button class="route-card__primary" type="button" disabled={trip().pending} onClick={() => onGuide(guide().action)}>{guide().action.label}<span aria-hidden="true">↗</span></button>
        {!guide().spotFocus && question() && <div class="route-card__water-question">
          <span class="route-card__question-kicker">或者试试本轮水情</span>
          <button class="route-card__question" type="button" disabled={trip().pending} onClick={() => onQuestion(question().action)}>{question().title}<span aria-hidden="true">↗</span></button>
          <p>{question().detail}</p>
        </div>}
        {!guide().spotFocus && <button class="route-card__journal" type="button" onClick={onOpen}>本轮：{trip().goal} {trip().progress}/{trip().target} <span aria-hidden="true">›</span></button>}
      </div>
    </details>
  </aside>, root);
  return {
    focusSpot(id) { focusedSpot=id; openFocusedSpot=true; },
    update(state, layout) {
      if (!layout?.canExpandRoute) {if(routeDetails)routeDetails.open=false;if(state.pending){focusedSpot=null;openFocusedSpot=false}}
      else if(routeDetails&&openFocusedSpot){routeDetails.open=true;openFocusedSpot=false}
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
      const spotGuide=focusedSpot===state.spot?spotDecisionGuide(state,state.spot):null;
      const nextGuide = spotGuide ? {...route,spotFocus:true,stage:'这片水的下一竿',title:spotGuide.title,detail:spotGuide.detail,action:spotGuide.action}
        : thread ? {...route, stage:'下一竿 · 水域线索', title:thread.title, detail:thread.detail, action:thread.action} : route;
      if (JSON.stringify(nextGuide) !== JSON.stringify(guide())) setGuide(nextGuide);
      const nextQuestion=waterQuestion(state);
      if(JSON.stringify(nextQuestion)!==JSON.stringify(question()))setQuestion(nextQuestion);
    },
    dispose,
  };
}
