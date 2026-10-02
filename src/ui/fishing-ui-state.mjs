import {BAITS} from '../data/catalog.mjs';

// Presentation only: no timers, random outcomes or saved state are changed here.
export function fishingUILayout(input = {}) {
  const {phase, aiming, pending, revealing} = input || {};
  const mode = phase === 'result' || pending?.phase === 'result' ? 'result'
    : revealing ? 'landing'
    : phase === 'fighting' || pending?.fight?.status === 'active' ? 'fight'
    : pending && phase === 'hooked' ? 'strike'
    : pending ? 'watch'
    : aiming ? 'aim' : 'prepare';
  return {mode, canExpandRoute: mode === 'prepare'};
}

export function selectedBaitCopy(id) {
  const bait = BAITS.find(item => item.id === id) || BAITS[0];
  return {name: bait.name, description: bait.desc, effect: bait.effect};
}
