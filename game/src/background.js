// The war battlefield background, in two layers:
//   - edge layer: screen-space, the arena's surroundings (ruins, sandbags,
//     trenches/bunkers, barbed wire, smoke) around the 624x624 window.
//   - world layer: the ground under the playfield (cracked/muddy ground,
//     craters, tank tracks, bunker/trench decorations, water reflections).
// Both are pre-rendered once per level/mode into offscreen canvases and
// blitted every frame: zero per-frame drawing cost. Only the smoke puffs
// and fires animate (kept in world coordinates so they scroll with the
// camera). Classic = daylight brown/army-green battlefield; PRO = night
// battlefield, a burning ruined city, red/blue emergency glows.
import { TILE, ORIGIN_X, ORIGIN_Y, COLS, ROWS, VIEW_W, VIEW_H } from './maps.js';

function seededRand(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a ^ (a << 13)) >>> 0;
    a = (a ^ (a >>> 17)) >>> 0;
    a = (a ^ (a << 5)) >>> 0;
    return (a >>> 0) / 4294967296;
  };
}

export function ensureBackground(G) {
  const key = G.level + '|' + G.mode + '|19';
  if (G.bgKey === key && G.bgEdge && G.bgWorld) return;
  G.bgKey = key;
  G.bgEdge = renderEdge(G);
  G.bgWorld = renderWorld(G);
  // Animated elements, refreshed each level (world coordinates).
  const rand = seededRand(G.level * 7919 + (G.mode === 'pro' ? 13 : 7));
  G.smoke = [];
  G.fires = [];
  // Smoke drifts above the ground around the whole playfield.
  for (let i = 0; i < 14; i++) {
    G.smoke.push({
      x: ORIGIN_X + rand() * COLS * TILE,
      y: ORIGIN_Y + rand() * ROWS * TILE,
      r: 22 + rand() * 34,
      speed: 6 + rand() * 10,
      a: 0.05 + rand() * 0.06,
      phase: rand() * Math.PI * 2,
    });
  }
  // Fires: classic has a few small ground fires; PRO is a burning city,
  // so more fires, bigger and brighter.
  const pro = G.mode === 'pro';
  const n = pro ? 10 : 5;
  for (let i = 0; i < n; i++) {
    G.fires.push({
      x: ORIGIN_X + 40 + rand() * (COLS * TILE - 80),
      y: ORIGIN_Y + 40 + rand() * (ROWS * TILE - 80),
      r: pro ? 8 + rand() * 10 : 5 + rand() * 6,
      phase: rand() * Math.PI * 2,
    });
  }
}

