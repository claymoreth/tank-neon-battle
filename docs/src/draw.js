// All playfield rendering: tiles, the EAGLE base, tanks (classic and
// neon styles), bullets, power-ups and particles. HUD and screens live
// in hud.js. One job: draw the battle.
import { TILE, ORIGIN_X, ORIGIN_Y, COLS, ROWS, tileAt } from './maps.js';
import { dirAngle } from './util.js';

export function drawTiles(ctx, G) {
  const t = G.time;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = G.grid[row][col];
      if (ch === 'G') continue; // grass draws over the tanks, later
      const x = ORIGIN_X + col * TILE;
      const y = ORIGIN_Y + row * TILE;
      if (ch === '#') drawBrick(ctx, x, y, G);
      else if (ch === 'S') drawSteel(ctx, x, y, G);
      else if (ch === 'W') drawWater(ctx, x, y, t, G);
      else if (ch === 'I') drawIce(ctx, x, y, G);
      else if (ch === 'B') drawBase(ctx, x, y, G);
    }
  }
}

function drawBrick(ctx, x, y, G) {
  ctx.fillStyle = G.mode === 'neon' ? '#7a2d12' : '#a85b2a';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = G.mode === 'neon' ? '#ff7b2f' : '#c97b3d';
  // Brick courses: two rows of two bricks.
  ctx.fillRect(x + 2, y + 2, 21, 20);
  ctx.fillRect(x + 25, y + 2, 21, 20);
  ctx.fillRect(x + 2, y + 26, 21, 20);
  ctx.fillRect(x + 25, y + 26, 21, 20);
  if (G.mode === 'neon') {
    ctx.strokeStyle = 'rgba(255,123,47,0.5)';
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  }
}

function drawSteel(ctx, x, y, G) {
  ctx.fillStyle = G.mode === 'neon' ? '#123a4d' : '#9aa0ab';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = G.mode === 'neon' ? '#7fd4ff' : '#c9ced6';
  ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = G.mode === 'neon' ? '#0b2230' : '#6d727c';
  // Rivets.
  for (const [rx, ry] of [[10, 10], [38, 10], [10, 38], [38, 38]]) {
    ctx.beginPath();
    ctx.arc(x + rx, y + ry, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = G.mode === 'neon' ? 'rgba(127,212,255,0.7)' : '#565b64';
  ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
}

function drawWater(ctx, x, y, t, G) {
  ctx.fillStyle = G.mode === 'neon' ? '#062a52' : '#2b6fd6';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = G.mode === 'neon' ? '#4dd2ff' : '#9cc3ff';
  ctx.lineWidth = 2;
  const off = (t * 14) % 24;
  for (let i = 0; i < 2; i++) {
    const yy = y + 14 + i * 20;
    ctx.beginPath();
    for (let px = 0; px <= TILE; px += 6) {
      const wave = Math.sin((px + off) / 8) * 3;
      if (px === 0) ctx.moveTo(x + px, yy + wave);
      else ctx.lineTo(x + px, yy + wave);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

function drawIce(ctx, x, y, G) {
  ctx.fillStyle = G.mode === 'neon' ? '#0e3a56' : '#bfe8ff';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = G.mode === 'neon' ? 'rgba(159,220,255,0.75)' : 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 34);
  ctx.lineTo(x + 26, y + 10);
  ctx.lineTo(x + 40, y + 10);
  ctx.lineTo(x + 20, y + 34);
  ctx.closePath();
  ctx.fill();
}

function drawBase(ctx, x, y, G) {
  // Dark plate.
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.lineWidth = 1;
  // Stylized gold eagle: spread wings, body, head.
  const cx = x + TILE / 2;
  const cy = y + TILE / 2 + 2;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  // Left wing.
  ctx.moveTo(cx - 4, cy - 2);
  ctx.lineTo(cx - 21, cy - 14);
  ctx.lineTo(cx - 17, cy - 2);
  ctx.lineTo(cx - 20, cy + 6);
  ctx.lineTo(cx - 5, cy + 6);
  ctx.closePath();
  ctx.fill();
  // Right wing.
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 2);
  ctx.lineTo(cx + 21, cy - 14);
  ctx.lineTo(cx + 17, cy - 2);
  ctx.lineTo(cx + 20, cy + 6);
  ctx.lineTo(cx + 5, cy + 6);
  ctx.closePath();
  ctx.fill();
  // Body and head.
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - 11, 5, 0, Math.PI * 2);
  ctx.fill();
  // Beak.
  ctx.fillStyle = '#ff8c1a';
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 12);
  ctx.lineTo(cx + 10, cy - 9);
  ctx.lineTo(cx + 4, cy - 8);
  ctx.closePath();
  ctx.fill();
  // Eye.
  ctx.fillStyle = '#1a1a22';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
  if (G.mode === 'neon') {
    ctx.save();
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255,210,63,0.8)';
    ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
    ctx.restore();
  }
}

