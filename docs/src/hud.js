// HUD, title screen, overlays, buttons and the mute button.
// One job: every screen that is not the battle itself.
export const MUTE_RECT = { x: 1236, y: 16, w: 32, h: 28 };

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function hitMute(x, y) {
  return inRect(x, y, MUTE_RECT);
}

// On-screen FIRE button for touch devices: bottom-right of the canvas,
// in the right side strip so it never covers the playfield.
export const FIRE_RECT = { x: 1130, y: 590, w: 130, h: 110 };

export function hitFire(x, y) {
  return inRect(x, y, FIRE_RECT);
}

export function drawFireButton(ctx, G) {
  const r = FIRE_RECT;
  ctx.save();
  ctx.fillStyle = 'rgba(255,93,93,0.25)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#ff5d5d';
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  ctx.fillStyle = '#ff5d5d';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FIRE', r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

export function drawMuteButton(ctx, G) {
  const r = MUTE_RECT;
  ctx.save();
  ctx.fillStyle = 'rgba(16,20,32,0.85)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#4df3ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = G.muted ? '#ff5d5d' : '#4df3ff';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(G.muted ? '✕' : '♪', r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

function padScore(n) {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

function livesIcons(ctx, x, y, lives, color) {
  for (let i = 0; i < lives; i++) {
    const ix = x + i * 22;
    ctx.fillStyle = color;
    ctx.fillRect(ix, y - 6, 16, 12);
    ctx.fillStyle = '#22222a';
    ctx.fillRect(ix + 6, y - 10, 4, 6);
  }
}

export function drawHUD(ctx, G) {
  ctx.save();
  ctx.fillStyle = '#0a0d18';
  ctx.fillRect(0, 0, 1280, 64);
  ctx.fillStyle = '#1e2436';
  ctx.fillRect(0, 64, 1280, 2);
  ctx.font = 'bold 17px monospace';
  ctx.textBaseline = 'middle';
  // P1 score + lives (left).
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('P1  ' + padScore(G.score1), 16, 22);
  livesIcons(ctx, 16, 48, Math.min(5, G.lives1), '#ffd23f');
  // Level + mode (center).
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LEVEL ' + G.level, 560, 22);
  ctx.fillStyle = G.mode === 'neon' ? '#4df3ff' : '#c9ced6';
  ctx.fillText(G.mode === 'neon' ? 'NEON' : 'CLASSIC', 560, 48);
  // Right side: P2 in 2P, HI-SCORE in 1P.
  ctx.textAlign = 'right';
  if (G.players === 2) {
    ctx.fillStyle = '#7dff5e';
    ctx.fillText('P2  ' + padScore(G.score2), 1224, 22);
    livesIcons(ctx, 1224 - Math.min(5, G.lives2) * 22 + 6, 48, Math.min(5, G.lives2), '#7dff5e');
  } else {
    ctx.fillStyle = '#9aa0ab';
    ctx.fillText('HI-SCORE  ' + padScore(Math.max(G.highScore, G.score1)), 1224, 22);
    ctx.fillStyle = '#4df3ff';
    ctx.font = '13px monospace';
    ctx.fillText('M: MUTE   P: PAUSE', 1224, 48);
  }
  ctx.restore();
  drawMuteButton(ctx, G);
}

export function drawSideStrips(ctx, G) {
  ctx.save();
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7d8598';
  const lx = 24;
  ctx.fillText('P1: WASD MOVE', lx, 120);
  ctx.fillText('SPACE / CLICK: FIRE', lx, 142);
  if (G.players === 2) {
    ctx.fillText('P2: ARROWS MOVE', lx, 176);
    ctx.fillText('ENTER: FIRE', lx, 198);
  }
  ctx.fillText('P: PAUSE', lx, 232);
  ctx.fillText('M: MUTE', lx, 254);
  ctx.fillText('DEFEND THE EAGLE!', lx, 300);
  ctx.fillText('IF THE EAGLE FALLS,', lx, 322);
  ctx.fillText('THE GAME IS OVER.', lx, 344);
  // Legend (right strip).
  const rx = 976;
  ctx.fillText('LEGEND', rx, 120);
  const items = [
    ['#c97b3d', 'BRICK - BREAKABLE'],
    ['#c9ced6', 'STEEL - SOLID'],
    ['#3f9e4d', 'GRASS - HIDES YOU'],
    ['#2b6fd6', 'WATER - BLOCKS TANKS'],
    ['#bfe8ff', 'ICE - SLIPPERY'],
  ];
  items.forEach(([c, label], i) => {
    ctx.fillStyle = c;
    ctx.fillRect(rx, 138 + i * 24, 14, 14);
    ctx.fillStyle = '#7d8598';
    ctx.fillText(label, rx + 22, 150 + i * 24);
  });
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('POWER-UPS DROP FROM', rx, 300);
  ctx.fillText('FLASHING RED TANKS', rx, 322);
  ctx.restore();
}

// Big HP bar for the boss, top center over the playfield.
export function drawBossBar(ctx, G) {
  const boss = G.boss;
  if (!boss || !boss.alive) return;
  ctx.save();
  const bw = 400;
  const bx = 640 - bw / 2;
  const by = 82;
  ctx.fillStyle = 'rgba(8,8,16,0.8)';
  ctx.fillRect(bx - 10, by - 22, bw + 20, 46);
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5df2';
  ctx.fillText('BOSS: ' + boss.name, 640, by - 8);
  ctx.fillStyle = '#3a0a12';
  ctx.fillRect(bx, by, bw, 14);
  ctx.fillStyle = '#ff2d5d';
  ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 14);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 13);
  ctx.restore();
}

// ---- Title screen ----
export const TITLE_RECTS = {
  classic: { x: 440, y: 280, w: 180, h: 48 },
  neon: { x: 660, y: 280, w: 180, h: 48 },
  p1: { x: 490, y: 350, w: 120, h: 48 },
  p2: { x: 670, y: 350, w: 120, h: 48 },
  start: { x: 540, y: 430, w: 200, h: 56 },
};

export function titleClick(G, x, y) {
  if (inRect(x, y, TITLE_RECTS.classic)) return 'mode-classic';
  if (inRect(x, y, TITLE_RECTS.neon)) return 'mode-neon';
  if (inRect(x, y, TITLE_RECTS.p1)) return 'players-1';
  if (inRect(x, y, TITLE_RECTS.p2)) return 'players-2';
  if (inRect(x, y, TITLE_RECTS.start)) return 'start';
  return null;
}

function drawButton(ctx, r, label, selected, color) {
  ctx.save();
  ctx.fillStyle = selected ? color : 'rgba(16,20,32,0.9)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = selected ? '#0a0d18' : color;
  ctx.font = 'bold 19px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

export function drawTitle(ctx, G) {
  ctx.save();
  // Dim the demo battle behind the title.
  ctx.fillStyle = 'rgba(4,6,15,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  const neon = G.mode === 'neon';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (neon) {
    ctx.shadowColor = '#4df3ff';
    ctx.shadowBlur = 30;
  }
  ctx.fillStyle = neon ? '#4df3ff' : '#ffd23f';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('TANK NEON BATTLE', 640, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('Battle City 2026', 640, 205);
  ctx.font = '15px monospace';
  ctx.fillStyle = '#9aa0ab';
  ctx.fillText('DEFEND THE EAGLE. DESTROY EVERY WAVE.', 640, 240);
  drawButton(ctx, TITLE_RECTS.classic, 'CLASSIC', G.mode === 'classic', '#ffd23f');
  drawButton(ctx, TITLE_RECTS.neon, 'NEON', neon, '#4df3ff');
  drawButton(ctx, TITLE_RECTS.p1, '1 PLAYER', G.players === 1, '#7dff5e');
  drawButton(ctx, TITLE_RECTS.p2, '2 PLAYERS', G.players === 2, '#7dff5e');
  drawButton(ctx, TITLE_RECTS.start, 'START', false, '#ff5d5d');
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('HI-SCORE  ' + padScore(G.highScore), 640, 525);
  ctx.fillStyle = '#7d8598';
  ctx.font = '15px monospace';
  ctx.fillText('P1: WASD MOVE + SPACE / CLICK FIRE    |    P2: ARROWS MOVE + ENTER FIRE', 640, 600);
  ctx.fillText('1/2 PLAYERS    C CLASSIC    N NEON    ENTER START    P PAUSE    M MUTE', 640, 628);
  ctx.fillText('FLASHING RED TANKS DROP POWER-UPS: STAR, HELMET, GRENADE, SHOVEL, LIFE', 640, 656);
  ctx.restore();
  drawMuteButton(ctx, G);
}

// ---- Overlays ----
export function drawPaused(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,15,0.7)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px monospace';
  ctx.fillText('PAUSED', 640, 330);
  ctx.font = '20px monospace';
  ctx.fillStyle = '#9aa0ab';
  ctx.fillText('PRESS P OR CLICK TO RESUME', 640, 390);
  ctx.restore();
  drawMuteButton(ctx, G);
}

export function drawLevelClear(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,15,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 52px monospace';
  ctx.fillText('LEVEL CLEAR!', 640, 290);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px monospace';
  ctx.fillText('LEVEL BONUS  +' + G.clearBonus, 640, 360);
  ctx.fillStyle = '#9aa0ab';
  ctx.font = '18px monospace';
  ctx.fillText('NEXT LEVEL STARTS SOON...', 640, 410);
  ctx.restore();
  drawMuteButton(ctx, G);
}

export const GAMEOVER_RECTS = {
  restart: { x: 490, y: 470, w: 140, h: 52 },
  menu: { x: 660, y: 470, w: 140, h: 52 },
};

export function gameOverClick(G, x, y) {
  if (inRect(x, y, GAMEOVER_RECTS.restart)) return 'restart';
  if (inRect(x, y, GAMEOVER_RECTS.menu)) return 'menu';
  return null;
}

export function drawGameOver(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,15,0.78)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2d5d';
  ctx.font = 'bold 60px monospace';
  ctx.fillText('GAME OVER', 640, 240);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('SCORE  ' + padScore(G.score1 + G.score2), 640, 320);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '20px monospace';
  ctx.fillText('HI-SCORE  ' + padScore(G.highScore), 640, 360);
  if (G.newHigh) {
    ctx.fillStyle = '#4df3ff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('NEW HIGH SCORE!', 640, 400);
  }
  ctx.fillStyle = '#9aa0ab';
  ctx.font = '18px monospace';
  ctx.fillText('REACHED LEVEL ' + G.level, 640, 435);
  drawButton(ctx, GAMEOVER_RECTS.restart, 'RESTART', false, '#7dff5e');
  drawButton(ctx, GAMEOVER_RECTS.menu, 'MENU', false, '#4df3ff');
  ctx.fillStyle = '#7d8598';
  ctx.font = '15px monospace';
  ctx.fillText('R RESTART    ESC MENU', 640, 560);
  ctx.restore();
  drawMuteButton(ctx, G);
}

// Big center banner texts (boss warning / boss defeated).
export function drawBanner(ctx, text, color) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px monospace';
  ctx.fillStyle = 'rgba(8,8,16,0.75)';
  const w = ctx.measureText(text).width + 60;
  ctx.fillRect(640 - w / 2, 300, w, 84);
  ctx.fillStyle = color;
  if (color === '#ff2d5d' || color === '#ffd23f') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
  }
  ctx.fillText(text, 640, 342);
  ctx.restore();
}
