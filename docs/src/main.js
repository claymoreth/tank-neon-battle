// TANK PRO BATTLE — game loop, states, input, spawning, level flow.
// One job: run the battle. Rendering lives in draw.js and hud.js.
import { clamp, rand, DIRS } from './util.js';
import {
  TILE, ORIGIN_X, ORIGIN_Y, parseLayout, layoutFor, tileAt, setTile,
  tileCenter, tileOf, BASE_ROW, BASE_COL, P1_SPAWN, P2_SPAWN,
  VIEW_W, VIEW_H, CAM_MAX, COLS, ROWS,
} from './maps.js';
import { makeTank, onIce, moveTank, snapTurn, playerBulletStats, canFire } from './tank.js';
import { buildQueue, spawnEnemy, spawnInterval, maxAlive, updateEnemyAI, ENEMY_TYPES } from './enemy.js';
import { isBossLevel, spawnBoss, bossShoot, updateBossAI, bossTurnNow, bossWatchdog } from './boss.js';
import { makeBullet, fireBullet, stepBullets } from './bullet.js';
import { dropPowerup, applyPowerup, setRingSteel } from './powerup.js';
import { burst, muzzle, smokePuff, stepParticles, shake } from './particles.js';
import { ensureBackground, stepSmoke, drawEdgeLayer, drawWorldLayer, drawSmokeAndFires } from './background.js';
import { drawTiles, drawGrassOver, drawTank, drawBullets, drawPowerups, drawParticles, drawFloats } from './draw.js';
import {
  MUTE_RECT, hitMute, hitFire, FIRE_RECT, drawFireButton, drawHUD, drawSideStrips, drawBossBar,
  drawTitle, titleClick, drawPaused, drawLevelClear,
  drawGameOver, gameOverClick, drawBanner,
} from './hud.js';
import {
  ensureAudio, setMuted as audioSetMuted, sfxShoot, sfxEnemyShoot, sfxHit,
  sfxExplode, sfxBigExplode, sfxPowerup, sfxBaseAlarm, sfxLevelClear,
  sfxGameOver, sfxBossWarn,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Keyboard focus: the canvas takes focus on load (and again in
// startGame) so WASD/arrows work immediately with no click into the
// game area. The key handlers live on window, so they work whatever
// element holds focus — this is belt and braces.
canvas.focus();

function loadHighScore() {
  try {
    return parseInt(localStorage.getItem('tnb_highscore') || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

const G = {
  state: 'title',
  mode: 'pro',
  players: 1,
  level: 1,
  grid: [],
  playersArr: [],
  enemies: [],
  boss: null,
  bossState: 'none', // none | warning | active | defeated
  bossTimer: 0,
  roundStart: null, // {level, score1, score2, lives1, lives2} at loadLevel — retry restores it
  bullets: [],
  powerups: [],
  particles: [],
  rings: [],
  muzzles: [],
  floats: [],
  queue: [],
  queueIndex: 0,
  spawnTimer: 0,
  spawnPoint: 0,
  speedScale: 1,
  score1: 0,
  score2: 0,
  lives1: 3,
  lives2: 3,
  highScore: loadHighScore(),
  newHigh: false,
  shovelTimer: 0,
  ringBackup: {},
  clearBonus: 0,
  levelClearTimer: 0,
  shakeMag: 0,
  shakeT: 0,
  time: 0,
  muted: false,
  baseAlive: true,
  bgCanvas: null,
  bgKey: '',
  smoke: [],
  fires: [],
  demoTanks: [],
  demoGrid: [],
  // Camera: top-left world offset of the 624x624 playfield window.
  camX: 0,
  camY: CAM_MAX,
  pendingBossKill: false,
  overReason: '',
};

function playerColor(n) {
  if (G.mode === 'pro') return n === 1 ? '#26292f' : '#2a2d33';
  // CLASSIC players: BRIGHT army green — clearly brighter than any enemy.
  return '#6fae3f';
}

function playerTrim(n) {
  // PRO players: BRIGHT BLUE CYAN accents. BLUE = player, always.
  if (G.mode === 'pro') return n === 1 ? '#22d3ee' : '#4df3ff';
  // CLASSIC players: white trim (P1) / pale-blue trim (P2).
  return n === 1 ? '#ffffff' : '#a8c8e0';
}

function makePlayerTank(n) {
  const sp = n === 1 ? P1_SPAWN : P2_SPAWN;
  const c = tileCenter(sp.row, sp.col);
  return makeTank({
    kind: 'player',
    side: 'player',
    player: n,
    x: c.x,
    y: c.y,
    dir: 0,
    speed: 130,
    hp: 1,
    color: playerColor(n),
    color2: playerTrim(n),
    protectT: 2,
  });
}

function placePlayer(n) {
  const old = G.playersArr[n - 1];
  const fresh = makePlayerTank(n);
  if (old) {
    fresh.star = old.star;
    fresh.lives = old.lives;
  }
  G.playersArr[n - 1] = fresh;
  return fresh;
}

function loadLevel(n) {
  // Snapshot the state entering this round: a game over retries THIS
  // round (score/lives restored), it never sends the player back to
  // round 1 (changed 2026-11-17).
  G.roundStart = {
    level: n, score1: G.score1, score2: G.score2,
    lives1: G.lives1, lives2: G.lives2,
  };
  G.grid = parseLayout(layoutFor(n));
  G.speedScale = 1 + Math.max(0, n - 15) * 0.05;
  G.enemies = [];
  G.bullets = [];
  G.powerups = [];
  G.particles = [];
  G.rings = [];
  G.muzzles = [];
  G.floats = [];
  G.boss = null;
  G.bossState = 'none';
  G.bossTimer = 0;
  G.queue = buildQueue(n);
  G.queueIndex = 0;
  G.spawnTimer = 1.0;
  G.spawnPoint = 0;
  G.shovelTimer = 0;
  G.ringBackup = {};
  G.baseAlive = true;
  placePlayer(1);
  if (G.players === 2) placePlayer(2);
}

function startGame(mode, players) {
  G.mode = mode;
  G.players = players;
  G.level = 1;
  G.score1 = 0;
  G.score2 = 0;
  G.lives1 = 3;
  G.lives2 = 3;
  G.newHigh = false;
  G.playersArr = [makePlayerTank(1)];
  if (players === 2) G.playersArr.push(makePlayerTank(2));
  loadLevel(1);
  G.state = 'playing';
  canvas.focus();
}

function restart() {
  // Retry THE SAME ROUND (2026-11-17): restore the score and lives from
  // when the round started, then reload that round. Never back to round 1.
  const s = G.roundStart || { level: 1, score1: 0, score2: 0, lives1: 3, lives2: 3 };
  G.score1 = s.score1;
  G.score2 = s.score2;
  G.lives1 = s.lives1;
  G.lives2 = s.lives2;
  G.newHigh = false;
  loadLevel(s.level);
  G.state = 'playing';
  canvas.focus();
}

function toTitle() {
  G.state = 'title';
  initDemo();
}

function nextLevel() {
  G.level++;
  loadLevel(G.level);
  G.state = 'playing';
}

function levelClear() {
  G.clearBonus = 500 * (G.lives1 + G.lives2);
  if (G.players === 2) {
    const half = Math.floor(G.clearBonus / 2);
    G.score1 += half;
    G.score2 += G.clearBonus - half;
  } else {
    G.score1 += G.clearBonus;
  }
  G.state = 'levelclear';
  G.levelClearTimer = 2.5;
  sfxLevelClear();
}

function gameOver(reason) {
  if (G.state === 'gameover') return;
  G.state = 'gameover';
  G.overReason = reason;
  const total = G.score1 + G.score2;
  if (total > G.highScore) {
    G.highScore = total;
    G.newHigh = true;
    try {
      localStorage.setItem('tnb_highscore', String(total));
    } catch (e) {
      // Storage may be unavailable; the score still shows.
    }
  }
  sfxGameOver();
}

function destroyBase() {
  if (!G.baseAlive) return;
  G.baseAlive = false;
  const c = tileCenter(BASE_ROW, BASE_COL);
  burst(G, c.x, c.y, true);
  shake(G, 8, 0.3);
  sfxBaseAlarm();
  setTile(G.grid, BASE_ROW, BASE_COL, '.');
  gameOver('base');
}

function addFloat(x, y, text, color) {
  G.floats.push({ x, y, text, t: 1.2, color: color || '#ffffff' });
}

function killEnemy(e, owner) {
  if (!e.alive) return;
  e.alive = false;
  burst(G, e.x, e.y, e.kind === 'big');
  shake(G, 6, 0.15);
  sfxExplode(G.mode);
  addFloat(e.x, e.y - 26, '+' + e.score, '#ffd23f');
  if (owner && owner.side === 'player') {
    if (owner.player === 1) G.score1 += e.score;
    else G.score2 += e.score;
  }
  if (e.carrier) dropPowerup(G);
}

function bossDefeated(owner) {
  const b = G.boss;
  if (!b || !b.alive) return;
  b.alive = false;
  // The fight is over: clear every bullet in flight, so a stray shot
  // cannot destroy the base (or the player) during the victory banner.
  G.bullets = [];
  burst(G, b.x, b.y, true);
  shake(G, 8, 0.3);
  sfxBigExplode();
  const isP2 = owner && owner.side === 'player' && owner.player === 2;
  if (isP2) G.score2 += 5000;
  else G.score1 += 5000;
  // +1 LIFE for the player who landed the killing blow (max 5 lives;
  // +1000 points instead when already at max).
  if (owner && owner.side === 'player') {
    if (owner.player === 2) {
      if (G.lives2 < 5) { G.lives2++; addFloat(b.x, b.y - 26, '+1 LIFE', '#7dff6a'); }
      else G.score2 += 1000;
    } else {
      if (G.lives1 < 5) { G.lives1++; addFloat(b.x, b.y - 26, '+1 LIFE', '#7dff6a'); }
      else G.score1 += 1000;
    }
  }
  G.bossState = 'defeated';
  G.bossTimer = 3.0;
}

function killPlayer(p) {
  if (!p.alive || p.helmetT > 0) return;
  p.alive = false;
  p.star = 0;
  burst(G, p.x, p.y, false);
  shake(G, 6, 0.15);
  sfxExplode(G.mode);
  if (p.player === 1) {
    G.lives1--;
    if (G.lives1 > 0) p.respawnT = 2;
  } else {
    G.lives2--;
    if (G.lives2 > 0) p.respawnT = 2;
  }
  const p1out = !G.playersArr[0].alive && G.lives1 <= 0;
  const p2out = G.players === 2 ? !G.playersArr[1].alive && G.lives2 <= 0 : true;
  if (p1out && p2out) gameOver('players');
}

function respawnPlayer(p) {
  const fresh = makePlayerTank(p.player);
  fresh.star = 0;
  G.playersArr[p.player - 1] = fresh;
}

// ---- Input ----
const keys = new Set();
let lastDir1 = null;
let lastDir2 = null;
// Mouse / touch fire for P1: hold to repeat, exactly like SPACE.
let mouseFire = false;
let touchFire = false;
// The on-screen FIRE button shows on touch devices and small screens;
// on a desktop with a mouse it stays hidden.
const IS_TOUCH =
  ('ontouchstart' in window) ||
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
const SHOW_FIRE = IS_TOUCH || window.innerWidth < 1000;
const P1_DIRS = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
const P2_DIRS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

function toggleMute() {
  G.muted = !G.muted;
  audioSetMuted(G.muted);
}

function currentDir(player) {
  // The touch joystick steers P1 while a drag is active.
  if (player === 1 && joyDir !== null) return joyDir;
  // In 1P mode the arrow keys also drive P1; in 2P mode they stay
  // P2-only (arrows are P2's controls there).
  const map = player === 1
    ? (G.players === 1 ? { ...P1_DIRS, ...P2_DIRS } : P1_DIRS)
    : P2_DIRS;
  const last = player === 1 ? lastDir1 : lastDir2;
  const order = [];
  if (last && keys.has(last)) order.push(last);
  for (const code of Object.keys(map)) {
    if (code !== last && keys.has(code)) order.push(code);
  }
  return order.length ? map[order[0]] : null;
}

window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (G.state === 'title') {
    if (e.code === 'Digit1') G.players = 1;
    else if (e.code === 'Digit2') G.players = 2;
    else if (e.code === 'KeyC') G.mode = 'classic';
    else if (e.code === 'KeyO') G.mode = 'pro';
    else if (e.code === 'Enter') startGame(G.mode, G.players);
    else if (P1_DIRS[e.code] !== undefined || P2_DIRS[e.code] !== undefined) {
      // A movement key starts the game at once and keeps steering: the
      // key is already in `keys`, and lastDir is set here because the
      // early return below skips the tracking at the end of the handler.
      if (P1_DIRS[e.code] !== undefined) lastDir1 = e.code;
      if (P2_DIRS[e.code] !== undefined) {
        lastDir2 = e.code;
        if (G.players === 1) lastDir1 = e.code;
      }
      startGame(G.mode, G.players);
    }
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.state === 'playing') G.state = 'paused';
    else if (G.state === 'paused') G.state = 'playing';
    else if (G.state === 'gameover' && e.code === 'Escape') toTitle();
    return;
  }
  if (G.state === 'gameover' && e.code === 'KeyR') {
    restart();
    return;
  }
  if (G.state === 'levelclear' && (e.code === 'Enter' || e.code === 'Space')) {
    nextLevel();
    return;
  }
  if (P1_DIRS[e.code] !== undefined) lastDir1 = e.code;
  if (P2_DIRS[e.code] !== undefined) {
    lastDir2 = e.code;
    // In 1P mode the arrows steer P1 too (last-pressed-wins, like WASD).
    if (G.players === 1) lastDir1 = e.code;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

canvas.addEventListener('click', (e) => {
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  if (hitMute(x, y)) {
    toggleMute();
    return;
  }
  if (G.state === 'title') {
    const act = titleClick(G, x, y);
    if (act === 'mode-classic') G.mode = 'classic';
    else if (act === 'mode-pro') G.mode = 'pro';
    else if (act === 'players-1') G.players = 1;
    else if (act === 'players-2') G.players = 2;
    else if (act === 'start') startGame(G.mode, G.players);
  } else if (G.state === 'paused') {
    G.state = 'playing';
  } else if (G.state === 'levelclear') {
    nextLevel();
  } else if (G.state === 'gameover') {
    const act = gameOverClick(G, x, y);
    if (act === 'restart') restart();
    else if (act === 'menu') toTitle();
  }
});

// Left mouse click fires P1 (hold to repeat). The shot goes in the tank's
// current facing direction, exactly like SPACE — the mouse never aims.
// Button hit-testing lives in the click handler above, so a click on a
// button never also fires: mousedown only acts during play and never on
// the mute button.
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const { x, y } = canvasPos(e);
  if (hitMute(x, y)) return;
  if (G.state !== 'playing') return;
  ensureAudio();
  mouseFire = true;
  firePlayerBullet(G.playersArr[0]);
});
window.addEventListener('mouseup', () => { mouseFire = false; });
window.addEventListener('blur', () => {
  mouseFire = false; touchFire = false;
  joyId = null; joyBase = null; joyKnob = null; joyDir = null; fireId = null;
});

// Touch: the on-screen FIRE button shoots (tap or hold), and the LEFT
// half of the screen is a virtual joystick that steers P1. Both are
// tracked independently by touch identifier, so a player can steer with
// one thumb and shoot with the other. Taps anywhere else fall through
// to the click handler (title / pause / game over buttons).
const JOY_R = 60;    // joystick base radius (canvas px)
const JOY_KNOB = 26; // knob radius
const JOY_DEAD = 12; // dead zone: smaller drags do not steer
let joyId = null;    // identifier of the steering touch, or null
let joyBase = null;  // {x, y} canvas coords where the finger landed
let joyKnob = null;  // {x, y} canvas coords of the knob
let joyDir = null;   // 0..3 while steering, else null
let fireId = null;   // identifier of the FIRE touch, or null

function joyUpdate(p) {
  let dx = p.x - joyBase.x;
  let dy = p.y - joyBase.y;
  const len = Math.hypot(dx, dy);
  if (len > JOY_R) { dx = dx / len * JOY_R; dy = dy / len * JOY_R; }
  joyKnob = { x: joyBase.x + dx, y: joyBase.y + dy };
  if (Math.hypot(dx, dy) < JOY_DEAD) { joyDir = null; return; }
  joyDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
}

canvas.addEventListener('touchstart', (e) => {
  // On non-playing screens, touches fall through to the click handler
  // so title/pause/game-over buttons keep working.
  if (G.state !== 'playing') return;
  for (const t of e.changedTouches) {
    const { x, y } = canvasPos(t);
    if (hitFire(x, y) && fireId === null) {
      fireId = t.identifier;
      e.preventDefault();
      ensureAudio();
      touchFire = true;
      firePlayerBullet(G.playersArr[0]);
    } else if (x < canvas.width / 2 && joyId === null) {
      // Left half: virtual joystick. The base appears where the finger
      // lands and the knob follows it.
      joyId = t.identifier;
      joyBase = { x, y };
      joyKnob = { x, y };
      joyDir = null;
      e.preventDefault();
      ensureAudio();
    }
    // Right half outside FIRE: ignored here — the click handler still
    // sees it (e.g. the mute button).
  }
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  if (G.state !== 'playing') return;
  for (const t of e.changedTouches) {
    if (t.identifier === joyId && joyBase) {
      e.preventDefault();
      joyUpdate(canvasPos(t));
    }
  }
}, { passive: false });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) {
      joyId = null; joyBase = null; joyKnob = null; joyDir = null;
    }
    if (t.identifier === fireId) {
      fireId = null;
      touchFire = false;
    }
  }
}
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

