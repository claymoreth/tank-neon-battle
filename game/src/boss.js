// Boss tanks: one at the end of EVERY round (changed 2026-11-17; was
// levels 5/10/15 only). Big, slow, thick HP, and a bullet spread that
// widens from round 4. Names cycle IRON MAW / STEEL COLOSSUS /
// DOOM FORTRESS; HP, speed, shoot interval and bullet speed scale with
// the round (still fair and killable at every round).
//
// MOVEMENT (fixed 2026-11-17 — the boss used to wedge itself against
// the steel cross at the top and push into it forever): the old AI
// never reacted to being physically blocked, the 26 px dirFree probe
// was built for 48 px tanks (its corner checks miss the middle of an
// 88 px leading edge entirely), and the spawn put the body half
// outside the playfield. The boss now:
//   - chases the nearest alive player every re-pick (not the base),
//   - checks directions with its REAL 88x88 body (the full leading
//     edge and every tile the body would occupy),
//   - turns IMMEDIATELY when a move step is blocked, and
//   - has a stuck watchdog: 1.5 s without meaningful movement forces
//     a reverse of one tile plus a turn to a random free direction.
// A greedy chase alone still oscillates in concave corners (the boss
// kept pressing into the notch between the row-6 bricks and the steel
// column in layout A, sliding up and down forever without ever going
// around), so the chase is driven by a TILE-GRID BFS PATH: the boss
// steers along the shortest path over tiles where its whole 88x88
// body fits, which routes it around walls instead of into them. The
// greedy chase stays as the fallback when no path exists.
import { tileCenter, tileAt, tileOf, ORIGIN_X, ORIGIN_Y, TILE, ROWS, COLS } from './maps.js';
import { makeTank, BOSS_SIZE, solidForTank, snapTurn } from './tank.js';
import { fireAngled } from './bullet.js';
import { smokePuff } from './particles.js';
import { rand, choice, DIRS } from './util.js';

export const BOSS_NAMES = ['IRON MAW', 'STEEL COLOSSUS', 'DOOM FORTRESS'];

export function isBossLevel(level) {
  return true; // every round ends with a boss
}

export function bossDefFor(level) {
  return { name: BOSS_NAMES[(level - 1) % 3], hp: 8 + level };
}

// Do all tiles overlapped by an 88x88 body centered at (cx, cy) let a
// tank stand there? Out-of-bounds tiles count as solid (tileAt returns
// '#' outside the map), so this also enforces the playfield walls.
export function bossRectFits(G, cx, cy) {
  const x0 = cx - BOSS_SIZE / 2;
  const x1 = cx + BOSS_SIZE / 2 - 0.01;
  const y0 = cy - BOSS_SIZE / 2;
  const y1 = cy + BOSS_SIZE / 2 - 0.01;
  const c0 = Math.floor((x0 - ORIGIN_X) / TILE);
  const c1 = Math.floor((x1 - ORIGIN_X) / TILE);
  const r0 = Math.floor((y0 - ORIGIN_Y) / TILE);
  const r1 = Math.floor((y1 - ORIGIN_Y) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solidForTank(tileAt(G.grid, r, c))) return false;
    }
  }
  return true;
}

// Would the boss's whole body still fit if its center moved `step` px
// in direction d? This is the boss's "is this direction free" check —
// the full leading edge, not a point probe.
export function bossDirFreeAt(G, cx, cy, d) {
  return bossRectFits(G, cx + DIRS[d].x * 16, cy + DIRS[d].y * 16);
}

function bossDirFree(G, b, d) {
  return bossDirFreeAt(G, b.x, b.y, d);
}

