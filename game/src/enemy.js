// Enemies: the four tank types, the spawn queue and the AI that drives
// them toward the base (or, sometimes, the nearest player).
import { rand, randInt, choice, DIRS } from './util.js';
import { tileCenter, ENEMY_SPAWNS, tileAt, ORIGIN_X, ORIGIN_Y, TILE } from './maps.js';
import { makeTank, solidForTank } from './tank.js';

export const ENEMY_TYPES = {
  basic: { hp: 1, speed: 60, bullet: 220, score: 100, color: '#9aa87c', color2: '#5c6b45' },
  fast: { hp: 1, speed: 110, bullet: 240, score: 200, color: '#c8c8c8', color2: '#7d7d7d' },
  power: { hp: 3, speed: 50, bullet: 240, score: 300, color: '#ff8c1a', color2: '#a85400' },
  big: { hp: 2, speed: 40, bullet: 220, score: 500, color: '#a02020', color2: '#5c1010' },
};

export function spawnInterval(level) {
  if (level >= 11) return 1.7;
  if (level >= 6) return 2.0;
  return 2.5;
}

export function maxAlive(level) {
  return level >= 6 ? 5 : 4;
}

// Build the queue for a level: total 12 + level, capped at 20.
// Every 4th enemy is a flashing carrier (drops a power-up).
export function buildQueue(level) {
  const total = Math.min(12 + level, 20);
  const avail = ['basic'];
  if (level >= 2) avail.push('fast');
  if (level >= 3) avail.push('power');
  if (level >= 4) avail.push('big');
  const weights = { basic: 50, fast: 20, power: 20, big: 10 };
  const queue = [];
  for (let i = 0; i < total; i++) {
    let pick = 'basic';
    const roll = Math.random() * 100;
    let acc = 0;
    for (const t of avail) {
      acc += weights[t];
      if (roll < acc) { pick = t; break; }
    }
    queue.push({ type: pick, carrier: (i + 1) % 4 === 0 });
  }
  return queue;
}

export function spawnEnemy(G, entry) {
  const def = ENEMY_TYPES[entry.type];
  // Try each spawn point in turn; skip if blocked by a tank.
  for (let s = 0; s < ENEMY_SPAWNS.length; s++) {
    const sp = ENEMY_SPAWNS[(G.spawnPoint + s) % ENEMY_SPAWNS.length];
    const c = tileCenter(sp.row, sp.col);
    let blocked = false;
    for (const t of [...G.playersArr, ...G.enemies]) {
      if (t.alive && Math.abs(t.x - c.x) < 46 && Math.abs(t.y - c.y) < 46) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    G.spawnPoint = (G.spawnPoint + s + 1) % ENEMY_SPAWNS.length;
    const tank = makeTank({
      kind: entry.type,
      side: 'enemy',
      x: c.x,
      y: c.y,
      dir: 2,
      speed: def.speed * G.speedScale,
      hp: def.hp,
      color: def.color,
      color2: def.color2,
      carrier: entry.carrier,
      protectT: 1.0,
    });
    tank.bulletSpeed = def.bullet;
    tank.score = def.score;
    tank.aiT = rand(0.5, 1.5);
    tank.shootT = rand(1.5, 3.0);
    G.enemies.push(tank);
    return tank;
  }
  return null;
}

// Is the tile ahead of this tank (in direction d) free to enter?
function dirFree(G, t, d) {
  const step = 26;
  const nx = t.x + DIRS[d].x * step;
  const ny = t.y + DIRS[d].y * step;
  const col = Math.floor((nx - ORIGIN_X) / TILE);
  const row = Math.floor((ny - ORIGIN_Y) / TILE);
  if (row < 0 || row >= 13 || col < 0 || col >= 13) return false;
  if (solidForTank(tileAt(G.grid, row, col))) return false;
  // Also check the corners of the tank's leading edge.
  const half = t.w / 2 - 2;
  const px = [t.x - half, t.x + half];
  const py = [t.y - half, t.y + half];
  for (const x of px) {
    for (const y of py) {
      const cc = Math.floor((x + DIRS[d].x * step - ORIGIN_X) / TILE);
      const rr = Math.floor((y + DIRS[d].y * step - ORIGIN_Y) / TILE);
      if (solidForTank(tileAt(G.grid, rr, cc))) return false;
    }
  }
  return true;
}

// Enemy AI, run every frame: re-pick direction on a timer, chase the
// target, and shoot when roughly aligned with it. allowShoot=false lets
// the boss use this for movement only (it has its own 3-way timer).
export function updateEnemyAI(G, t, dt, allowShoot) {
  t.aiT -= dt;
  if (t.aiT <= 0) {
    t.aiT = rand(1.0, 2.0);
    // Target: usually the base, sometimes the nearest player.
    let tx, ty;
    const players = G.playersArr.filter((p) => p.alive);
    if (players.length && Math.random() < 0.25) {
      let best = players[0];
      let bd = Infinity;
      for (const p of players) {
        const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
        if (d < bd) { bd = d; best = p; }
      }
      tx = best.x;
      ty = best.y;
    } else {
      tx = ORIGIN_X + 6 * TILE + TILE / 2;
      ty = ORIGIN_Y + 12 * TILE + TILE / 2;
    }
    const dx = tx - t.x;
    const dy = ty - t.y;
    const order = Math.abs(dx) > Math.abs(dy)
      ? [dx > 0 ? 1 : 3, dy > 0 ? 2 : 0]
      : [dy > 0 ? 2 : 0, dx > 0 ? 1 : 3];
    let picked = null;
    for (const d of order) {
      if (dirFree(G, t, d)) { picked = d; break; }
    }
    if (picked === null) {
      const free = [0, 1, 2, 3].filter((d) => dirFree(G, t, d));
      if (free.length) picked = choice(free);
    }
    if (picked !== null) t.dir = picked;
  }
  // Shooting: every 1.5-3.0 s, when roughly aligned with the target
  // or at random. Skipped when allowShoot is false (the boss shoots
  // on its own 3-way timer instead).
  t.shootT -= dt;
  if (allowShoot === false) return null;
  if (t.shootT <= 0) {
    t.shootT = rand(1.5, 3.0);
    const players = G.playersArr.filter((p) => p.alive);
    const aligned = players.some(
      (p) => Math.abs(p.x - t.x) < 26 || Math.abs(p.y - t.y) < 26,
    );
    const baseAligned = Math.abs(t.x - (ORIGIN_X + 6 * TILE + 24)) < 26;
    if (aligned || baseAligned || Math.random() < 0.3) {
      return 'shoot';
    }
  }
  return null;
}
