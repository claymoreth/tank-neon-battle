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
import { isBossLevel, spawnBoss, bossShoot } from './boss.js';
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
}

function restart() {
  startGame(G.mode, G.players);
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
  burst(G, b.x, b.y, true);
  shake(G, 8, 0.3);
  sfxBigExplode();
  if (owner && owner.side === 'player' && owner.player === 2) G.score2 += 5000;
  else G.score1 += 5000;
  G.bossState = 'defeated';
  G.bossTimer = 2.0;
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
  const map = player === 1 ? P1_DIRS : P2_DIRS;
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
  if (P2_DIRS[e.code] !== undefined) lastDir2 = e.code;
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
window.addEventListener('blur', () => { mouseFire = false; touchFire = false; });

// Touch: only the on-screen FIRE button shoots. Taps anywhere else fall
// through to the click handler (title / pause / game over buttons).
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (!t) return;
  const rect = canvas.getBoundingClientRect();
  const x = (t.clientX - rect.left) * (canvas.width / rect.width);
  const y = (t.clientY - rect.top) * (canvas.height / rect.height);
  if (G.state !== 'playing' || !hitFire(x, y)) return;
  e.preventDefault();
  ensureAudio();
  touchFire = true;
  firePlayerBullet(G.playersArr[0]);
}, { passive: false });
canvas.addEventListener('touchend', () => { touchFire = false; });
canvas.addEventListener('touchcancel', () => { touchFire = false; });

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
  updateEnemyAI(G, b, dt, false); // movement only; no shared shoot timer
  const others = [...G.playersArr, ...G.enemies, b];
  moveTank(G.grid, b, b.speed * dt, others);
  b.shootT -= dt;
  if (b.shootT <= 0) {
    b.shootT = 1.6;
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
    if (queueDone && enemiesGone) {
      if (isBossLevel(G.level)) {
        G.bossState = 'warning';
        G.bossTimer = 1.5;
        spawnBoss(G);
        sfxBossWarn();
      } else {
        levelClear();
      }
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
    if (G.boss && G.boss.alive && G.bossState !== 'none') drawBossBar(ctx, G);
    if (G.bossState === 'warning') drawBanner(ctx, 'WARNING: BOSS TANK', '#ff2d5d');
    if (G.bossState === 'defeated') drawBanner(ctx, 'BOSS DEFEATED!', '#ffd23f');
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
    if (G.bossState === 'warning') return 'WARNING: BOSS TANK';
    if (G.bossState === 'defeated') return 'BOSS DEFEATED!';
    return null;
  },
  get fireButton() {
    return {
      visible: SHOW_FIRE,
      x: FIRE_RECT.x, y: FIRE_RECT.y, w: FIRE_RECT.w, h: FIRE_RECT.h,
    };
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