// ---- Per-frame updates ----
function countPlayerBullets(p) {
  let n = 0;
  for (const b of G.bullets) if (b.side === 'player' && b.owner === p) n++;
  return n;
}

function countEnemyBullets(e) {
  let n = 0;
  for (const b of G.bullets) if (b.side === 'enemy' && b.owner === e) n++;
  return n;
}

// One P1 shot: shared by SPACE, mouse click and the touch FIRE button.
function firePlayerBullet(p) {
  if (!p || !p.alive) return false;
  if (!canFire(p, countPlayerBullets(p))) return false;
  const st = playerBulletStats(p);
  const b = fireBullet(p, st.speed, st.steel);
  G.bullets.push(b);
  p.fireCd = 0.18;
  muzzle(G, b.x, b.y);
  smokePuff(G, b.x, b.y, false);
  shake(G, 2, 0.08);
  sfxShoot(G.mode);
  return true;
}

function updatePlayer(p, dt) {
  if (!p.alive) {
    if (p.respawnT > 0) {
      p.respawnT -= dt;
      if (p.respawnT <= 0 && (p.player === 1 ? G.lives1 > 0 : G.lives2 > 0)) {
        respawnPlayer(p);
      }
    }
    return;
  }
  p.protectT = Math.max(0, p.protectT - dt);
  p.helmetT = Math.max(0, p.helmetT - dt);
  p.flashT = Math.max(0, p.flashT - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.recoilT = Math.max(0, p.recoilT - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);
  const dir = currentDir(p.player);
  const ice = onIce(G.grid, p);
  const rate = ice ? 4 : 20;
  if (dir !== null) {
    snapTurn(p, dir);
    p.moveSpeed = (p.moveSpeed || 0) + (p.speed - (p.moveSpeed || 0)) * Math.min(1, rate * dt);
  } else {
    p.moveSpeed = (p.moveSpeed || 0) + (0 - (p.moveSpeed || 0)) * Math.min(1, rate * dt);
  }
  if (p.moveSpeed > 1) {
    const others = [...G.playersArr, ...G.enemies, ...(G.boss && G.boss.alive ? [G.boss] : [])];
    const moved = moveTank(G.grid, p, p.moveSpeed * dt, others);
    if (!moved) p.moveSpeed = 0;
  }
  p.vx = DIRS[p.dir].x * (p.moveSpeed || 0);
  p.vy = DIRS[p.dir].y * (p.moveSpeed || 0);
  const firing = p.player === 1
    ? (keys.has('Space') || mouseFire || touchFire)
    : keys.has('Enter');
  if (firing) firePlayerBullet(p);
}

function updateEnemy(e, dt) {
  if (!e.alive) return;
  e.protectT = Math.max(0, e.protectT - dt);
  e.flashT = Math.max(0, e.flashT - dt);
  e.fireCd = Math.max(0, e.fireCd - dt);
  e.recoilT = Math.max(0, e.recoilT - dt);
  e.muzzleT = Math.max(0, e.muzzleT - dt);
  const act = updateEnemyAI(G, e, dt);
  const others = [...G.playersArr, ...G.enemies, ...(G.boss && G.boss.alive ? [G.boss] : [])];
  const moved = moveTank(G.grid, e, e.speed * dt, others);
  if (!moved) e.aiT = 0;
  if (act === 'shoot' && canFire(e, countEnemyBullets(e))) {
    const b = fireBullet(e, e.bulletSpeed, false);
    G.bullets.push(b);
    e.fireCd = 0.3;
    smokePuff(G, b.x, b.y, false);
    sfxEnemyShoot(G.mode);
  }
}

function updateBoss(dt) {
  const b = G.boss;
  if (!b || !b.alive) return;
  if (G.bossState === 'warning') return;
  b.protectT = Math.max(0, b.protectT - dt);
  b.flashT = Math.max(0, b.flashT - dt);
  b.recoilT = Math.max(0, b.recoilT - dt);
  b.muzzleT = Math.max(0, b.muzzleT - dt);
  b.blockCd = Math.max(0, (b.blockCd || 0) - dt);
  updateBossAI(G, b, dt); // chase the nearest player (+ unstuck reverse)
  const others = [...G.playersArr, ...G.enemies, b];
  const ox = b.x;
  const oy = b.y;
  moveTank(G.grid, b, b.speed * dt, others);
  const disp = Math.hypot(b.x - ox, b.y - oy);
  const step = b.speed * dt;
  if (disp < Math.max(0.25, step * 0.25) && b.unstuckT <= 0 && b.blockCd <= 0) {
    // Physically blocked: turn NOW instead of pushing into the wall
    // until the next AI timer fires. blockCd stops flip-flopping.
    bossTurnNow(G, b);
    b.blockCd = 0.3;
  }
  bossWatchdog(G, b, dt, disp);
  b.shootT -= dt;
  if (b.shootT <= 0) {
    b.shootT = b.shootInterval || 1.6;
    bossShoot(G, b);
    sfxEnemyShoot(G.mode);
  }
}

function updatePlaying(dt) {
  // Shovel timer.
  if (G.shovelTimer > 0) {
    G.shovelTimer -= dt;
    if (G.shovelTimer <= 0) setRingSteel(G, false);
  }
  // Players.
  for (const p of G.playersArr) updatePlayer(p, dt);
  // Enemies.
  for (const e of G.enemies) updateEnemy(e, dt);
  updateBoss(dt);
  // Bullets and their collisions.
  const ev = stepBullets(G, dt);
  if (ev.baseHit) destroyBase();
  for (const { bullet, tank } of ev.tankHits) {
    if (!tank.alive) continue;
    if (tank.side === 'enemy') {
      tank.hp -= 1;
      tank.flashT = 0.15;
      if (tank.hp <= 0) {
        if (tank.kind === 'boss') bossDefeated(bullet.owner);
        else killEnemy(tank, bullet.owner);
      } else {
        sfxHit();
      }
    } else if (tank.helmetT > 0) {
      sfxHit(); // shield absorbs the shot
    } else {
      killPlayer(tank);
    }
  }
  if (ev.tilesBroken.length) sfxHit();
  if (G.state !== 'playing') return;
  // Power-up pickups and expiry.
  for (const pu of G.powerups) {
    if (!pu.alive) continue;
    pu.t -= dt;
    if (pu.t <= 0) {
      pu.alive = false;
      continue;
    }
    for (const p of G.playersArr) {
      if (!p.alive) continue;
      const pt = tileOf(p.x, p.y);
      if (pt.row === pu.row && pt.col === pu.col) {
        const before = G.enemies.filter((e) => e.alive);
        const res = applyPowerup(G, p, pu.type);
        pu.alive = false;
        addFloat(p.x, p.y - 30, res.label, '#ffd23f');
        if (p.player === 1) G.score1 += res.score;
        else G.score2 += res.score;
        for (const e of before) {
          if (!e.alive) {
            burst(G, e.x, e.y, false);
            addFloat(e.x, e.y - 26, '+' + e.score, '#ffd23f');
          }
        }
        if (G.pendingBossKill) {
          G.pendingBossKill = false;
          if (G.boss && G.boss.alive) bossDefeated(p);
        }
        sfxPowerup();
        break;
      }
    }
  }
  G.powerups = G.powerups.filter((pu) => pu.alive);
  // Spawning.
  G.spawnTimer -= dt;
  const aliveCount = G.enemies.filter((e) => e.alive).length;
  if (G.queueIndex < G.queue.length && aliveCount < maxAlive(G.level) && G.spawnTimer <= 0) {
    const spawned = spawnEnemy(G, G.queue[G.queueIndex]);
    if (spawned) {
      G.queueIndex++;
      G.spawnTimer = spawnInterval(G.level);
    } else {
      G.spawnTimer = 0.5;
    }
  }
  G.enemies = G.enemies.filter((e) => e.alive);
  // Boss flow and level clear.
  if (G.bossState === 'warning') {
    G.bossTimer -= dt;
    if (G.bossTimer <= 0) G.bossState = 'active';
  } else if (G.bossState === 'defeated') {
    G.bossTimer -= dt;
    if (G.bossTimer <= 0) levelClear();
  } else if (G.bossState === 'none') {
    const queueDone = G.queueIndex >= G.queue.length;
    const enemiesGone = G.enemies.length === 0;
    if (queueDone && enemiesGone && isBossLevel(G.level)) {
      // Every round ends with a boss (2026-11-17): clearing the queue
      // alone never advances the level.
      G.bossState = 'warning';
      G.bossTimer = 1.5;
      spawnBoss(G);
      shake(G, 4, 0.25);
      sfxBossWarn();
    }
  }
  stepParticles(G, dt);
  updateFloats(dt);
}

function updateFloats(dt) {
  for (const f of G.floats) {
    f.t -= dt;
    f.y -= 22 * dt;
  }
  G.floats = G.floats.filter((f) => f.t > 0);
}

function updateCamera() {
  const alive = G.playersArr.filter((p) => p.alive);
  if (!alive.length) return;
  let cx = 0;
  let cy = 0;
  for (const p of alive) {
    cx += p.x;
    cy += p.y;
  }
  cx /= alive.length;
  cy /= alive.length;
  G.camX = clamp(cx - ORIGIN_X - VIEW_W / 2, 0, CAM_MAX);
  G.camY = clamp(cy - ORIGIN_Y - VIEW_H / 2, 0, CAM_MAX);
}

function update(dt) {
  G.time += dt;
  stepSmoke(G, dt);
  if (G.shakeT > 0) {
    G.shakeT -= dt;
    if (G.shakeT <= 0) G.shakeMag = 0;
  }
  if (G.state === 'title') {
    updateDemo(dt);
  } else if (G.state === 'playing') {
    updatePlaying(dt);
    updateCamera();
  } else if (G.state === 'levelclear') {
    stepParticles(G, dt);
    updateFloats(dt);
    G.levelClearTimer -= dt;
    if (G.levelClearTimer <= 0) nextLevel();
  } else if (G.state === 'gameover') {
    stepParticles(G, dt);
    updateFloats(dt);
  }
  // Paused: frozen.
}

// ---- Title demo tanks ----
function initDemo() {
  G.camX = 0;
  G.camY = 0;
  G.demoGrid = Array.from({ length: 19 }, () => Array(19).fill('.'));
  const colors = ['#3a4438', '#8a7a52', '#3c3f45'];
  G.demoTanks = [];
  for (let i = 0; i < 3; i++) {
    const t = makeTank({
      kind: 'basic',
      side: 'enemy',
      x: 420 + i * 220,
      y: 220 + i * 110,
      dir: i % 4,
      speed: 60,
      hp: 1,
      color: colors[i],
      color2: '#22222a',
    });
    t.aiT = rand(0.5, 1.5);
    G.demoTanks.push(t);
  }
}

function updateDemo(dt) {
  for (const t of G.demoTanks) {
    t.aiT -= dt;
    if (t.aiT <= 0) {
      t.aiT = rand(1.0, 2.0);
      t.dir = Math.floor(rand(0, 4));
    }
    moveTank(G.demoGrid, t, t.speed * dt, G.demoTanks);
  }
}

// ---- Render ----
// Virtual joystick overlay: a subtle base + knob in screen space, only
// while a steering touch is active. It lives where the thumb already
// is, so it never covers the playfield center.
function drawJoystick(ctx) {
  if (joyBase === null || joyKnob === null) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joyBase.x, joyBase.y, JOY_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(joyKnob.x, joyKnob.y, JOY_KNOB, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.save();
  if (G.shakeT > 0 && G.shakeMag > 0) {
    ctx.translate(rand(-G.shakeMag, G.shakeMag), rand(-G.shakeMag, G.shakeMag));
  }
  ctx.fillStyle = G.mode === 'pro' ? '#0a0503' : '#04060f';
  ctx.fillRect(-24, -24, 1328, 768);
  // War battlefield: pre-rendered static ground + edge ruins. The edge
  // layer is screen-space; the world layer scrolls with the camera.
  // Only the smoke puffs and fires animate, behind the tiles.
  ensureBackground(G);
  drawEdgeLayer(ctx, G);
  // The world (background ground, tiles, tanks, bullets, smoke, fires)
  // is clipped to the 624x624 playfield window at (328,76): the world is
  // 912x912, so without the clip it would paint over the side strips.
  ctx.save();
  ctx.beginPath();
  ctx.rect(ORIGIN_X, ORIGIN_Y, VIEW_W, VIEW_H);
  ctx.clip();
  ctx.translate(-G.camX, -G.camY);
  drawWorldLayer(ctx, G);
  drawSmokeAndFires(ctx, G);
  if (G.state === 'title') {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const t of G.demoTanks) drawTank(ctx, G, t);
    ctx.restore();
  } else {
    drawTiles(ctx, G);
    drawPowerups(ctx, G);
    for (const p of G.playersArr) drawTank(ctx, G, p);
    for (const e of G.enemies) drawTank(ctx, G, e);
    if (G.boss) drawTank(ctx, G, G.boss);
    drawBullets(ctx, G);
    drawGrassOver(ctx, G);
    drawParticles(ctx, G);
    drawFloats(ctx, G);
  }
  ctx.restore();
  if (G.state === 'title') {
    drawTitle(ctx, G);
  } else {
    drawSideStrips(ctx, G);
    drawHUD(ctx, G);
    if (SHOW_FIRE && G.state === 'playing') drawFireButton(ctx, G);
    if (G.state === 'playing') drawJoystick(ctx);
    if (G.boss && G.boss.alive && G.bossState !== 'none') drawBossBar(ctx, G);
    if (G.bossState === 'warning') drawBanner(ctx, 'BOSS ROUND ' + G.level + ' APPEARED!', '#ff2d5d');
    if (G.bossState === 'defeated') drawBanner(ctx, 'BOSS DEFEATED! NEXT ROUND', '#ffd23f');
    if (G.state === 'paused') drawPaused(ctx, G);
    else if (G.state === 'levelclear') drawLevelClear(ctx, G);
    else if (G.state === 'gameover') drawGameOver(ctx, G);
  }
  ctx.restore();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

initDemo();
requestAnimationFrame(frame);

// ---- Test hooks (window.__game) ----
window.__game = {
  get state() { return G.state; },
  get mode() { return G.mode; },
  get camera() { return { x: G.camX, y: G.camY }; },
  get mapCols() { return COLS; },
  get mapRows() { return ROWS; },
  get players() { return G.players; },
  get score() { return G.score1; },
  get score2() { return G.score2; },
  get level() { return G.level; },
  get lives() { return G.lives1; },
  get lives2() { return G.lives2; },
  get enemies() {
    return G.enemies.filter((e) => e.alive).length + (G.boss && G.boss.alive ? 1 : 0);
  },
  get queueLeft() { return G.queue.length - G.queueIndex; },
  get bossHp() { return G.boss ? Math.max(0, G.boss.hp) : null; },
  get bossName() { return G.boss ? G.boss.name : null; },
  get bossState() { return G.bossState; },
  get boss() {
    const b = G.boss;
    return b ? {
      x: Math.round(b.x), y: Math.round(b.y), dir: b.dir,
      hp: b.hp, alive: b.alive, unstuck: b.unstuck || 0,
    } : null;
  },
  get bossUnstuck() { return G.boss ? (G.boss.unstuck || 0) : 0; },
  get baseAlive() { return G.baseAlive; },
  get highScore() { return G.highScore; },
  get muted() { return G.muted; },
  get starLevel() { const p = G.playersArr[0]; return p ? p.star : 0; },
  get helmet() { const p = G.playersArr[0]; return p ? Math.max(0, p.helmetT) : 0; },
  get shovel() { return Math.max(0, G.shovelTimer); },
  get bullets() {
    return G.bullets.filter((b) => b.alive).map((b) => ({
      x: Math.round(b.x), y: Math.round(b.y),
      vx: Math.round(b.vx), vy: Math.round(b.vy), side: b.side,
    }));
  },
  get powerups() { return G.powerups.filter((p) => p.alive).length; },
  get enemyList() {
    return G.enemies.filter((e) => e.alive).map((e) => ({
      x: Math.round(e.x), y: Math.round(e.y), kind: e.kind, carrier: e.carrier,
      color: e.color, speed: Math.round(e.speed),
    }));
  },
  get fires() { return G.fires.length; },
  get smoke() { return G.smoke.length; },
  get banner() {
    if (G.bossState === 'warning') return 'BOSS ROUND ' + G.level + ' APPEARED!';
    if (G.bossState === 'defeated') return 'BOSS DEFEATED! NEXT ROUND';
    return null;
  },
  get fireButton() {
    return {
      visible: SHOW_FIRE,
      x: FIRE_RECT.x, y: FIRE_RECT.y, w: FIRE_RECT.w, h: FIRE_RECT.h,
    };
  },
  get joy() {
    return joyId === null ? null : { dir: joyDir, x: Math.round(joyBase.x), y: Math.round(joyBase.y) };
  },
  get p1() {
    const p = G.playersArr[0];
    return p ? { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, alive: p.alive, dist: Math.round(p.dist || 0) } : null;
  },
  get p2() {
    const p = G.playersArr[1];
    return p ? { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, alive: p.alive } : null;
  },
  start(mode, players) { startGame(mode, players); },
  toggleMute() { toggleMute(); },
  spawnBossNow() {
    if (G.state !== 'playing') return;
    if (!G.boss || !G.boss.alive) {
      spawnBoss(G);
      G.bossState = 'active';
    }
  },
  hurtBase() { destroyBase(); },
  killAllEnemies() {
    for (const e of G.enemies) {
      if (e.alive) {
        e.alive = false;
        burst(G, e.x, e.y, false);
      }
    }
    G.enemies = [];
  },
  givePowerup(type) {
    const p = G.playersArr[0];
    if (!p || !p.alive) return;
    const res = applyPowerup(G, p, type);
    if (p.player === 1) G.score1 += res.score;
    addFloat(p.x, p.y - 30, res.label, '#ffd23f');
    if (G.pendingBossKill) {
      G.pendingBossKill = false;
      if (G.boss && G.boss.alive) bossDefeated(p);
    }
  },
  setLives(n) { G.lives1 = n; },
  restart() { restart(); },
  // Test-only helpers.
  setLevel(n) {
    G.level = n;
    loadLevel(n);
    G.state = 'playing';
  },
  hurtBoss(n) {
    if (G.boss && G.boss.alive) {
      G.boss.hp -= n;
      G.boss.flashT = 0.15;
      if (G.boss.hp <= 0) bossDefeated(G.playersArr[0]);
    }
  },
  warp(x, y, dir) {
    const p = G.playersArr[0];
    if (!p) return;
    p.x = x;
    p.y = y;
    p.moveSpeed = 0;
    if (dir !== undefined) p.dir = dir;
  },
  // Test-only: teleport the boss (resets watchdog state so the move
  // itself is not read as "stuck").
  warpBoss(x, y, dir) {
    const b = G.boss;
    if (!b) return;
    b.x = x;
    b.y = y;
    if (dir !== undefined) b.dir = dir;
    b.stillT = 0;
    b.lastX = x;
    b.lastY = y;
    b.unstuckT = 0;
    b.blockCd = 0;
    b.path = null;
    b.pathT = 0;
  },
  warpP2(x, y, dir) {
    const p = G.playersArr[1];
    if (!p) return;
    p.x = x;
    p.y = y;
    p.moveSpeed = 0;
    if (dir !== undefined) p.dir = dir;
  },
  spawnEnemy(type, carrier) {
    return !!spawnEnemy(G, { type: type || 'basic', carrier: !!carrier });
  },
  skipQueue() { G.queueIndex = G.queue.length; },
  tileAt(row, col) { return tileAt(G.grid, row, col); },
  p1Tile() {
    const p = G.playersArr[0];
    if (!p) return null;
    const t = tileOf(p.x, p.y);
    return { row: t.row, col: t.col, tile: tileAt(G.grid, t.row, t.col) };
  },
};
window.__gameReady = true;
