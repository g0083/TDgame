import type { EnemyId, StageDef } from './types'
import { makeWaves } from './waves'

/**
 * Build a cell path by walking between waypoints.
 * Each leg moves horizontally first, then vertically, so the result is always
 * a connected orthogonal (L-shaped) polyline - never a diagonal jump.
 */
function path(waypoints: [number, number][]): { c: number; r: number }[] {
  const out: { c: number; r: number }[] = []
  const [sc, sr] = waypoints[0]
  out.push({ c: sc, r: sr })
  for (let i = 1; i < waypoints.length; i++) {
    const [c1, r1] = waypoints[i]
    const [pc, pr] = waypoints[i - 1]
    const dc = Math.sign(c1 - pc)
    const dr = Math.sign(r1 - pr)
    for (let c = pc; c !== c1; c += dc) out.push({ c, r: pr })
    for (let r = pr; r !== r1; r += dr) out.push({ c: c1, r })
  }
  return out
}

export const STAGES: StageDef[] = [
  {
    id: 's1',
    name: 'Sunny Plains',
    nameJa: '陽だまりの平原',
    index: 0,
    path: path([
      [1, 0],
      [1, 7],
      [5, 7],
      [5, 3],
      [9, 3],
      [9, 12],
      [10, 12],
    ]),
    rocks: [
      { c: 3, r: 11 },
      { c: 7, r: 14 },
      { c: 10, r: 6 },
    ],
    lives: 20,
    startGold: 260,
    background: '#101a2c',
    accent: '#3d6b4f',
    reward: 60,
    unlock: null,
    waves: makeWaves({
      count: 20,
      pool: [
        { at: 1, id: 'grunt' },
        { at: 4, id: 'runner' },
        { at: 8, id: 'brute' },
        { at: 13, id: 'flyer' },
      ],
      bosses: [[20, 'boss_rush']],
      baseCount: 5,
      baseHp: 1,
      rewardBase: 42,
      growth: 1.14,
    }),
  },
  {
    id: 's2',
    name: 'Twin Pass',
    nameJa: '双子の隘路',
    index: 1,
    path: path([
      [0, 2],
      [4, 2],
      [4, 9],
      [1, 9],
      [1, 13],
      [10, 13],
      [10, 5],
      [11, 5],
    ]),
    rocks: [
      { c: 7, r: 0 },
      { c: 7, r: 6 },
      { c: 2, r: 5 },
      { c: 8, r: 10 },
    ],
    lives: 20,
    startGold: 300,
    background: '#141a2e',
    accent: '#4a3d6b',
    reward: 90,
    unlock: { stagesCleared: 0 },
    waves: makeWaves({
      count: 22,
      pool: [
        { at: 1, id: 'grunt' },
        { at: 3, id: 'runner' },
        { at: 6, id: 'armored' },
        { at: 10, id: 'brute' },
        { at: 13, id: 'flyer' },
        { at: 16, id: 'healer' },
      ],
      bosses: [[22, 'boss_rush']],
      baseCount: 6,
      baseHp: 1.1,
      rewardBase: 52,
      growth: 1.15,
    }),
  },
  {
    id: 's3',
    name: 'Broken Foundry',
    nameJa: '壊れた製錬所',
    index: 2,
    path: path([
      [2, 0],
      [2, 5],
      [8, 5],
      [8, 10],
      [3, 10],
      [3, 14],
      [11, 14],
    ]),
    rocks: [
      { c: 5, r: 2 },
      { c: 6, r: 8 },
      { c: 0, r: 9 },
      { c: 10, r: 1 },
    ],
    lives: 18,
    startGold: 340,
    background: '#1d1524',
    accent: '#6b3a2a',
    reward: 130,
    unlock: { stagesCleared: 1 },
    waves: makeWaves({
      count: 24,
      pool: [
        { at: 1, id: 'grunt' },
        { at: 3, id: 'armored' },
        { at: 6, id: 'runner' },
        { at: 9, id: 'shielded' },
        { at: 12, id: 'splitter' },
        { at: 15, id: 'flyer' },
        { at: 18, id: 'healer' },
      ],
      bosses: [[24, 'boss_swarm']],
      baseCount: 7,
      baseHp: 1.25,
      rewardBase: 64,
      growth: 1.16,
    }),
  },
  {
    id: 's4',
    name: 'Frozen Hollow',
    nameJa: '氷の谷',
    index: 3,
    path: path([
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0],
      [8, 0],
      [8, 8],
      [2, 8],
      [2, 13],
      [11, 13],
    ]),
    rocks: [
      { c: 6, r: 11 },
      { c: 10, r: 5 },
      { c: 6, r: 6 },
      { c: 1, r: 15 },
    ],
    lives: 18,
    startGold: 380,
    background: '#0f1e2c',
    accent: '#2a5f7a',
    reward: 180,
    unlock: { stagesCleared: 2 },
    waves: makeWaves({
      count: 26,
      pool: [
        { at: 1, id: 'grunt' },
        { at: 3, id: 'runner' },
        { at: 6, id: 'shielded' },
        { at: 9, id: 'cursed' },
        { at: 12, id: 'armored' },
        { at: 15, id: 'splitter' },
        { at: 17, id: 'stealth' },
        { at: 19, id: 'phaser' },
        { at: 21, id: 'healer' },
      ],
      bosses: [[26, 'boss_swarm']],
      baseCount: 8,
      baseHp: 1.4,
      rewardBase: 78,
      growth: 1.17,
    }),
  },

  {
    id: 's5',
    name: 'Crimson Labyrinth',
    nameJa: '紅の迷宮',
    index: 4,
    path: path([
      [11, 0],
      [11, 5],
      [6, 5],
      [6, 1],
      [2, 1],
      [2, 9],
      [8, 9],
      [8, 14],
      [0, 14],
    ]),
    rocks: [
      { c: 4, r: 7 },
      { c: 9, r: 11 },
      { c: 0, r: 4 },
      { c: 4, r: 12 },
    ],
    lives: 15,
    startGold: 420,
    background: '#241320',
    accent: '#7a2a3a',
    reward: 240,
    unlock: { stagesCleared: 3 },
    waves: makeWaves({
      count: 28,
      pool: [
        { at: 1, id: 'grunt' },
        { at: 3, id: 'swarmer' },
        { at: 6, id: 'armored' },
        { at: 9, id: 'summoner' },
        { at: 12, id: 'shielded' },
        { at: 15, id: 'phaser' },
        { at: 18, id: 'juggernaut' },
        { at: 21, id: 'stealth' },
        { at: 23, id: 'healer' },
        { at: 25, id: 'cursed' },
      ],
      bosses: [[28, 'boss_titan']],
      baseCount: 9,
      baseHp: 1.6,
      rewardBase: 96,
      growth: 1.18,
    }),
  },
  {
    id: 's6',
    name: 'Aegis Core',
    nameJa: 'エージスの要衝',
    index: 5,
    path: path([
      [6, 0],
      [6, 3],
      [1, 3],
      [1, 7],
      [10, 7],
      [10, 2],
      [4, 2],
      [4, 12],
      [11, 12],
    ]),
    rocks: [
      { c: 8, r: 5 },
      { c: 2, r: 10 },
      { c: 7, r: 14 },
      { c: 0, r: 14 },
    ],
    lives: 15,
    startGold: 480,
    background: '#1b1430',
    accent: '#4a2a7a',
    reward: 320,
    unlock: { stagesCleared: 4 },
    waves: makeWaves({
      count: 30,
      pool: [
        { at: 1, id: 'grunt' },
        { at: 2, id: 'swarmer' },
        { at: 5, id: 'armored' },
        { at: 8, id: 'runner' },
        { at: 11, id: 'shielded' },
        { at: 14, id: 'summoner' },
        { at: 16, id: 'phaser' },
        { at: 18, id: 'juggernaut' },
        { at: 20, id: 'splitter' },
        { at: 22, id: 'cursed' },
        { at: 24, id: 'stealth' },
        { at: 25, id: 'healer' },
      ],
      bosses: [[30, 'boss_titan']],
      baseCount: 10,
      baseHp: 1.85,
      rewardBase: 120,
      growth: 1.19,
    }),
  },
]

export const ENDLESS_POOL: EnemyId[] = [
  'grunt',
  'runner',
  'swarmer',
  'armored',
  'brute',
  'shielded',
  'flyer',
  'splitter',
  'cursed',
  'stealth',
  'phaser',
  'healer',
  'summoner',
  'juggernaut',
] as const

/** Unlockable enemy pool for endless mode; grows with the wave number. */
export function endlessPool(wave: number): EnemyId[] {
  const n = Math.min(ENDLESS_POOL.length, 2 + Math.floor(wave / 2))
  return ENDLESS_POOL.slice(0, n)
}

