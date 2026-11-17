// Maps: five handcrafted 19x19 layouts. Legend:
//   '.' empty   '#' brick (breakable)   'S' steel (indestructible)
//   'G' grass (hides tanks)  'W' water (blocks tanks, not bullets)
//   'I' ice (slippery)   'B' EAGLE base (row 18, col 9)
// Every layout keeps the base ring brick: row 17 cols 8-10 and row 18
// cols 8 and 10, and keeps the player starts (row 18, col 7 and col 11)
// and the enemy spawn row (row 0, cols 0, 9, 18) empty. Every layout
// passes a flood-fill check: the player spawn reaches the base ring and
// all 3 enemy spawns through driveable tiles.
export const TILE = 48;
export const COLS = 19;
export const ROWS = 19;
export const ORIGIN_X = 328;
export const ORIGIN_Y = 76;
// On-screen playfield window: 624x624 at (328, 76). The world is
// 912x912, so the camera offset clamps to [0, 912 - 624].
export const VIEW_W = 624;
export const VIEW_H = 624;
export const CAM_MAX = COLS * TILE - VIEW_W; // 288

const A = [
  '...................',
  'GG...............GG',
  'GG...............GG',
  '...##....##....##..',
  '...................',
  '.....#.......#.....',
  '......##...##......',
  '.........S.........',
  '.........S.........',
  '........SSS........',
  '.........S.........',
  '.........S.........',
  '......##...##......',
  '.....#.......#.....',
  '..................W',
  '...............WWWW',
  '...##....##....##.W',
  '........###........',
  '........#B#........',
];

const B = [
  '...................',
  '.#.#.#.#.#.#.#.#.#.',
  '...................',
  '..###...###...###..',
  '...................',
  '.#...#SS#...#...#..',
  '...................',
  '...###.....###.....',
  '...................',
  'IIIIIIIIIIIIIIIIIII',
  '...................',
  '..###...###...###..',
  '...................',
  '.#.#.#.#.#.#.#.#.#.',
  '...................',
  '..###...###...###..',
  'GG...............GG',
  '........###........',
  '........#B#........',
];

const C = [
  '...................',
  '...................',
  '....#####..........',
  '....#...#..........',
  '...................',
  '....#S#...###......',
  'WWWWWW.......WWWWWW',
  '......GGG..........',
  '.....GGGGG.........',
  '......GGG..........',
  '...................',
  '....#####..........',
  '...................',
  '...#####...#####...',
  '...................',
  '....###...###......',
  '....#.......#......',
  '........###........',
  '........#B#........',
];

const D = [
  '...................',
  'WW...#...#...#.....',
  'WW...#...#...#.....',
  '.#.#.#.#.#.#.#.#.#.',
  '....#...#...#......',
  '..#..S...S...S..#..',
  '..II....II....II...',
  '....#...#...#......',
  '.#.#.#.#.#.#.#.#.#.',
  '...................',
  '.#.#.#.#.#.#.#.#.#.',
  '....#...#...#......',
  '..II....II....II...',
  '..#..S...S...S..#..',
  '....#...#...#......',
  '.#.#.#.#.#.#.#.#.#.',
  '.................WW',
  '........###......WW',
  '........#B#........',
];

const E = [
  '...................',
  '.###...###...###...',
  'GG...............GG',
  '...................',
  '....#.......#......',
  '.......SSSSS.......',
  '.......S...S.......',
  '.......SSSSS.......',
  '...................',
  '..###.........###..',
  '...................',
  'GG...............GG',
  '.###...###...###...',
  '...................',
  '....#.......#......',
  '...................',
  '...................',
  '........###........',
  '........#B#........',
];

export const LAYOUTS = [A, B, C, D, E];

// Levels 1-5 use A-E, 6-10 reuse them harder, 11-15 again faster.
export function layoutFor(level) {
  return LAYOUTS[(level - 1) % LAYOUTS.length];
}

export function parseLayout(rows) {
  return rows.map((r) => r.split(''));
}

export function tileAt(grid, row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return '#';
  return grid[row][col];
}

export function setTile(grid, row, col, ch) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
  grid[row][col] = ch;
}

// Pixel center of a tile (world coordinates).
export function tileCenter(row, col) {
  return {
    x: ORIGIN_X + col * TILE + TILE / 2,
    y: ORIGIN_Y + row * TILE + TILE / 2,
  };
}

// Tile row/col containing a pixel position (world coordinates).
export function tileOf(x, y) {
  return {
    row: Math.floor((y - ORIGIN_Y) / TILE),
    col: Math.floor((x - ORIGIN_X) / TILE),
  };
}

// The 5 base-ring tiles around the EAGLE (row 18, col 9).
export const BASE_ROW = 18;
export const BASE_COL = 9;
export const RING_TILES = [
  { row: 17, col: 8 },
  { row: 17, col: 9 },
  { row: 17, col: 10 },
  { row: 18, col: 8 },
  { row: 18, col: 10 },
];

// Driveable tiles next to the base ring: a tank standing here can shoot
// the ring (and the base behind it). Used by the reachability check.
export const BASE_APPROACH = [
  { row: 16, col: 8 },
  { row: 16, col: 9 },
  { row: 16, col: 10 },
  { row: 17, col: 7 },
  { row: 17, col: 11 },
  { row: 18, col: 7 },
  { row: 18, col: 11 },
];

// Player spawn tiles.
export const P1_SPAWN = { row: 18, col: 7 };
export const P2_SPAWN = { row: 18, col: 11 };

// Enemy spawn tiles (top row).
export const ENEMY_SPAWNS = [
  { row: 0, col: 0 },
  { row: 0, col: 9 },
  { row: 0, col: 18 },
];
