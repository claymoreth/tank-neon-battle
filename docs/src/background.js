// Battlefield background: pre-rendered ONCE per level/mode to an offscreen
// canvas and blitted every frame, so it costs nothing at 60fps. Only a
// few translucent smoke puffs and (neon) small fires animate, cheaply,
// behind the tiles — nothing here ever covers a tank, a bullet or a
// power-up, and nothing here blocks movement.
import { ORIGIN_X, ORIGIN_Y, COLS, ROWS, TILE } from './maps.js';

const W = 1280;
const H = 720;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStatic(G, rng) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const neon = G.mode === 'neon';

  // Base ground.
  const grad = x.createLinearGradient(0, 0, 0, H);
  if (neon) {
    grad.addColorStop(0, '#0d0819');
    grad.addColorStop(1, '#05010f');
  } else {
    grad.addColorStop(0, '#38311f');
    grad.addColorStop(1, '#241f14');
  }
  x.fillStyle = grad;
  x.fillRect(0, 0, W, H);

  // Mottled earth: low-contrast blobs all over the ground.
  for (let i = 0; i < 140; i++) {
    const px = rng() * W;
    const py = rng() * H;
    const r = 8 + rng() * 42;
    x.fillStyle = neon
      ? rng() < 0.5 ? 'rgba(60,40,120,0.10)' : 'rgba(20,60,90,0.10)'
      : rng() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,240,200,0.06)';
    x.beginPath();
    x.ellipse(px, py, r, r * (0.5 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
    x.fill();
  }

  // Cracks: short jagged dark lines.
  x.strokeStyle = 'rgba(0,0,0,0.45)';
  x.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    let px = rng() * W;
    let py = rng() * H;
    x.beginPath();
    x.moveTo(px, py);
    for (let s = 0; s < 4; s++) {
      px += (rng() - 0.5) * 70;
      py += (rng() - 0.5) * 70;
      x.lineTo(px, py);
    }
    x.stroke();
  }

  // Craters: dark pits with a lighter rim.
  for (let i = 0; i < 9; i++) {
    const px = ORIGIN_X + rng() * COLS * TILE;
    const py = ORIGIN_Y + rng() * ROWS * TILE;
    const r = 8 + rng() * 12;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = neon ? 'rgba(120,90,200,0.25)' : 'rgba(255,240,200,0.15)';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(px, py, r, Math.PI * 0.15, Math.PI * 0.85);
    x.stroke();
  }

  // Tank track marks: pairs of parallel dashed lines.
  x.strokeStyle = 'rgba(0,0,0,0.28)';
  x.lineWidth = 5;
  x.setLineDash([14, 10]);
  for (let i = 0; i < 7; i++) {
    const px = ORIGIN_X + rng() * COLS * TILE;
    const py = ORIGIN_Y + rng() * ROWS * TILE;
    const ang = rng() * Math.PI;
    const len = 60 + rng() * 120;
    for (const off of [-9, 9]) {
      x.beginPath();
      x.moveTo(px + Math.cos(ang + Math.PI / 2) * off, py + Math.sin(ang + Math.PI / 2) * off);
      x.lineTo(
        px + Math.cos(ang + Math.PI / 2) * off + Math.cos(ang) * len,
        py + Math.sin(ang + Math.PI / 2) * off + Math.sin(ang) * len,
      );
      x.stroke();
    }
  }
  x.setLineDash([]);

  // Scorch marks: dark radial blots from old explosions.
  for (let i = 0; i < 6; i++) {
    const px = ORIGIN_X + rng() * COLS * TILE;
    const py = ORIGIN_Y + rng() * ROWS * TILE;
    const r = 20 + rng() * 30;
    const g2 = x.createRadialGradient(px, py, 2, px, py, r);
    g2.addColorStop(0, 'rgba(0,0,0,0.4)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g2;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }

  // ---- Arena edges: debris, sandbags, barbed wire, ruined walls ----
  // All edge work stays in the side strips and the bottom margin, below
  // the side-strip text, so it never sits under a label or a tile.
  const sandbag = neon ? '#2a2f45' : '#8a7a52';
  const sandbagRim = neon ? 'rgba(77,243,255,0.45)' : 'rgba(0,0,0,0.4)';
  function sandbags(bx, by, cols, rows) {
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const sx = bx + col * 34 + (r % 2) * 10;
        const sy = by + r * 16;
        x.fillStyle = sandbag;
        x.beginPath();
        x.roundRect(sx, sy, 30, 14, 7);
        x.fill();
        x.strokeStyle = sandbagRim;
        x.lineWidth = 1;
        x.stroke();
      }
    }
  }
  function barbedWire(y, x0, x1) {
    x.strokeStyle = neon ? 'rgba(255,93,242,0.4)' : 'rgba(180,180,180,0.5)';
    x.lineWidth = 1.5;
    x.beginPath();
    for (let px = x0; px <= x1; px += 8) {
      const py = y + Math.sin(px / 14) * 3;
      if (px === x0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
    // Barbs: small X crosses along the wire.
    for (let px = x0 + 12; px < x1; px += 26) {
      const py = y + Math.sin(px / 14) * 3;
      x.beginPath();
      x.moveTo(px - 4, py - 4);
      x.lineTo(px + 4, py + 4);
      x.moveTo(px + 4, py - 4);
      x.lineTo(px - 4, py + 4);
      x.stroke();
    }
  }
  function ruinedWall(bx, by, w, h) {
    x.fillStyle = neon ? '#1c2436' : '#5c5648';
    x.beginPath();
    x.moveTo(bx, by + h);
    x.lineTo(bx, by + 14);
    x.lineTo(bx + w * 0.3, by + 4);
    x.lineTo(bx + w * 0.55, by + 12);
    x.lineTo(bx + w * 0.8, by + 2);
    x.lineTo(bx + w, by + 10);
    x.lineTo(bx + w, by + h);
    x.closePath();
    x.fill();
    x.strokeStyle = neon ? 'rgba(77,243,255,0.3)' : 'rgba(0,0,0,0.35)';
    x.lineWidth = 1;
    x.stroke();
  }

  // Left strip, below the help text (text ends ~y 344).
  sandbags(40, 420, 3, 3);
  sandbags(190, 560, 3, 2);
  barbedWire(392, 24, 300);
  ruinedWall(30, 620, 90, 60);
  // Right strip, below the legend (ends ~y 322).
  sandbags(1020, 400, 3, 3);
  sandbags(1120, 560, 3, 2);
  barbedWire(372, 980, 1256);
  ruinedWall(1150, 620, 90, 60);
  // Debris specks in the strips.
  for (let i = 0; i < 50; i++) {
    const inLeft = rng() < 0.5;
    const px = inLeft ? 10 + rng() * 300 : 970 + rng() * 290;
    const py = 380 + rng() * 300;
    x.fillStyle = neon ? 'rgba(120,140,200,0.35)' : 'rgba(0,0,0,0.35)';
    x.beginPath();
    x.arc(px, py, 1.5 + rng() * 2.5, 0, Math.PI * 2);
    x.fill();
  }
  // Rubble line along the bottom margin, under the playfield.
  for (let i = 0; i < 26; i++) {
    const px = 340 + rng() * 600;
    const py = 704 + rng() * 12;
    x.fillStyle = neon ? 'rgba(90,100,160,0.4)' : 'rgba(0,0,0,0.4)';
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + 6 + rng() * 8, py - 3 - rng() * 4);
    x.lineTo(px + 12 + rng() * 8, py);
    x.closePath();
    x.fill();
  }

  if (!neon) {
    // CLASSIC: trenches and bunkers in the strips.
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.beginPath();
    x.roundRect(40, 480, 240, 26, 13);
    x.fill();
    x.strokeStyle = 'rgba(255,240,200,0.18)';
    x.lineWidth = 2;
    x.stroke();
    x.beginPath();
    x.roundRect(1000, 470, 240, 26, 13);
    x.fill();
    x.stroke();
    // Bunker: dark block with a firing slit.
    x.fillStyle = '#3a3324';
    x.beginPath();
    x.roundRect(60, 650, 110, 44, 8);
    x.fill();
    x.fillStyle = '#0c0a06';
    x.fillRect(72, 668, 86, 8);
    x.fillStyle = '#3a3324';
    x.beginPath();
    x.roundRect(1100, 650, 110, 44, 8);
    x.fill();
    x.fillStyle = '#0c0a06';
    x.fillRect(1112, 668, 86, 8);
  } else {
    // NEON: glowing ruined-city silhouettes along the far edges.
    function skyline(x0, x1) {
      let px = x0;
      while (px < x1) {
        const bw = 14 + rng() * 22;
        const bh = 40 + rng() * 90;
        const by = H - bh;
        x.fillStyle = '#0a0a18';
        x.fillRect(px, by, bw, bh);
        x.strokeStyle = 'rgba(77,243,255,0.35)';
        x.lineWidth = 1;
        x.strokeRect(px + 0.5, by + 0.5, bw - 1, bh - 1);
        // A few glowing windows.
        for (let wy = by + 8; wy < H - 10; wy += 16) {
          for (let wx = px + 4; wx < px + bw - 4; wx += 10) {
            if (rng() < 0.35) {
              x.fillStyle = rng() < 0.5 ? 'rgba(77,243,255,0.75)' : 'rgba(255,93,242,0.75)';
              x.fillRect(wx, wy, 3, 4);
            }
          }
        }
        px += bw + 2 + rng() * 8;
      }
    }
    skyline(0, 22);
    skyline(1258, 1280);
    // Low silhouettes along the bottom margin.
    let px = 340;
    while (px < 940) {
      const bw = 30 + rng() * 50;
      const bh = 6 + rng() * 12;
      x.fillStyle = '#0a0a18';
      x.fillRect(px, 720 - bh, bw, bh);
      px += bw + 4 + rng() * 10;
    }
  }

  return c;
}

