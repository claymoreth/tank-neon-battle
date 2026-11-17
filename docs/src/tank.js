// Tank entity: players, enemies and the boss share movement, collision,
// firing, HP and ice sliding. One job: how a tank drives and shoots.
import { DIRS, clamp } from './util.js';
import { TILE, ORIGIN_X, ORIGIN_Y, COLS, ROWS, tileAt } from './maps.js';

export const TANK_SIZE = 44;
export const BOSS_SIZE = 88;

let nextId = 1;

export function makeTank(opts) {
  return {
    id: nextId++,
    kind: opts.kind, // 'player' | 'basic' | 'fast' | 'power' | 'big' | 'boss'
    side: opts.side, // 'player' | 'enemy'
    player: opts.player || 0, // 1 or 2 for player tanks
    x: opts.x,
    y: opts.y,
    w: opts.w || TANK_SIZE,
    h: opts.h || TANK_SIZE,
    dir: opts.dir === undefined ? 0 : opts.dir,
    vx: 0,
    vy: 0,
    speed: opts.speed,
    hp: opts.hp,
    maxHp: opts.hp,
    color: opts.color,
    color2: opts.color2 || '#222222',
    star: 0,
    helmetT: 0,
    protectT: opts.protectT || 0,
    fireCd: 0,
    alive: true,
    carrier: !!opts.carrier,
    flashT: 0,
    aiT: 0,
    shootT: 0,
    respawnT: 0,
    blinkT: 0,
  };
}

// Tiles a tank may not enter.
export function solidForTank(ch) {
  return ch === '#' || ch === 'S' || ch === 'B' || ch === 'W';
}

function tileRange(t) {
  const left = t.x - t.w / 2;
  const right = t.x + t.w / 2;
  const top = t.y - t.h / 2;
  const bottom = t.y + t.h / 2;
  return {
    c0: Math.floor((left - ORIGIN_X) / TILE),
    c1: Math.floor((right - 0.01 - ORIGIN_X) / TILE),
    r0: Math.floor((top - ORIGIN_Y) / TILE),
    r1: Math.floor((bottom - 0.01 - ORIGIN_Y) / TILE),
  };
}

// Is the tank standing on ice? (center tile, or any overlapped ice tile)
export function onIce(grid, t) {
  const r = tileRange(t);
  for (let row = r.r0; row <= r.r1; row++) {
    for (let col = r.c0; col <= r.c1; col++) {
      if (tileAt(grid, row, col) === 'I') return true;
    }
  }
  return false;
}

// Move one step along the tank's direction, clamped by solid tiles.
// Returns true if the tank actually moved.
export function moveTank(grid, t, dist, others) {
  if (dist <= 0) return false;
  const d = DIRS[t.dir];
  const oldX = t.x;
  const oldY = t.y;
  let nx = t.x + d.x * dist;
  let ny = t.y + d.y * dist;
  // Clamp to the playfield walls first.
  nx = clamp(nx, ORIGIN_X + t.w / 2, ORIGIN_X + COLS * TILE - t.w / 2);
  ny = clamp(ny, ORIGIN_Y + t.h / 2, ORIGIN_Y + ROWS * TILE - t.h / 2);
  t.x = nx;
  t.y = ny;
  const r = tileRange(t);
  // If the new rect overlaps a solid tile, pull back along the axis.
  let blocked = false;
  for (let row = r.r0; row <= r.r1; row++) {
    for (let col = r.c0; col <= r.c1; col++) {
      if (solidForTank(tileAt(grid, row, col))) {
        blocked = true;
        if (d.y < 0) t.y = ORIGIN_Y + (row + 1) * TILE + t.h / 2;
        else if (d.y > 0) t.y = ORIGIN_Y + row * TILE - t.h / 2;
        else if (d.x < 0) t.x = ORIGIN_X + (col + 1) * TILE + t.w / 2;
        else if (d.x > 0) t.x = ORIGIN_X + col * TILE - t.w / 2;
      }
    }
  }
  // Tanks cannot overlap each other: revert on contact.
  if (others) {
    for (const o of others) {
      if (o === t || !o.alive) continue;
      if (Math.abs(t.x - o.x) < (t.w + o.w) / 2 - 2 && Math.abs(t.y - o.y) < (t.h + o.h) / 2 - 2) {
        t.x = oldX;
        t.y = oldY;
        blocked = true;
        break;
      }
    }
  }
  return !blocked || t.x !== oldX || t.y !== oldY;
}

// Snap the perpendicular axis to the nearest tile center when the tank
// turns, if it is close enough (classic turning feel).
export function snapTurn(t, newDir) {
  if (newDir === t.dir) return;
  const vertical = newDir === 0 || newDir === 2;
  if (vertical) {
    const col = Math.round((t.x - ORIGIN_X - TILE / 2) / TILE);
    const cx = ORIGIN_X + col * TILE + TILE / 2;
    if (Math.abs(t.x - cx) <= 10) t.x = cx;
  } else {
    const row = Math.round((t.y - ORIGIN_Y - TILE / 2) / TILE);
    const cy = ORIGIN_Y + row * TILE + TILE / 2;
    if (Math.abs(t.y - cy) <= 10) t.y = cy;
  }
  t.dir = newDir;
}

// Bullet stats for a player tank at its star level.
export function playerBulletStats(t) {
  if (t.star >= 3) return { speed: 480, max: 2, steel: true };
  if (t.star >= 2) return { speed: 420, max: 2, steel: false };
  if (t.star >= 1) return { speed: 420, max: 1, steel: false };
  return { speed: 320, max: 1, steel: false };
}

// Can this tank fire right now (active-bullet limit + cooldown)?
export function canFire(t, activeBullets) {
  if (!t.alive || t.fireCd > 0) return false;
  if (t.side === 'player') {
    return activeBullets < playerBulletStats(t).max;
  }
  return activeBullets < 1;
}
