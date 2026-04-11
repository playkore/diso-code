export const SHAPE_PLAYER = [
  [15, 0],
  [-10, -10],
  [-5, 0],
  [-10, 10]
] as const;

export const SHAPE_ENEMY = [
  [12, 0],
  [-8, -10],
  [-8, 10]
] as const;

export const SHAPE_POLICE = [
  [13, 0],
  [0, -12],
  [-10, 0],
  [0, 12]
] as const;

export const SHAPE_THARGOID = [
  [12, 0],
  [4, -12],
  [-8, -8],
  [-12, 0],
  [-8, 8],
  [4, 12]
] as const;

export const SHAPE_STATION = [
  [45, 0],
  [20, -35],
  [-20, -35],
  [-45, 0],
  [-20, 35],
  [20, 35]
] as const;

export const CGA_BLACK = '#000000';
export const CGA_GREEN = '#55ff55';
export const CGA_RED = '#ff5555';
export const CGA_YELLOW = '#ffff55';
// Keep canvas text and DOM text aligned when the UI font changes.
export const TRAVEL_FONT_FAMILY = '"Share Tech Mono", monospace';
