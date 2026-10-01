/** Deterministic PRNG (mulberry32) - used for daily challenges & random maps. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length]
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

/** Hash a string into a 32-bit seed. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Seed for a given local calendar day (daily challenge). */
export function daySeed(date: Date = new Date()): number {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return hashString(`aegis-td-${y}-${m}-${d}`)
}

/** Local YYYY-MM-DD key. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