// Nearest alive player to point (x, y), or null when no player is alive.
function nearestPlayer(G, x, y) {
  let best = null;
  let bd = Infinity;
  for (const p of G.playersArr) {
    if (!p.alive) continue;
    const d = Math.abs(p.x - x) + Math.abs(p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// Directions ordered for chasing the target: the axis with the bigger
// gap first, then the other axis toward the target, then the two
// remaining directions. With no target, a random order (patrol).
function bossDirOrder(G, b) {
  const t = nearestPlayer(G, b.x, b.y);
  if (!t) {
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const primary = Math.abs(dx) > Math.abs(dy)
    ? [dx > 0 ? 1 : 3, dy > 0 ? 2 : 0]
    : [dy > 0 ? 2 : 0, dx > 0 ? 1 : 3];
  const rest = [0, 1, 2, 3].filter((d) => !primary.includes(d));
  return [...primary, ...rest];
}

// First free direction in chase order, or null when boxed in.
export function pickBossDir(G, b) {
  for (const d of bossDirOrder(G, b)) {
    if (bossDirFree(G, b, d)) return d;
  }
  return null;
}

// Turn the boss to a direction, snapping the perpendicular axis to the
// nearest tile center first — but only when the snapped body still
// fits; otherwise just turn without snapping (a snap must never push
// the 88 px body into a solid tile).
function bossSetDir(G, b, d) {
  const oldX = b.x;
  const oldY = b.y;
  snapTurn(b, d);
  if (!bossRectFits(G, b.x, b.y)) {
    b.x = oldX;
    b.y = oldY;
    b.dir = d;
  }
}

// Pick a fresh chase direction now and commit to it for a short while.
export function bossTurnNow(G, b) {
  const d = pickBossDir(G, b);
  if (d !== null) bossSetDir(G, b, d);
  b.aiT = rand(0.5, 1.0);
}

// A tile is passable for the boss when its whole 88x88 body fits
// with its center on that tile — the body spans three tiles, so this
// is a 3x3 open-block test. (The row-6 bricks + steel column in
// layout A leave no passable tile between them: the boss can never
// squeeze through that 1-tile gap, it must go around.)
export function bossTilePassable(G, r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  return bossRectFits(G, ORIGIN_X + c * TILE + TILE / 2, ORIGIN_Y + r * TILE + TILE / 2);
}

// BFS over a 24 px grid of boss-center positions (tile centers AND
// tile boundaries — a 2-tile corridor's centerline is a boundary, and
// the boss's 88 px body needs it: a tile-center-only graph wrongly
// sealed layouts B–E off from the bottom). A node is passable when
// the whole 88x88 body fits there (bossRectFits is the ground truth).
// Returns an array of waypoint positions {x, y} (excluding the boss's
// own node) or null when no route exists. Recomputed often (the
// player moves), so it stays cheap: at most 37x37 nodes.
const BFS_STEP = 24;
const BFS_N = 37; // (912 - 48) / 24 + 1 — covers the whole playfield
function bfsNode(G, i, j) {
  return bossRectFits(G, ORIGIN_X + BFS_STEP + i * BFS_STEP, ORIGIN_Y + BFS_STEP + j * BFS_STEP);
}
function nearestBfsNode(G, x, y) {
  const gi = Math.round((x - ORIGIN_X - BFS_STEP) / BFS_STEP);
  const gj = Math.round((y - ORIGIN_Y - BFS_STEP) / BFS_STEP);
  if (gi >= 0 && gi < BFS_N && gj >= 0 && gj < BFS_N && bfsNode(G, gi, gj)) return { i: gi, j: gj };
  for (let rad = 1; rad <= 12; rad++) {
    for (let dj = -rad; dj <= rad; dj++) {
      for (let di = -rad; di <= rad; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
        const ni = gi + di, nj = gj + dj;
        if (ni < 0 || ni >= BFS_N || nj < 0 || nj >= BFS_N) continue;
        if (bfsNode(G, ni, nj)) return { i: ni, j: nj };
      }
    }
  }
  return null;
}
export function bossFindPath(G, fromX, fromY, toX, toY) {
  const start = nearestBfsNode(G, fromX, fromY);
  const goal = nearestBfsNode(G, toX, toY);
  if (!start || !goal) return null;
  if (start.i === goal.i && start.j === goal.j) return [];
  const key = (i, j) => j * BFS_N + i;
  const prev = new Map([[key(start.i, start.j), null]]);
  const queue = [{ i: start.i, j: start.j }];
  let found = false;
  while (queue.length) {
    const { i, j } = queue.shift();
    if (i === goal.i && j === goal.j) { found = true; break; }
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni >= BFS_N || nj < 0 || nj >= BFS_N) continue;
      if (prev.has(key(ni, nj)) || !bfsNode(G, ni, nj)) continue;
      prev.set(key(ni, nj), { i, j });
      queue.push({ i: ni, j: nj });
    }
  }
  // When the goal itself is unreachable (layouts B/C/D split the map
  // for an 88 px body — the row-13 comb of bricks can never be
  // crossed — the boss must still press the player at the closest
  // reachable point instead of wandering). The BFS explored the whole
  // reachable region, so pick the visited node nearest the target.
  let target = { i: goal.i, j: goal.j };
  if (!found) {
    let best = null, bestD = Infinity;
    for (const k of prev.keys()) {
      const i = k % BFS_N, j = Math.floor(k / BFS_N);
      const x = ORIGIN_X + BFS_STEP + i * BFS_STEP;
      const y = ORIGIN_Y + BFS_STEP + j * BFS_STEP;
      const d = Math.hypot(x - toX, y - toY);
      if (d < bestD) { bestD = d; best = { i, j }; }
    }
    if (!best) return null;
    target = best;
  }
  const path = [];
  let cur = target;
  while (!(cur.i === start.i && cur.j === start.j)) {
    path.unshift({ x: ORIGIN_X + BFS_STEP + cur.i * BFS_STEP, y: ORIGIN_Y + BFS_STEP + cur.j * BFS_STEP });
    cur = prev.get(key(cur.i, cur.j));
  }
  return path;
}

// Steer the boss toward a waypoint: pick the axis with the bigger
// gap, and pull the perpendicular coordinate onto the waypoint's line
// (a tile center) when close — an 88 px body in a 2-tile corridor has
// almost no slack, so drifting off-center would pinch it against the
// side wall on every move step. The snap only applies when the snapped
// body still fits.
function bossSteerTo(G, b, tx, ty) {
  const dx = tx - b.x, dy = ty - b.y;
  const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  if (dir === 0 || dir === 2) {
    if (Math.abs(b.x - tx) <= 24) {
      const ox = b.x; b.x = tx;
      if (!bossRectFits(G, b.x, b.y)) b.x = ox;
    }
  } else {
    if (Math.abs(b.y - ty) <= 24) {
      const oy = b.y; b.y = ty;
      if (!bossRectFits(G, b.x, b.y)) b.y = oy;
    }
  }
  b.dir = dir;
}

// Per-frame boss movement driver (replaces updateEnemyAI for the
// boss): BFS path first, greedy chase when no path exists (boss boxed
// in a pocket, or already adjacent to the player — the path is then
// empty and the greedy press + shooting take over). While an unstuck
// reverse is running, the watchdog owns the direction instead.
export function updateBossAI(G, b, dt) {
  if (b.unstuckT > 0) {
    b.unstuckT -= dt;
    if (b.unstuckT <= 0) {
      b.unstuckT = 0;
      bossTurnNow(G, b);
    }
    return;
  }
  const t = nearestPlayer(G, b.x, b.y);
  const tKey = t ? tileOf(t.x, t.y).row * COLS + tileOf(t.x, t.y).col : -1;
  b.pathT = (b.pathT ?? 0) - dt;
  if (!b.path || b.path.length === 0 || b.pathT <= 0 || tKey !== b.pathTarget) {
    b.path = t ? bossFindPath(G, b.x, b.y, t.x, t.y) : null;
    b.pathTarget = tKey;
    b.pathT = 1.0;
  }
  if (b.path && b.path.length) {
    const wp = b.path[0];
    if (Math.hypot(wp.x - b.x, wp.y - b.y) < 12) { b.path.shift(); return; }
    bossSteerTo(G, b, wp.x, wp.y);
    return;
  }
  b.aiT -= dt;
  if (b.aiT <= 0) bossTurnNow(G, b);
}

// Stuck watchdog (runs every frame, last resort): `disp` is how far
// the boss actually moved this frame. If it has not moved
// meaningfully for 1.5 s, force an unstuck — reverse one tile, then
// turn to a random free direction and resume chasing. `b.unstuck`
// counts how many times the watchdog fired (read by tests).
export function bossWatchdog(G, b, dt, disp) {
  const step = b.speed * dt;
  if (disp > Math.max(0.25, step * 0.25)) {
    b.stillT = 0;
    b.lastX = b.x;
    b.lastY = b.y;
    return;
  }
  b.stillT += dt;
  if (b.stillT >= 1.5 && b.unstuckT <= 0) {
    b.unstuck = (b.unstuck || 0) + 1;
    b.stillT = 0;
    const rev = (b.dir + 2) % 4;
    const free = [0, 1, 2, 3].filter((d) => bossDirFree(G, b, d));
    const dir = free.includes(rev) ? rev : (free.length ? choice(free) : rev);
    bossSetDir(G, b, dir);
    b.unstuckDir = dir;
    // One tile of reverse driving at boss speed.
    b.unstuckT = TILE / b.speed;
  }
}

// Find a spawn spot whose whole 88x88 body fits inside the playfield
// on open tiles with a free exit toward the player. Candidates are
// tried topmost-first, nearest to the center column first (the old
// row-0 spawn put the body half outside the playfield and clamped it
// straight onto the steel below). Falls back to any open spot, then
// to row 1 col 9.
export function bossSpawnSpot(G) {
  const cands = [];
  for (let r = 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cands.push({ r, c, score: r * 100 + Math.abs(c - 9) });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  const towardPlayer = (cx, cy) => {
    const t = nearestPlayer(G, cx, cy);
    if (!t) return false;
    const dx = t.x - cx;
    const dy = t.y - cy;
    const order = Math.abs(dx) > Math.abs(dy)
      ? [dx > 0 ? 1 : 3, dy > 0 ? 2 : 0]
      : [dy > 0 ? 2 : 0, dx > 0 ? 1 : 3];
    return order.some((d) => bossDirFreeAt(G, cx, cy, d));
  };
  for (const pass of [true, false]) {
    for (const { r, c } of cands) {
      const cx = ORIGIN_X + c * TILE + TILE / 2;
      const cy = ORIGIN_Y + r * TILE + TILE / 2;
      if (!bossRectFits(G, cx, cy)) continue;
      const exits = [0, 1, 2, 3].some((d) => bossDirFreeAt(G, cx, cy, d));
      if (!exits) continue;
      if (pass && !towardPlayer(cx, cy)) continue;
      return { x: cx, y: cy };
    }
  }
  const c = tileCenter(1, 9);
  return { x: c.x, y: c.y };
}

export function spawnBoss(G) {
  const def = bossDefFor(G.level);
  const spot = bossSpawnSpot(G);
  const round = G.level;
  const boss = makeTank({
    kind: 'boss',
    side: 'enemy',
    x: spot.x,
    y: spot.y,
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
  boss.aiT = 0.5;
  // BFS chase-path state (recomputed by updateBossAI).
  boss.path = null;
  boss.pathTarget = -1;
  boss.pathT = 0;
  // Stuck-watchdog state.
  boss.stillT = 0;
  boss.lastX = spot.x;
  boss.lastY = spot.y;
  boss.unstuck = 0;
  boss.unstuckT = 0;
  boss.unstuckDir = 2;
  boss.blockCd = 0;
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
