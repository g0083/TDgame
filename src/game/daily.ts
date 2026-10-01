import { Rng, daySeed } from '../core/rng'
import { STAGES } from '../data/stages'
import { wv } from '../data/waves'
import type { EnemyId, StageDef, WaveDef } from '../data/types'

export interface DailyConfig {
  key: string
  seed: number
  goal: number
  waves: WaveDef[]
  map: StageDef
  reward: number
  title: string
  titleJa: string
  /** enemy pool used by the generator */
  pool: EnemyId[]
}

const TITLES: [string, string][] = [
  ['Scout Rush', '偵察の襲来'],
  ['Iron March', '鉄の行軍'],
  ['Swift Shadow', '迅速な影'],
  ['Broken Line', '崩された戦線'],
  ['Tide of Ash', '灰の潮'],
  ['Silent Night', '静寂の夜'],
  ['Frozen March', '氷結の行進'],
  ['Endless Hunger', '果てなき飢餓'],
  ['Hive Awakening', '巣の覚醒'],
  ['Final Stand', '最後の防衛'],
]

/** Build today's challenge deterministically from the date. */
export function getDaily(date = new Date()): DailyConfig {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  const seed = daySeed(date)
  const rng = new Rng(seed)
  // use one of the three early (shorter) maps so a daily run stays ~5-10 min
  const map = STAGES[rng.int(0, 2)]
  const [title, titleJa] = TITLES[rng.int(0, TITLES.length - 1)]
  const goal = rng.pick([8, 10, 12, 14, 15, 16])
  const poolSize = rng.int(3, 5)
  const basics: EnemyId[] = ['grunt', 'runner', 'swarmer', 'brute', 'armored']
  const extras: EnemyId[] = ['shielded', 'flyer', 'splitter', 'cursed', 'healer']
  // the wave-1 staple is always something basic, so the run ramps fairly
  const main = rng.pick(basics)
  const rest = rng.shuffle([...basics.filter((b) => b !== main), ...extras])
  const pool = [main, ...rest.slice(0, poolSize - 1)]
  const hpBase = rng.range(0.9, 1.2)
  const growth = rng.range(1.12, 1.17)
  const waves: WaveDef[] = []
  for (let n = 1; n <= goal; n++) {
    const ramp = Math.max(0, n - 3)
    const hpMul = Math.pow(growth, ramp) * hpBase
    const groups = n < 4 ? 1 : 2
    const entries: [EnemyId, number, number, number?][] = []
    const main = pool[0]
    entries.push([main, Math.round(5 * Math.pow(1.13, ramp)), 0.75, 0])
    for (let i = 1; i < groups; i++) {
      const id = pool[(n + i) % pool.length]
      entries.push([id, Math.round(3 * Math.pow(1.13, ramp)), 0.9, 0.8 * i])
    }
    waves.push(wv(entries, Math.round(40 * Math.pow(1.13, ramp)), hpMul))
  }
  return {
    key,
    seed,
    goal,
    waves,
    map,
    reward: 100 + goal * 8,
    title,
    titleJa,
    pool,
  }
}
