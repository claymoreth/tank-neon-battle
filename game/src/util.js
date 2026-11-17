// Shared helpers: numbers, randomness and rectangle tests.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Cardinal directions: 0 up, 1 right, 2 down, 3 left.
export const DIRS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function dirName(d) {
  return ['UP', 'RIGHT', 'DOWN', 'LEFT'][d];
}

export function rectsOverlap(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  );
}

// Angle (radians) of a cardinal direction, for drawing.
// The barrel is drawn pointing along local -y, so the rotation must map
// local -y onto DIRS[d]: up = 0, right = PI/2, down = PI, left = -PI/2.
// (The old table was 90 degrees off: a tank facing left drew its barrel
// pointing down.)
export function dirAngle(d) {
  return [ 0, Math.PI / 2, Math.PI, -Math.PI / 2 ][d];
}
