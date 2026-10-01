import type { EnemyId, WaveDef, WaveEntry } from './types'

export const wv = (
  entries: [EnemyId, number, number, number?][],
  reward: number,
  hpMul?: number,
  boss?: boolean,
): WaveDef => ({
  entries: entries.map<WaveEntry>(([id, count, gap, delay]) => ({ id, count, gap, delay })),
  reward,
  hpMul,
  boss,
})

export interface WaveSpec {
  /** number of waves in the stage */
  count: number
  /** enemy types that can appear, in unlock order (index = first wave it appears) */
  pool: { at: number; id: EnemyId }[]
  /** boss waves: [waveNumber, bossId] */
  bosses: [number, EnemyId][]
  baseCount: number
  baseHp: number
  rewardBase: number
  /** per-wave hp growth factor */
  growth: number
}

const GAPS: Record<string, number> = {
  grunt: 0.85,
  runner: 0.6,
  brute: 1.5,
  armored: 1.3,
  shielded: 1.2,
  flyer: 1.0,
  healer: 1.4,
  splitter: 1.3,
  stealth: 1.1,
  cursed: 1.1,
  swarmer: 0.35,
  summoner: 1.8,
  phaser: 1.0,
  juggernaut: 2.0,
  boss_rush: 2.6,
  boss_swarm: 0.8,
  boss_titan: 3.0,
}

/**
 * Deterministically build the wave table for a stage from a compact spec.
 * Keeps stage data small while still producing a stable, escalating curve.
 */
export function makeWaves(spec: WaveSpec): WaveDef[] {
  const waves: WaveDef[] = []
  const active: EnemyId[] = []
  for (let n = 1; n <= spec.count; n++) {
    for (const p of spec.pool) if (n >= p.at) active.push(p.id)
    const bossEntry = spec.bosses.find((b) => b[0] === n)
    // flat HP for the first two waves, then a steady climb
    const hpRamp = Math.max(0, n - 2)
    const hpMul = Math.pow(spec.growth, hpRamp) * spec.baseHp
    if (bossEntry) {
      const id = bossEntry[1]
      waves.push(
        wv([[id, 1, 3], ...(n >= spec.count / 2 ? ([['grunt', 6, 0.7, 1]] as [EnemyId, number, number, number][]) : [])], Math.round(spec.rewardBase * (1.6 + n * 0.12)), hpMul, true),
      )
      continue
    }
    // choose 1-3 groups depending on the wave number
    const groups = n < 3 ? 1 : n < 8 ? 2 : n < 15 ? 2 : 3
    const entries: [EnemyId, number, number, number?][] = []
    // always mix in the first unlocked type so early waves stay readable
    const picks = new Set<EnemyId>([active[0]])
    const shuffled = [...active].sort((a, b) => (a < b ? -1 : 1))
    for (let i = 0; i < groups; i++) {
      const cand = shuffled[(n * 3 + i * 5) % shuffled.length]
      if (!picks.has(cand)) {
        picks.add(cand)
        entries.push([cand, 1, GAPS[cand] ?? 1, i === 0 ? 0 : 0.8 * i])
      }
    }
    // main group grows with the wave number, but the first few waves stay flat
    // so players can get their economy rolling before the pressure ramps up
    const main = active[0]
    const rampN = Math.max(0, n - 3)
    const mainCount = Math.round(spec.baseCount * Math.pow(1.16, rampN))
    entries.unshift([main, Math.min(mainCount, 40), GAPS[main] ?? 1, 0])
    waves.push(wv(entries, Math.round(spec.rewardBase * (1 + n * 0.1)), hpMul))
  }
  return waves
}

/** Endless mode: wave difficulty keeps escalating forever. */
export function makeEndlessWave(n: number, unlocked: EnemyId[], bossEvery = 5): WaveDef {
  const hpMul = Math.pow(1.15, Math.max(0, n - 3))
  if (n % bossEvery === 0) {
    const bosses: EnemyId[] = ['boss_rush', 'boss_swarm', 'boss_titan']
    const b = bosses[Math.floor(n / bossEvery - 1) % bosses.length]
    return wv([[b, 1, 3]], Math.round(80 * Math.pow(1.2, n)), hpMul * 1.4, true)
  }
  const entries: [EnemyId, number, number, number?][] = []
  const ramp = Math.max(0, n - 3)
  const main = unlocked[0]
  entries.push([main, Math.round(5 * Math.pow(1.09, ramp)), GAPS[main] ?? 1, 0])
  const second = unlocked[Math.min(unlocked.length - 1, 1 + (n % Math.max(1, unlocked.length - 1)))]
  if (second !== main) entries.push([second, Math.round(3 * Math.pow(1.1, ramp)), GAPS[second] ?? 1, 1.5])
  if (n > 8) {
    const third = unlocked[n % unlocked.length]
    entries.push([third, Math.round(4 * Math.pow(1.09, ramp)), GAPS[third] ?? 1, 3])
  }
  return wv(entries, Math.round(45 * Math.pow(1.14, ramp)), hpMul)
}
