export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by)
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}
export const TAU = Math.PI * 2
export const DEG = Math.PI / 180

/** Smooth approach of `a` toward `b`. */
export const approach = (a: number, b: number, rate: number): number => a + (b - a) * (1 - Math.exp(-rate))

export function shortestAngle(from: number, to: number): number {
  let d = (to - from) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** Format big numbers nicely (1.2k, 3.4M...). */
export function fmt(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k'
  if (a >= 100) return String(Math.round(n))
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
