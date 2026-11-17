// Maps: five handcrafted 13x13 layouts. Legend:
//   '.' empty   '#' brick (breakable)   'S' steel (indestructible)
//   'G' grass (hides tanks)  'W' water (blocks tanks, not bullets)
//   'I' ice (slippery)   'B' EAGLE base (row 12, col 6)
// Every layout keeps the base ring brick: row 11 cols 5-7 and row 12
// cols 5 and 7, and keeps the player starts (row 12, col 4 and col 8)
// and the enemy spawn row (row 0, cols 0, 6, 12) empty.
export const TILE = 48;
export const COLS = 13;
export const ROWS = 13;
export const ORIGIN_X = 328;
export const ORIGIN_Y = 76;

const A = [
  '.............',
  'GG....#....GG',
  'GG.........GG',
  '.##..###..##.',
  '.............',
  '......S......',
  '...##SSS##...',
  '......S......',
  '.........WWW.',
  '.........WWW.',
  '.##..###..##.',
  '.....###.....',
  '.....#B#.....',
];

const B = [
  '.............',
  '.#.#.#.#.#.#.',
  '.............',
  '..###...###..',
  '.............',
  '....#SS#.....',
  'IIIIIIIIIIIII',
  '.............',
  '..###...###..',
  'GG.........GG',
  '.#.#.#.#.#.#.',
  '.....###.....',
  '.....#B#.....',
];

const C = [
  '.............',
  '.............',
  '...#####.....',
  '...#...#.....',
  'WWWWWWWWWWWWW',
  '....#S#......',
  '....#S#......',
  '....GGG......',
  '...GGGGG.....',
  '.............',
  '...#####.....',
  '.....###.....',
  '.....#B#.....',
];

const D = [
  '.............',
  'WW...#...#...',
  'WW...#...#...',
  '.#.#.#.#.#.#.',
  '....#...#....',
  '..#..S.S..#..',
  '..II...II....',
  '....#...#....',
  '.#.#.#.#.#.#.',
  '..........WW.',
  '..........WW.',
  '.....###.....',
  '.....#B#.....',
];

const E = [
  '.............',
  '.###...###...',
  'G...........G',
  '.............',
  '....#...#....',
  '.....SSS.....',
  '.....S.S.....',
  '.....SSS.....',
  '.............',
  'G...........G',
  '.###...###...',
  '.....###.....',
  '.....#B#.....',
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

// Pixel center of a tile.
export function tileCenter(row, col) {
  return {
    x: ORIGIN_X + col * TILE + TILE / 2,
    y: ORIGIN_Y + row * TILE + TILE / 2,
  };
}

// Tile row/col containing a pixel position.
export function tileOf(x, y) {
  return {
    row: Math.floor((y - ORIGIN_Y) / TILE),
    col: Math.floor((x - ORIGIN_X) / TILE),
  };
}

// The 5 base-ring tiles around the EAGLE (row 12, col 6).
export const BASE_ROW = 12;
export const BASE_COL = 6;
export const RING_TILES = [
  { row: 11, col: 5 },
  { row: 11, col: 6 },
  { row: 11, col: 7 },
  { row: 12, col: 5 },
  { row: 12, col: 7 },
];

// Player spawn tiles.
export const P1_SPAWN = { row: 12, col: 4 };
export const P2_SPAWN = { row: 12, col: 8 };

// Enemy spawn tiles (top row).
export const ENEMY_SPAWNS = [
  { row: 0, col: 0 },
  { row: 0, col: 6 },
  { row: 0, col: 12 },
];
