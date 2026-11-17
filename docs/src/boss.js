// Boss tanks: one per boss level (5, 10, 15). Big, slow, thick HP,
// and a 3-way bullet spread.
import { tileCenter } from './maps.js';
import { makeTank, BOSS_SIZE } from './tank.js';
import { fireAngled } from './bullet.js';
import { smokePuff } from './particles.js';

export const BOSS_DEFS = {
  5: { name: 'IRON MAW', hp: 10 },
  10: { name: 'STEEL COLOSSUS', hp: 15 },
  15: { name: 'DOOM FORTRESS', hp: 20 },
};

export function isBossLevel(level) {
  return level === 5 || level === 10 || level === 15;
}

export function bossDefFor(level) {
  return BOSS_DEFS[level] || { name: 'IRON MAW', hp: 10 };
}

export function spawnBoss(G) {
  const def = bossDefFor(G.level);
  const c = tileCenter(0, 9);
  const boss = makeTank({
    kind: 'boss',
    side: 'enemy',
    x: c.x,
    y: c.y,
    w: BOSS_SIZE,
    h: BOSS_SIZE,
    dir: 2,
    speed: 35,
    hp: def.hp,
    color: '#2c2f36',
    color2: '#ff2d5d',
    protectT: 0,
  });
  boss.name = def.name;
  boss.score = 5000;
  boss.bulletSpeed = 240;
  boss.shootT = 1.6;
  boss.aiT = 1.0;
  G.boss = boss;
  return boss;
}

// The boss shoots a 3-way spread: forward, and 25 degrees to each side.
export function bossShoot(G, boss) {
  const forward = [ -Math.PI / 2, 0, Math.PI / 2, Math.PI ][boss.dir];
  const spread = (25 * Math.PI) / 180;
  for (const a of [forward - spread, forward, forward + spread]) {
    G.bullets.push(fireAngled(boss, a, boss.bulletSpeed));
  }
}
