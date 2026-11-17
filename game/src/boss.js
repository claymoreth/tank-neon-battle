// Boss tanks: one at the end of EVERY round (changed 2026-11-17; was
// levels 5/10/15 only). Big, slow, thick HP, and a bullet spread that
// widens from round 4. Names cycle IRON MAW / STEEL COLOSSUS /
// DOOM FORTRESS; HP, speed, shoot interval and bullet speed scale with
// the round (still fair and killable at every round).
import { tileCenter } from './maps.js';
import { makeTank, BOSS_SIZE } from './tank.js';
import { fireAngled } from './bullet.js';
import { smokePuff } from './particles.js';

export const BOSS_NAMES = ['IRON MAW', 'STEEL COLOSSUS', 'DOOM FORTRESS'];

export function isBossLevel(level) {
  return true; // every round ends with a boss
}

export function bossDefFor(level) {
  return { name: BOSS_NAMES[(level - 1) % 3], hp: 8 + level };
}

export function spawnBoss(G) {
  const def = bossDefFor(G.level);
  const c = tileCenter(0, 9);
  const round = G.level;
  const boss = makeTank({
    kind: 'boss',
    side: 'enemy',
    x: c.x,
    y: c.y,
    w: BOSS_SIZE,
    h: BOSS_SIZE,
    dir: 2,
    speed: Math.min(55, 35 + 1.5 * (round - 1)),
    hp: def.hp,
    color: '#2c2f36',
    color2: '#ff2d5d',
    protectT: 0,
  });
  boss.name = def.name;
  boss.score = 5000;
  boss.bulletSpeed = Math.min(280, 240 + 5 * (round - 1));
  boss.shootInterval = Math.max(1.0, 1.6 - 0.05 * (round - 1));
  boss.shootT = boss.shootInterval;
  boss.aiT = 1.0;
  G.boss = boss;
  return boss;
}

// The boss shoots a spread: 3-way (forward, and 25 degrees to each
// side) for rounds 1-3; 5-way (forward, +/-25, +/-50 degrees) from
// round 4 up.
export function bossShoot(G, boss) {
  const forward = [ -Math.PI / 2, 0, Math.PI / 2, Math.PI ][boss.dir];
  const spread = (25 * Math.PI) / 180;
  const angles = G.level >= 4
    ? [forward - 2 * spread, forward - spread, forward, forward + spread, forward + 2 * spread]
    : [forward - spread, forward, forward + spread];
  for (const a of angles) {
    G.bullets.push(fireAngled(boss, a, boss.bulletSpeed));
  }
}
