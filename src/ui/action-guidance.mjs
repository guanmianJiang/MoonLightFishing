const actionCopy = {
  study: ['记下这次相遇', '这次记录，可以推进约定'],
  release: ['让它回到这片水域', '这次放流，可以推进约定'],
  keep: ['留下这一份样本', '收藏这份样本，可以推进约定'],
  basket: ['将这次钓获放入鱼篓', '这次入篓，可以推进约定'],
};

export function catchActionCue(action, goal) {
  const known = Object.prototype.hasOwnProperty.call(actionCopy, action);
  const copy = known ? actionCopy[action] : actionCopy.study;
  const active = !!goal && !goal.complete && Number.isFinite(goal.target) && goal.target > 0
    && Number.isFinite(goal.progress) && goal.progress >= 0 && goal.progress < goal.target;
  const followsGoal = known && active && goal.action === action;
  return {text: copy[followsGoal ? 1 : 0], followsGoal};
}

export function actionCuePresentation({mode, opening = false, trailReady = false, recovery = null, aimAdjusted = false,
  queued = false, feedback, now = 0} = {}) {
  if (mode === 'aim') {
    if (queued) return {key: 'aim:queued', text: '正在准备抛竿…', target: '#cast', kind: 'waiting', announce: true};
    return {key: `aim:${aimAdjusted ? 'adjusted' : 'choose'}`,
      text: aimAdjusted ? '落点已选 · 点抛竿确认' : '选近水／中段／远水，或点水面微调',
      target: aimAdjusted ? '#cast' : '#castZones', kind: 'next', announce: true};
  }
  if (mode !== 'prepare') return null;
  if (Number.isFinite(now) && now >= 0 && Number.isFinite(feedback?.expiresAt) && feedback.expiresAt > 0 && now < feedback.expiresAt) {
    const text = feedback.kind === 'bait' ? `已换上${feedback.name || '鱼饵'} · 接着选落点`
      : feedback.kind === 'spot' ? `已选好${feedback.name || '钓点'} · 接着选落点`
        : feedback.kind === 'cancel' ? '已取消选点 · 可以重新选择' : '';
    if (text) return {key: `feedback:${feedback.key}`, text, target: feedback.target || '#cast', kind: 'confirmed', announce: true};
  }
  if (typeof recovery?.cue === 'string' && recovery.cue) return {key: 'prepare:first-miss', text: recovery.cue, target: '#cast', kind: 'next', announce: false};
  if (trailReady) return {key: 'prepare:trail', text: '同钓点、同鱼饵 · 再选落点追鱼影', target: '#cast', kind: 'next', announce: false};
  if (opening) return {key: 'prepare:first', text: '先选一处水面 · 再确认抛竿', target: '#cast', kind: 'next', announce: false};
  return null;
}

// Keyed updates keep the frame loop from restarting animation or live announcements.
export function createActionCueRenderer({cue, text, mark, baitHint, live, findTarget, reduced = false}) {
  let previous = '', animations = [];
  const cancel = () => { for (const animation of animations) animation.cancel(); animations = []; };
  const align = target => {
    if (!target || cue.hidden) return;
    const rect = cue.getBoundingClientRect(), button = target.getBoundingClientRect();
    const anchor = Math.max(12, Math.min(rect.width - 12, button.left + button.width / 2 - rect.left));
    cue.style.setProperty('--cue-anchor', `${anchor}px`);
  };
  return {
    render(presentation) {
      const key = presentation ? JSON.stringify([presentation.key, presentation.text, presentation.target, presentation.kind]) : '';
      if (key === previous) return false;
      previous = key;
      cancel();
      cue.hidden = !presentation;
      baitHint.hidden = !!presentation;
      live.textContent = '';
      if (!presentation) return true;
      text.textContent = presentation.text;
      mark.textContent = presentation.kind === 'confirmed' ? '✓' : presentation.kind === 'waiting' ? '…' : '↑';
      cue.dataset.kind = presentation.kind;
      if (presentation.announce) live.textContent = presentation.text;
      const target = findTarget(presentation.target);
      align(target);
      if (!reduced && presentation.kind !== 'waiting') {
        animations.push(cue.animate([{opacity: .6, transform: 'translateY(-3px)'}, {opacity: 1, transform: 'none'}],
          {duration: 240, easing: 'ease-out'}));
        if (target && presentation.kind === 'confirmed') animations.push(target.animate(
          [{filter: 'brightness(1)'}, {filter: 'brightness(1.16)', offset: .4}, {filter: 'brightness(1)'}],
          {duration: 360, easing: 'ease-out'}));
      }
      return true;
    },
    realign(presentation) { if (presentation) align(findTarget(presentation.target)); },
  };
}
