// All playfield rendering: tiles, the EAGLE base, tanks (classic and
// pro styles, realistic drawing), bullets, power-ups and particles.
// HUD and screens live in hud.js. One job: draw the battle.
import { TILE, ORIGIN_X, ORIGIN_Y, COLS, ROWS, tileAt } from './maps.js';
import { dirAngle } from './util.js';
import { RECOIL_TIME, RECOIL_PX } from './bullet.js';

// Shade a #rrggbb color by a factor (0.5 = darker, 1.3 = lighter).
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// Deterministic pseudo-random from a seed + index (camo blotches).
function seedRand(seed, i) {
  let a = (seed + i * 97 + 13) >>> 0;
  a = (a ^ (a >>> 15)) >>> 0;
  a = Math.imul(a, 2246822519) >>> 0;
  a = (a ^ (a >>> 13)) >>> 0;
  return (a >>> 0) / 4294967296;
}

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
  const pro = G.mode === 'pro';
  ctx.fillStyle = pro ? '#6e2a12' : '#a85b2a';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = pro ? '#a8542a' : '#c97b3d';
  // Brick courses: two rows of two bricks.
  ctx.fillRect(x + 2, y + 2, 21, 20);
  ctx.fillRect(x + 25, y + 2, 21, 20);
  ctx.fillRect(x + 2, y + 26, 21, 20);
  ctx.fillRect(x + 25, y + 26, 21, 20);
  if (pro) {
    ctx.strokeStyle = 'rgba(255,90,40,0.35)';
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  }
}

