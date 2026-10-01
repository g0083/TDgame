/**
 * Battlefield grid.
 * Logical field size is fixed (480x640) and scaled to the device screen.
 */
export const COLS = 12
export const ROWS = 16
export const CELL = 40
export const FIELD_W = COLS * CELL // 480
export const FIELD_H = ROWS * CELL // 640

export interface Cell {
  c: number
  r: number
}

export const key = (c: number, r: number): number => r * COLS + c

export function inBounds(c: number, r: number): boolean {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS
}

export function cellCenterX(c: number): number {
  return c * CELL + CELL / 2
}
export function cellCenterY(r: number): number {
  return r * CELL + CELL / 2
}

export function pxToCell(x: number, y: number): Cell {
  return { c: Math.floor(x / CELL), r: Math.floor(y / CELL) }
}

export function cellsOfPath(path: Cell[]): Set<number> {
  const s = new Set<number>()
  for (const p of path) s.add(key(p.c, p.r))
  return s
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r)
}
