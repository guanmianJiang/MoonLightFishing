// A distant world-space route: fishing targets and camera motion never affect it.
export function sharkPatrol(seconds, out = [0, 0, 0, 0]) {
  const angle = seconds * .22 + .8;
  out[0] = 4 + Math.cos(angle) * 3.2;
  out[1] = 26 + Math.sin(angle) * 1.8;
  out[2] = -Math.sin(angle) * 3.2;
  out[3] = Math.cos(angle) * 1.8;
  return out;
}

export function sharkSwimHeight(seabedHeight, seconds) {
  return Math.max(seabedHeight + .6, -1.75 + Math.sin(seconds * .15) * .08);
}
