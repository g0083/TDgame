import { COLS, ROWS, CELL, key, inBounds, type Cell } from './grid'

export interface Waypoint {
  x: number
  y: number
}

/**
 * Convert a cell path into a pixel polyline.
 * Waypoints sit at cell centers. Off-grid endpoints are supported
 * (spawn above the top edge, goal below the bottom edge).
 */
export function cellsToPoints(cells: Cell[], spawnY = -CELL, goalY = ROWS * CELL + CELL): Waypoint[] {
  const pts: Waypoint[] = []
  const first = cells[0]
  const last = cells[cells.length - 1]
  pts.push({ x: first.c * CELL + CELL / 2, y: spawnY })
  for (const c of cells) {
    pts.push({ x: c.c * CELL + CELL / 2, y: c.r * CELL + CELL / 2 })
  }
  pts.push({ x: last.c * CELL + CELL / 2, y: goalY })
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 1)
}

/** Straight line used by flying units: from spawn to core. */
export function straightPath(from: Waypoint, to: Waypoint): Waypoint[] {
  return [from, to]
}

export interface PathMetrics {
  total: number
  segments: { x1: number; y1: number; x2: number; y2: number; len: number; start: number }[]
}

export function buildMetrics(pts: Waypoint[]): PathMetrics {
  const segments: PathMetrics['segments'] = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i].x
    const y1 = pts[i].y
    const x2 = pts[i + 1].x
    const y2 = pts[i + 1].y
    const len = Math.hypot(x2 - x1, y2 - y1)
    segments.push({ x1, y1, x2, y2, len, start: total })
    total += len
  }
  return { total, segments }
}

/** Sample position + heading at distance `d` along the path. */
export function samplePath(m: PathMetrics, d: number): { x: number; y: number; angle: number } {
  if (m.segments.length === 0) return { x: 0, y: 0, angle: 0 }
  const dd = Math.max(0, Math.min(d, m.total))
  let seg = m.segments[m.segments.length - 1]
  for (let i = 0; i < m.segments.length; i++) {
    if (dd <= m.segments[i].start + m.segments[i].len) {
      seg = m.segments[i]
      break
    }
  }
  const t = seg.len === 0 ? 0 : (dd - seg.start) / seg.len
  return {
    x: seg.x1 + (seg.x2 - seg.x1) * t,
    y: seg.y1 + (seg.y2 - seg.y1) * t,
    angle: Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1),
  }
}

/** A* over the grid; `blocked` marks non-walkable cells. Returns null if unreachable. */
export function findPath(start: Cell, goal: Cell, blocked: Set<number>): Cell[] | null {
  if (!inBounds(start.c, start.r) || !inBounds(goal.c, goal.r)) return null
  if (blocked.has(key(goal.c, goal.r))) return null
  const open: Cell[] = [start]
  const cameFrom = new Map<number, number>()
  const gScore = new Map<number, number>([[key(start.c, start.r), 0]])
  const closed = new Set<number>()

  const heuristic = (c: Cell) => Math.abs(c.c - goal.c) + Math.abs(c.r - goal.r)

  while (open.length) {
    // pick lowest f
    let bi = 0
    for (let i = 1; i < open.length; i++) {
      const f = heuristic(open[i]) + (gScore.get(key(open[i].c, open[i].r)) ?? Infinity)
      const bf = heuristic(open[bi]) + (gScore.get(key(open[bi].c, open[bi].r)) ?? Infinity)
      if (f < bf) bi = i
    }
    const cur = open.splice(bi, 1)[0]
    const ck = key(cur.c, cur.r)
    if (cur.c === goal.c && cur.r === goal.r) {
      const out: Cell[] = [cur]
      let k = ck
      while (cameFrom.has(k)) {
        const pk = cameFrom.get(k)!
        out.push({ c: pk % COLS, r: Math.floor(pk / COLS) })
        k = pk
      }
      return out.reverse()
    }
    closed.add(ck)
    for (const [dc, dr] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const nc = cur.c + dc
      const nr = cur.r + dr
      if (!inBounds(nc, nr)) continue
      const nk = key(nc, nr)
      if (closed.has(nk) || blocked.has(nk)) continue
      const g = (gScore.get(ck) ?? Infinity) + 1
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g)
        cameFrom.set(nk, ck)
        open.push({ c: nc, r: nr })
      }
    }
  }
  return null
}