function drawSteel(ctx, x, y, G) {
  const pro = G.mode === 'pro';
  ctx.fillStyle = pro ? '#1a2430' : '#9aa0ab';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = pro ? '#3d4a5a' : '#c9ced6';
  ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = pro ? '#0c1118' : '#6d727c';
  // Rivets.
  for (const [rx, ry] of [[10, 10], [38, 10], [10, 38], [38, 38]]) {
    ctx.beginPath();
    ctx.arc(x + rx, y + ry, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = pro ? 'rgba(255,120,60,0.4)' : '#565b64';
  ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
}

function drawWater(ctx, x, y, t, G) {
  const pro = G.mode === 'pro';
  ctx.fillStyle = pro ? '#0a1a33' : '#2b6fd6';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = pro ? '#2a6db0' : '#9cc3ff';
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
  const pro = G.mode === 'pro';
  ctx.fillStyle = pro ? '#12283a' : '#bfe8ff';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = pro ? 'rgba(150,200,255,0.5)' : 'rgba(255,255,255,0.6)';
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
  if (G.mode === 'pro') {
    ctx.save();
    ctx.shadowColor = '#ff8c1a';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255,140,26,0.8)';
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
      ctx.fillStyle = G.mode === 'pro' ? 'rgba(46,94,52,0.6)' : 'rgba(63,158,77,0.75)';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = G.mode === 'pro' ? '#3f9e4d' : '#2c7a38';
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

// Hull outline: a beveled trapezoid, narrower at the front (local -y).
function hullPath(ctx, bw, bh) {
  ctx.beginPath();
  ctx.moveTo(-bw / 2, bh / 2);
  ctx.lineTo(bw / 2, bh / 2);
  ctx.lineTo(bw * 0.43, -bh / 2);
  ctx.lineTo(-bw * 0.43, -bh / 2);
  ctx.closePath();
}

export function drawTank(ctx, G, t) {
  if (!t.alive) return;
  // Spawn protection blink.
  if (t.protectT > 0 && Math.floor(G.time * 10) % 2 === 0) return;
  // Carrier flash: blink red.
  const carrierFlash = t.carrier && Math.floor(G.time * 6) % 2 === 0;
  const w = t.w;
  const h = t.h;
  const pro = G.mode === 'pro';
  const body = carrierFlash ? '#ff2d2d' : t.color;
  const dark = shade(body, 0.62);
  const dark2 = shade(body, 0.42);
  const trim = t.color2;
  const barrelCol = '#26262b';
  const barrelDark = '#17171c';

  // PRO players: a thin BLUE GLOW under the tank (ground, unrotated).
  // BLUE = player, always. Enemies never get it.
  if (pro && t.side === 'player') {
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    // Wide but flat: the glow must stick out past the tracks sideways
    // (rx 0.72w) without reaching the barrel-probe radius below the tank
    // (bottom edge y+0.14h+0.34h stays inside 24px).
    ctx.ellipse(t.x, t.y + h * 0.14, w * 0.72, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Shadow: soft dark ellipse under the tank (unrotated, drawn first).
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + h * 0.14, w * 0.56, h * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(dirAngle(t.dir));
  if (pro) ctx.scale(1.1, 1.1);

  // Tracks with tread links that scroll with the distance driven.
  const trackW = w / 5;
  const trackCol = pro ? '#101014' : '#1c1c22';
  const linkCol = pro ? '#2e2e38' : '#3a3a44';
  const linkStep = 11;
  const nLinks = Math.ceil(h / linkStep) + 1;
  const off = (t.dist || 0) % linkStep;
  for (const sx of [-1, 1]) {
    const tx0 = sx < 0 ? -w / 2 : w / 2 - trackW;
    ctx.fillStyle = trackCol;
    ctx.fillRect(tx0, -h / 2, trackW, h);
    ctx.fillStyle = linkCol;
    for (let k = 0; k < nLinks; k++) {
      let ly = -h / 2 + k * linkStep + off;
      if (ly > h / 2) ly -= nLinks * linkStep;
      ctx.fillRect(tx0 + 1, ly - 2.5, trackW - 2, 5);
    }
  }

  // Hull (beveled, narrower at the front).
  const bw = w * 0.62;
  const bh = h * 0.86;
  if (pro) {
    // Thin edge glow only — never a full glow.
    ctx.save();
    ctx.shadowColor = trim;
    ctx.shadowBlur = 6;
    hullPath(ctx, bw, bh);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
  } else {
    hullPath(ctx, bw, bh);
    ctx.fillStyle = body;
    ctx.fill();
  }
  // Camo blotches (seeded per tank, clipped to the hull).
  ctx.save();
  hullPath(ctx, bw, bh);
  ctx.clip();
  const camoCols = [shade(body, 0.5), shade(body, 1.3)];
  for (let i = 0; i < 3; i++) {
    const cx = (seedRand(t.camoSeed || 1, i * 3) - 0.5) * bw * 0.7;
    const cy = (seedRand(t.camoSeed || 1, i * 3 + 1) - 0.5) * bh * 0.7;
    const cr = 4 + seedRand(t.camoSeed || 1, i * 3 + 2) * 5;
    ctx.fillStyle = camoCols[i % 2];
    ctx.beginPath();
    ctx.ellipse(cx, cy, cr, cr * 0.7, seedRand(t.camoSeed || 1, i * 7) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  hullPath(ctx, bw, bh);
  ctx.strokeStyle = dark2;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Player-only: a thin WHITE OUTLINE around the whole tank, so the
  // player's tank is identifiable at a glance. No enemy ever has it.
  if (t.side === 'player') {
    hullPath(ctx, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Bolts along the hull edges.
  ctx.fillStyle = dark2;
  for (const by of [-bh / 4, 0, bh / 4]) {
    for (const bx of [-bw * 0.42, bw * 0.42]) {
      ctx.beginPath();
      ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Headlights at the front.
  ctx.fillStyle = '#fff8c0';
  for (const hx of [-bw * 0.22, bw * 0.22]) {
    ctx.beginPath();
    ctx.arc(hx, -bh / 2 + 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Exhaust pipes at the rear.
  ctx.fillStyle = barrelDark;
  ctx.fillRect(-bw * 0.32, bh / 2 - 3, 6, 5);
  ctx.fillRect(bw * 0.32 - 6, bh / 2 - 3, 6, 5);
  // PRO: thicker exhaust smoke wisps drifting from the rear.
  if (pro) {
    for (let i = 0; i < 2; i++) {
      const wy = bh / 2 + 6 + ((G.time * 9 + i * 9 + (t.id || 0)) % 16);
      ctx.fillStyle = 'rgba(120,120,130,0.30)';
      ctx.beginPath();
      ctx.arc((i === 0 ? -1 : 1) * bw * 0.25, wy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Antenna from the turret's rear.
  ctx.strokeStyle = '#22222a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.08);
  ctx.lineTo(w * 0.24, h / 2 + 2);
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.arc(w * 0.24, h / 2 + 2, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Turret: proportional rounded square with a hatch.
  const tw = w * 0.38;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -tw / 2, tw, tw, 6);
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // Player-only markers (classic): a WHITE STAR on the turret + a small
  // YELLOW light on the turret, so the player's tank reads instantly.
  // No enemy ever has them.
  if (!pro && t.side === 'player') {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 7 : 3;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ffd23f';
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(tw * 0.30, -tw * 0.30, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // PRO: a light on the turret — CYAN for players (BLUE = player),
  // RED for enemies and the boss (RED = enemy). Never reversed.
  if (pro) {
    const lightCol = t.side === 'player' ? '#22d3ee' : '#ff2d3c';
    ctx.save();
    ctx.shadowColor = lightCol;
    ctx.shadowBlur = 6;
    ctx.fillStyle = lightCol;
    ctx.beginPath();
    ctx.arc(w * 0.13, -h * 0.06, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // PRO: front armor spikes.
  if (pro) {
    ctx.fillStyle = trim;
    for (const sx of [-bw * 0.3, 0, bw * 0.3]) {
      ctx.beginPath();
      ctx.moveTo(sx - 4, -bh / 2 + 2);
      ctx.lineTo(sx + 4, -bh / 2 + 2);
      ctx.lineTo(sx, -bh / 2 - 5);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Barrel (longer, thicker, muzzle brake at the tip). It is drawn
  // pointing along local -y and the tank is rotated by dirAngle, so it
  // always faces the tank's direction. Recoil pulls it back ~4 px.
  const recoil = t.recoilT > 0 ? RECOIL_PX * (t.recoilT / RECOIL_TIME) : 0;
  ctx.save();
  ctx.translate(0, recoil);
  if (pro) {
    // Double barrel with a guard bar. The two shafts are joined by a
    // center rib, so the barrel reads as one solid gun at any angle.
    ctx.fillStyle = barrelCol;
    ctx.fillRect(-5.5, -h / 2 - 18, 5, h / 2 + 16);
    ctx.fillRect(0.5, -h / 2 - 18, 5, h / 2 + 16);
    ctx.fillRect(-1.5, -h / 2 - 18, 3, h / 2 + 16);
    ctx.fillStyle = barrelDark;
    ctx.fillRect(-7.5, -h / 2 - 14, 15, 4);
    ctx.fillRect(-8, -h / 2 - 19, 16, 5);
    if (t.kind === 'boss') {
      ctx.fillStyle = barrelCol;
      ctx.fillRect(-14, -h / 2 - 8, 5, h / 2 + 6);
      ctx.fillRect(9, -h / 2 - 8, 5, h / 2 + 6);
    }
  } else {
    ctx.fillStyle = barrelCol;
    ctx.fillRect(-4, -h / 2 - 16, 8, h / 2 + 14);
    // Muzzle brake: a wider ring at the tip.
    ctx.fillStyle = barrelDark;
    ctx.fillRect(-6.5, -h / 2 - 17, 13, 6);
    if (t.kind === 'boss') {
      ctx.fillStyle = barrelCol;
      ctx.fillRect(-13, -h / 2 - 8, 5, h / 2 + 6);
      ctx.fillRect(8, -h / 2 - 8, 5, h / 2 + 6);
    }
  }
  // Muzzle flash: a bright star at the barrel tip for 0.08 s.
  if (t.muzzleT > 0) {
    const tipY = -h / 2 - 20;
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.muzzleT / 0.08);
    ctx.translate(0, tipY);
    ctx.shadowColor = '#ffcf4d';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 9 : 3.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Hit flash (white on damage).
  if (t.flashT > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    hullPath(ctx, bw, bh);
    ctx.fill();
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
    if (G.mode === 'pro') {
      // Light trail.
      if (b.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,180,90,0.55)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (const p of b.trail) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffd9a0';
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
    if (G.mode === 'pro') {
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
    if (p.smoke) {
      // Thin smoke: a soft gray circle that grows as it fades.
      ctx.globalAlpha = Math.max(0, (p.t / p.max) * 0.35);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = Math.max(0, p.t / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
  for (const r of G.rings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, r.t / 0.4);
    ctx.strokeStyle = G.mode === 'pro' ? '#ff7a3c' : '#ffffff';
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
