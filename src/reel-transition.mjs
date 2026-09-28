export function shouldStartLanding(pending, revealing){
 return pending?.phase==='cast'&&pending.landedFromFight===true&&!revealing;
}
