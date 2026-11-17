// Bullets: movement and every collision (tiles, tanks, the base,
// bullet vs bullet). One job: what a bullet does each step.
import { tileAt, setTile, tileOf, BASE_ROW, BASE_COL } from './maps.js';
import { rectsOverlap } from './util.js';

export const BULLET_SIZE = 8;

let nextBulletId = 1;

export function makeBullet(opts) {
  return {
    id: nextBulletId++,
    x: opts.x,
    y: opts.y,
    vx: opts.vx,
    vy: opts.vy,
    dir: opts.dir,
    speed: opts.speed,
    side: opts.side, // 'player' | 'enemy'
    owner: opts.owner || null, // tank that fired it
    steel: !!opts.steel, // star level 3: breaks steel too
    alive: true,
    w: BULLET_SIZE, // 8x8 — rectsOverlap needs w/h or every hit test is NaN
    h: BULLET_SIZE,
    trail: [], // neon trail points (newest last)
  };
}

// Fire one bullet from a tank's barrel.
export function fireBullet(tank, speed, steel) {
  const d = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ][tank.dir];
  const bx = tank.x + d.x * (tank.w / 2 + 6);
  const by = tank.y + d.y * (tank.h / 2 + 6);
  return makeBullet({
    x: bx,
    y: by,
    vx: d.x * speed,
    vy: d.y * speed,
    dir: tank.dir,
    speed,
    side: tank.side,
    owner: tank,
    steel,
  });
}

// Fire a boss bullet at an angle (radians).
export function fireAngled(tank, angle, speed) {
  const bx = tank.x + Math.cos(angle) * (tank.w / 2 + 6);
  const by = tank.y + Math.sin(angle) * (tank.h / 2 + 6);
  return makeBullet({
    x: bx,
    y: by,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dir: tank.dir,
    speed,
    side: 'enemy',
    owner: tank,
    steel: false,
  });
}

// Step all bullets. Returns events the game loop reacts to:
// { baseHit, tilesBroken: [{row,col}], tankHits: [{bullet, tank}] }.
// The loop applies damage and scoring; this module only detects.
export function stepBullets(G, dt) {
  const events = { baseHit: false, tilesBroken: [], tankHits: [] };
  const field = G.grid;
  for (const b of G.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (G.mode === 'neon') {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
    }
    // Out of the playfield: dies.
    const { row, col } = tileOf(b.x, b.y);
    if (row < 0 || row >= 13 || col < 0 || col >= 13) {
      b.alive = false;
      continue;
    }
    const ch = tileAt(field, row, col);
    if (ch === '#') {
      // Brick: one hit removes one tile.
      setTile(field, row, col, '.');
      events.tilesBroken.push({ row, col });
      b.alive = false;
      continue;
    }
    if (ch === 'S') {
      if (b.steel) {
        setTile(field, row, col, '.');
        events.tilesBroken.push({ row, col });
      }
      b.alive = false;
      continue;
    }
    if (ch === 'B') {
      events.baseHit = true;
      b.alive = false;
      continue;
    }
    // Water, grass and ice: bullets fly over them.
    // Tanks: player bullets hit enemies and the boss; enemy bullets
    // hit players. Same-side tanks are never hit.
    const targets = b.side === 'player' ? [...G.enemies, ...(G.boss ? [G.boss] : [])] : G.playersArr;
    for (const t of targets) {
      if (!t || !t.alive) continue;
      if (t.protectT > 0) continue; // spawn protection: cannot be hit
      if (rectsOverlap(b, t)) {
        events.tankHits.push({ bullet: b, tank: t });
        b.alive = false;
        break;
      }
    }
  }
  // Bullet vs bullet: opposite sides cancel each other.
  for (let i = 0; i < G.bullets.length; i++) {
    const a = G.bullets[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < G.bullets.length; j++) {
      const c = G.bullets[j];
      if (!c.alive || c.side === a.side) continue;
      if (Math.abs(a.x - c.x) < 10 && Math.abs(a.y - c.y) < 10) {
        a.alive = false;
        c.alive = false;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.alive);
  return events;
}
