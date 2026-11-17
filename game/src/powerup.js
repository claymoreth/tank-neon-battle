// Power-ups: dropped by flashing carriers, collected by driving over.
// STAR upgrades bullets, HELMET shields, GRENADE clears the screen,
// SHOVEL armors the base ring, LIFE adds a life.
import { randInt, choice } from './util.js';
import { tileAt, setTile, RING_TILES } from './maps.js';

export const POWERUP_TYPES = ['star', 'helmet', 'grenade', 'shovel', 'life'];
export const POWERUP_LIFE = 12; // seconds on the ground (blinks last 3 s)

export function makePowerup(type, row, col) {
  return { type, row, col, t: POWERUP_LIFE, alive: true };
}

// Drop one on a random empty tile ('.').
export function dropPowerup(G) {
  for (let tries = 0; tries < 60; tries++) {
    const row = randInt(0, 12);
    const col = randInt(0, 12);
    if (tileAt(G.grid, row, col) !== '.') continue;
    // Not on top of a tank.
    let occupied = false;
    for (const t of [...G.playersArr, ...G.enemies]) {
      if (!t.alive) continue;
      const tr = Math.floor((t.y - 76) / 48);
      const tc = Math.floor((t.x - 328) / 48);
      if (tr === row && tc === col) { occupied = true; break; }
    }
    if (occupied) continue;
    const p = makePowerup(choice(POWERUP_TYPES), row, col);
    G.powerups.push(p);
    return p;
  }
  return null;
}

// Apply a collected power-up to a player tank.
// Returns { label, score }: the floating text and any points earned
// (the grenade scores every enemy it destroys).
export function applyPowerup(G, tank, type) {
  switch (type) {
    case 'star':
      tank.star = Math.min(3, tank.star + 1);
      return { label: 'STAR UP!', score: 0 };
    case 'helmet':
      tank.helmetT = 5;
      return { label: 'SHIELD!', score: 0 };
    case 'grenade': {
      let n = 0;
      let score = 0;
      for (const e of G.enemies) {
        if (e.alive) {
          e.alive = false;
          e.hp = 0;
          score += e.score;
          n++;
        }
      }
      if (G.boss && G.boss.alive) {
        G.boss.hp -= 5;
        G.boss.flashT = 0.15;
        if (G.boss.hp <= 0) G.pendingBossKill = true;
      }
      return { label: n > 0 ? 'BOOM! x' + n : 'BOOM!', score };
    }
    case 'shovel':
      setRingSteel(G, true);
      G.shovelTimer = 20;
      return { label: 'STEEL BASE!', score: 0 };
    case 'life': {
      if (tank.player === 1) G.lives1 = Math.min(5, G.lives1 + 1);
      else G.lives2 = Math.min(5, G.lives2 + 1);
      return { label: '+1 LIFE!', score: 0 };
    }
    default:
      return { label: '', score: 0 };
  }
}

// Turn the base ring into steel (on) or back to brick (off).
export function setRingSteel(G, on) {
  for (const { row, col } of RING_TILES) {
    const ch = tileAt(G.grid, row, col);
    if (on) {
      if (ch === '#') {
        G.ringBackup[row + ',' + col] = '#';
        setTile(G.grid, row, col, 'S');
      }
    } else {
      // Only restore tiles that were brick and are still steel;
      // a tile already destroyed stays destroyed.
      if (ch === 'S' && G.ringBackup[row + ',' + col] === '#') {
        setTile(G.grid, row, col, '#');
      }
      delete G.ringBackup[row + ',' + col];
    }
  }
}