// Grass is drawn after the tanks so it hides them.
export function drawGrassOver(ctx, G) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (G.grid[row][col] !== 'G') continue;
      const x = ORIGIN_X + col * TILE;
      const y = ORIGIN_Y + row * TILE;
      ctx.fillStyle = G.mode === 'neon' ? 'rgba(57,255,136,0.45)' : 'rgba(63,158,77,0.75)';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = G.mode === 'neon' ? '#39ff88' : '#2c7a38';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const gx = x + 6 + i * 9;
        ctx.beginPath();
        ctx.moveTo(gx, y + TILE - 4);
        ctx.lineTo(gx + 3, y + 12);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
  }
}

export function drawTank(ctx, G, t) {
  if (!t.alive) return;
  // Spawn protection blink.
  if (t.protectT > 0 && Math.floor(G.time * 10) % 2 === 0) return;
  // Carrier flash: blink red.
  const carrierFlash = t.carrier && Math.floor(G.time * 6) % 2 === 0;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(dirAngle(t.dir));
  const w = t.w;
  const h = t.h;
  const neon = G.mode === 'neon';
  if (neon) {
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 16;
  }
  // Tracks.
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-w / 2, -h / 2, w / 5, h);
  ctx.fillRect(w / 2 - w / 5, -h / 2, w / 5, h);
  // Track tread marks.
  ctx.fillStyle = '#3a3a44';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(-w / 2 + 1, i * (h / 5) - 2, w / 5 - 2, 4);
    ctx.fillRect(w / 2 - w / 5 + 1, i * (h / 5) - 2, w / 5 - 2, 4);
  }
  // Body.
  ctx.fillStyle = carrierFlash ? '#ff2d2d' : t.color;
  const bw = w * 0.62;
  const bh = h * 0.86;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  // Boss armor plates.
  if (t.kind === 'boss') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-bw / 2, -bh / 2, bw, 5);
    ctx.fillRect(-bw / 2, bh / 2 - 5, bw, 5);
    ctx.fillStyle = t.color2;
    ctx.fillRect(-bw / 2 + 4, -bh / 2 + 8, bw - 8, 6);
  }
  // Barrel.
  ctx.fillStyle = '#22222a';
  ctx.fillRect(-3, -h / 2 - 8, 6, h / 2 + 6);
  if (t.kind === 'boss') {
    ctx.fillRect(-11, -h / 2 - 6, 5, h / 2 + 4);
    ctx.fillRect(6, -h / 2 - 6, 5, h / 2 + 4);
  }
  // Cockpit.
  ctx.fillStyle = t.color2;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = neon ? '#ffffff' : 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(-2, -2, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Hit flash (white on damage).
  if (t.flashT > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  }
  ctx.restore();
  // Helmet shield ring (unrotated).
  if (t.helmetT > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(77,243,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.w / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Star pips for players.
  if (t.side === 'player' && t.star > 0) {
    ctx.save();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★'.repeat(t.star), t.x, t.y - t.h / 2 - 6);
    ctx.restore();
  }
}

export function drawBullets(ctx, G) {
  for (const b of G.bullets) {
    if (!b.alive) continue;
    if (G.mode === 'neon') {
      // Light trail.
      if (b.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,240,160,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (const p of b.trail) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
  }
}

const POWERUP_COLORS = {
  star: '#ffd23f',
  helmet: '#4dd2ff',
  grenade: '#7dff5e',
  shovel: '#c9ced6',
  life: '#ff5d7a',
};

export function drawPowerups(ctx, G) {
  for (const p of G.powerups) {
    if (!p.alive) continue;
    // Blink in the last 3 seconds.
    if (p.t < 3 && Math.floor(G.time * 5) % 2 === 0) continue;
    const cx = ORIGIN_X + p.col * TILE + TILE / 2;
    const cy = ORIGIN_Y + p.row * TILE + TILE / 2;
    const col = POWERUP_COLORS[p.type] || '#ffffff';
    ctx.save();
    if (G.mode === 'neon') {
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = '#101018';
    ctx.fillRect(cx - 20, cy - 20, 40, 40);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 20, cy - 20, 40, 40);
    ctx.fillStyle = col;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { star: '★', helmet: '◉', grenade: '✹', shovel: '⛏', life: '♥' }[p.type];
    ctx.fillText(glyph, cx, cy + 1);
    ctx.restore();
  }
}

export function drawParticles(ctx, G) {
  for (const p of G.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.t / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
  for (const r of G.rings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.t / 0.4);
    ctx.strokeStyle = G.mode === 'neon' ? '#ff9a3c' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const m of G.muzzles) {
    ctx.save();
    ctx.globalAlpha = m.t / 0.08;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Floating score / pickup texts.
export function drawFloats(ctx, G) {
  ctx.save();
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = Math.max(0, f.t / 1.2);
    ctx.fillStyle = f.color || '#ffffff';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
