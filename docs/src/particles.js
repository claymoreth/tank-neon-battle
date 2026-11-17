// Particles: neon explosion sparks, muzzle flashes and bullet trails.
// Classic mode uses one simple expanding circle instead.
import { rand } from './util.js';

export function makeParticles() {
  return [];
}

// A burst of sparks at (x, y). Colors alternate orange/cyan in neon.
export function burst(G, x, y, big) {
  if (G.mode === 'classic') {
    G.rings.push({ x, y, r: 6, max: big ? 60 : 36, t: 0.4, alive: true });
    return;
  }
  const n = big ? 55 : 30;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(60, big ? 320 : 220);
    G.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      t: rand(0.3, 0.7),
      max: 0.7,
      size: rand(2, 4.5),
      color: Math.random() < 0.5 ? '#ff9a3c' : '#4df3ff',
      alive: true,
    });
  }
  G.rings.push({ x, y, r: 6, max: big ? 70 : 40, t: 0.35, alive: true });
}

export function muzzle(G, x, y) {
  if (G.mode !== 'neon') return;
  G.muzzles.push({ x, y, t: 0.08, alive: true });
}

export function stepParticles(G, dt) {
  for (const p of G.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
    p.t -= dt;
    if (p.t <= 0) p.alive = false;
  }
  G.particles = G.particles.filter((p) => p.alive);
  for (const r of G.rings) {
    r.t -= dt;
    r.r += (r.max - r.r) * 6 * dt;
    if (r.t <= 0) r.alive = false;
  }
  G.rings = G.rings.filter((r) => r.alive);
  for (const m of G.muzzles) {
    m.t -= dt;
    if (m.t <= 0) m.alive = false;
  }
  G.muzzles = G.muzzles.filter((m) => m.alive);
}

// Screen shake: magnitude in px, decays over time.
export function shake(G, mag, dur) {
  if (G.mode !== 'neon') return;
  G.shakeMag = Math.max(G.shakeMag, mag);
  G.shakeT = Math.max(G.shakeT, dur);
}