// Build (or rebuild) the static background + smoke for this level/mode.
export function ensureBackground(G) {
  const key = G.state === 'title' ? 'title:' + G.mode : G.mode + ':' + G.level;
  if (G.bgCanvas && G.bgKey === key) return;
  const rng = mulberry32(1000 + G.level * 7 + (G.mode === 'neon' ? 13 : 0));
  G.bgCanvas = buildStatic(G, rng);
  G.bgKey = key;
  // Smoke puffs: slow, translucent, drifting behind the tiles.
  G.smoke = [];
  for (let i = 0; i < 6; i++) {
    G.smoke.push({
      x: rng() * W,
      y: rng() * H,
      r: 50 + rng() * 50,
      vx: (2 + rng() * 4) * (rng() < 0.5 ? 1 : -1),
      vy: (rng() - 0.5) * 2,
      a: 0.05 + rng() * 0.04,
      neon: G.mode === 'neon' && rng() < 0.5,
    });
  }
  // Small fires (neon only) in the side strips, never over the playfield.
  G.fires = G.mode === 'neon'
    ? [
        { x: 70, y: 430, phase: 0 },
        { x: 1210, y: 420, phase: 2.1 },
        { x: 1210, y: 640, phase: 4.2 },
      ]
    : [];
}

export function stepSmoke(G, dt) {
  if (!G.smoke) return;
  for (const p of G.smoke) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -p.r) p.x = W + p.r;
    if (p.x > W + p.r) p.x = -p.r;
    if (p.y < -p.r) p.y = H + p.r;
    if (p.y > H + p.r) p.y = -p.r;
  }
}

export function drawBackgroundLayer(ctx, G) {
  if (G.bgCanvas) ctx.drawImage(G.bgCanvas, 0, 0);
  // Drifting smoke, behind the tiles.
  if (G.smoke) {
    for (const p of G.smoke) {
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
      const col = p.neon ? '122,92,255' : '200,190,170';
      g.addColorStop(0, `rgba(${col},${p.a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Flickering fires (neon only), in the side strips.
  if (G.fires) {
    for (const f of G.fires) {
      const flick = 0.55 + 0.45 * Math.sin(G.time * 9 + f.phase);
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 16);
      g.addColorStop(0, `rgba(255,210,63,${0.85 * flick})`);
      g.addColorStop(0.5, `rgba(255,123,47,${0.5 * flick})`);
      g.addColorStop(1, 'rgba(255,123,47,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 16, 0, Math.PI * 2);
      ctx.fill();
      // Rising ember.
      const ey = f.y - ((G.time * 22 + f.phase * 40) % 36);
      ctx.fillStyle = `rgba(255,180,80,${0.7 * flick})`;
      ctx.beginPath();
      ctx.arc(f.x + 3, ey, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