// ---- Edge layer (screen-space, 1280x720) ----
function renderEdge(G) {
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext('2d');
  const pro = G.mode === 'pro';
  const rand = seededRand(G.level * 104729 + (pro ? 29 : 11));
  // Ground: classic daylight; PRO night.
  ctx.fillStyle = pro ? '#0b0604' : '#3a2f22';
  ctx.fillRect(0, 0, 1280, 720);
  // Ground mottling.
  for (let i = 0; i < 500; i++) {
    const x = rand() * 1280;
    const y = rand() * 720;
    const r = 4 + rand() * 18;
    ctx.fillStyle = pro
      ? `rgba(${20 + rand() * 30},${10 + rand() * 14},${6 + rand() * 10},0.5)`
      : `rgba(${50 + rand() * 40},${40 + rand() * 30},${25 + rand() * 20},0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ruined buildings ringing the arena (screen-space frame).
  drawRuins(ctx, rand, pro);
  // Sandbags along the top and bottom edges.
  drawSandbags(ctx, rand, pro, 0, 0, 1280, 40);
  drawSandbags(ctx, rand, pro, 0, 680, 1280, 40);
  // Barbed wire along the left and right edges.
  drawBarbedWire(ctx, rand, pro, 8, 60, 8, 660);
  drawBarbedWire(ctx, rand, pro, 1272, 60, 1272, 660);
  // Trenches and bunkers: classic style.
  if (!pro) {
    drawTrench(ctx, rand, 60, 60, 200, 26);
    drawTrench(ctx, rand, 1020, 60, 200, 26);
    drawBunker(ctx, rand, 40, 320, 90, 56);
    drawBunker(ctx, rand, 1150, 320, 90, 56);
  }
  // PRO: burning ruined city silhouettes + emergency light glows.
  if (pro) {
    drawBurningCity(ctx, rand);
    drawEmergencyGlows(ctx, rand);
  }
  return c;
}

function drawRuins(ctx, rand, pro) {
  // Dark building silhouettes behind the arena's top and bottom strips.
  ctx.fillStyle = pro ? '#160b08' : '#2b2118';
  for (let i = 0; i < 8; i++) {
    const w = 60 + rand() * 90;
    const h = 24 + rand() * 36;
    const x = 40 + rand() * 1200;
    const y = rand() < 0.5 ? 0 : 720 - h;
    ctx.fillRect(x, y, w, h);
    // Broken top edge: a few jagged chunks.
    ctx.beginPath();
    ctx.moveTo(x, y + (y === 0 ? h : 0));
    ctx.lineTo(x + w * 0.3, y + (y === 0 ? h - 10 : 10));
    ctx.lineTo(x + w * 0.6, y + (y === 0 ? h - 4 : 4));
    ctx.lineTo(x + w, y + (y === 0 ? h : 0));
    ctx.closePath();
    ctx.fill();
  }
}

function drawSandbags(ctx, rand, pro, x0, y0, w, h) {
  const cols = pro ? ['#3a2a1a', '#4a3622'] : ['#8a7a5a', '#a89878'];
  for (let x = x0; x < x0 + w; x += 18) {
    for (let y = y0; y < y0 + h; y += 12) {
      ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
      ctx.beginPath();
      ctx.ellipse(x + 9 + (rand() - 0.5) * 4, y + 6, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBarbedWire(ctx, rand, pro, x0, y0, x1, y1) {
  ctx.strokeStyle = pro ? '#4a3a2a' : '#5a4a3a';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    const off = i * 6;
    ctx.moveTo(x0 + off, y0);
    ctx.lineTo(x1 + off, y1);
    ctx.stroke();
  }
  // Barbs.
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const bx = x0 + (x1 - x0) * t + 3;
    const by = y0 + (y1 - y0) * t + 3;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by - 4);
    ctx.lineTo(bx + 4, by + 4);
    ctx.moveTo(bx + 4, by - 4);
    ctx.lineTo(bx - 4, by + 4);
    ctx.stroke();
  }
}

function drawTrench(ctx, rand, x, y, w, h) {
  ctx.fillStyle = '#241a10';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#3a2c1c';
    ctx.fillRect(x + 8 + i * 30, y + 4, 18, h - 8);
  }
}

function drawBunker(ctx, rand, x, y, w, h) {
  ctx.fillStyle = '#4a4438';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#33302a';
  ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  // Firing slit.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x + 14, y + h / 2 - 4, w - 28, 8);
}

function drawBurningCity(ctx, rand) {
  // Silhouetted ruined skyscrapers with lit windows, behind the arena.
  for (let i = 0; i < 7; i++) {
    const w = 50 + rand() * 70;
    const h = 90 + rand() * 130;
    const x = 30 + rand() * 1180;
    const y = rand() < 0.5 ? 0 : 720 - h;
    ctx.fillStyle = '#0d0503';
    ctx.fillRect(x, y, w, h);
    // Broken top.
    ctx.beginPath();
    ctx.moveTo(x, y + (y === 0 ? h : 0));
    ctx.lineTo(x + w * 0.4, y + (y === 0 ? h - 18 : 18));
    ctx.lineTo(x + w * 0.7, y + (y === 0 ? h - 6 : 6));
    ctx.lineTo(x + w, y + (y === 0 ? h : 0));
    ctx.closePath();
    ctx.fill();
    // Lit windows: some burning orange, some emergency red.
    for (let wx = x + 8; wx < x + w - 8; wx += 14) {
      for (let wy = (y === 0 ? 12 : 720 - h + 12); wy < (y === 0 ? h - 8 : 712); wy += 18) {
        if (rand() < 0.35) {
          ctx.fillStyle = rand() < 0.6 ? 'rgba(255,140,40,0.85)' : 'rgba(255,45,60,0.85)';
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
  }
}

function drawEmergencyGlows(ctx, rand) {
  // Red and blue emergency light glows in the corners.
  const glows = [
    { x: 60, y: 60, c: '255,45,60' },
    { x: 1220, y: 60, c: '60,120,255' },
    { x: 60, y: 660, c: '60,120,255' },
    { x: 1220, y: 660, c: '255,45,60' },
  ];
  for (const g of glows) {
    const grad = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, 90);
    grad.addColorStop(0, `rgba(${g.c},0.35)`);
    grad.addColorStop(1, `rgba(${g.c},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 90, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- World layer (912x912, world coordinates) ----
function renderWorld(G) {
  const c = document.createElement('canvas');
  c.width = COLS * TILE;
  c.height = ROWS * TILE;
  const ctx = c.getContext('2d');
  const pro = G.mode === 'pro';
  const rand = seededRand(G.level * 31 + (pro ? 5 : 3));
  // Ground: cracked, muddy earth. Classic: brown/army-green; PRO: dark
  // scorched night ground.
  ctx.fillStyle = pro ? '#17100a' : '#4a3a28';
  ctx.fillRect(0, 0, c.width, c.height);
  // Mottled patches.
  for (let i = 0; i < 260; i++) {
    const x = rand() * c.width;
    const y = rand() * c.height;
    const r = 6 + rand() * 26;
    ctx.fillStyle = pro
      ? `rgba(${30 + rand() * 30},${18 + rand() * 16},${10 + rand() * 10},0.45)`
      : `rgba(${70 + rand() * 50},${55 + rand() * 35},${30 + rand() * 20},0.45)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cracks.
  ctx.strokeStyle = pro ? 'rgba(0,0,0,0.55)' : 'rgba(30,20,10,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    let x = rand() * c.width;
    let y = rand() * c.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rand() - 0.5) * 46;
      y += (rand() - 0.5) * 46;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Craters.
  for (let i = 0; i < 9; i++) {
    const x = rand() * c.width;
    const y = rand() * c.height;
    const r = 12 + rand() * 18;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Faint tank-track arcs across the ground.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 8; i++) {
    const x = rand() * c.width;
    const y = rand() * c.height;
    const r = 40 + rand() * 80;
    const a0 = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a0 + 1.2 + rand() * 1.2);
    ctx.stroke();
  }
  // Bunker / trench decorations on empty ground tiles (non-blocking).
  drawWorldDecor(ctx, G, rand, pro);
  return c;
}

function drawWorldDecor(ctx, G, rand, pro) {
  // Small bunker blocks and trench lines placed on '.' tiles only, away
  // from the base ring and the spawn tiles.
  const occupied = new Set();
  for (const t of [{ row: 18, col: 8 }, { row: 17, col: 8 }, { row: 17, col: 9 }, { row: 17, col: 10 }, { row: 18, col: 10 }, { row: 18, col: 9 }, { row: 18, col: 7 }, { row: 18, col: 11 }, { row: 0, col: 0 }, { row: 0, col: 9 }, { row: 0, col: 18 }]) {
    occupied.add(t.row + ',' + t.col);
  }
  let placed = 0;
  for (let tries = 0; tries < 120 && placed < 7; tries++) {
    const row = Math.floor(rand() * ROWS);
    const col = Math.floor(rand() * COLS);
    if (occupied.has(row + ',' + col)) continue;
    if (G.grid[row] && G.grid[row][col] !== '.') continue;
    occupied.add(row + ',' + col);
    const x = col * TILE;
    const y = row * TILE;
    if (rand() < 0.5) {
      // Trench: a dark dug line with wooden edges.
      ctx.fillStyle = pro ? '#0e0805' : '#241a10';
      ctx.fillRect(x + 6, y + TILE / 2 - 7, TILE - 12, 14);
      ctx.fillStyle = pro ? '#2a1a10' : '#5a4630';
      ctx.fillRect(x + 6, y + TILE / 2 - 9, TILE - 12, 3);
      ctx.fillRect(x + 6, y + TILE / 2 + 6, TILE - 12, 3);
    } else {
      // Bunker: a low concrete block with a firing slit.
      ctx.fillStyle = pro ? '#1c1410' : '#4a4438';
      ctx.fillRect(x + 8, y + 12, TILE - 16, TILE - 24);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x + 14, y + TILE / 2 - 3, TILE - 28, 6);
    }
    placed++;
  }
}

// ---- Blits ----
export function drawEdgeLayer(ctx, G) {
  if (G.bgEdge) ctx.drawImage(G.bgEdge, 0, 0);
}

// Drawn inside the camera transform: blit at the playfield's world origin.
export function drawWorldLayer(ctx, G) {
  if (G.bgWorld) ctx.drawImage(G.bgWorld, ORIGIN_X, ORIGIN_Y);
}

// Animated smoke and fires, in world coordinates (inside the camera
// transform). Called from the render loop after the tiles.
export function stepSmoke(G, dt) {
  for (const s of G.smoke) {
    s.x += s.speed * dt;
    s.phase += dt * 0.5;
    if (s.x - s.r > ORIGIN_X + COLS * TILE) s.x = ORIGIN_X - s.r;
  }
}

export function drawSmokeAndFires(ctx, G) {
  const pro = G.mode === 'pro';
  // Fires first (behind the smoke).
  for (const f of G.fires) {
    const flick = 0.75 + Math.sin(G.time * 9 + f.phase) * 0.25;
    const r = f.r * flick;
    const grad = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, r * 2.2);
    grad.addColorStop(0, 'rgba(255,220,120,0.85)');
    grad.addColorStop(0.45, pro ? 'rgba(255,110,30,0.55)' : 'rgba(255,140,40,0.5)');
    grad.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Smoke: thin gray puffs drifting over the ground. PRO: thicker.
  for (const s of G.smoke) {
    const bob = Math.sin(s.phase) * 6;
    ctx.fillStyle = pro
      ? `rgba(90,90,95,${s.a + 0.04})`
      : `rgba(160,160,170,${s.a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y + bob, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
