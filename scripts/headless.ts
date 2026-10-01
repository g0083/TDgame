/* Headless balance/smoke test: runs the pure simulation without a DOM. */
/* eslint-disable no-console */
import { Battle } from '../src/game/battle'
import { STAGES } from '../src/data/stages'
import { computeMeta } from '../src/save/meta'
import { defaultSave, type SaveData } from '../src/save/save'
import { getDaily } from '../src/game/daily'

// minimal globals the modules touch
const g = globalThis as unknown as Record<string, unknown>
const store = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
}
g.window = { devicePixelRatio: 1, setTimeout: () => 0, clearTimeout: () => {} }
g.localStorage = localStorageMock
g.document = { documentElement: {} }
g.performance = { now: () => Date.now() }

interface RunResult {
  mode: string
  stage: string
  waves: number
  victory: boolean
  lives: number
  kills: number
  gold: number
  towers: number
  stalled?: boolean
}

function autoBuild(b: Battle): void {
  // naive AI: place towers in random free cells adjacent to the path
  const order = ['arrow', 'frost', 'arrow', 'cannon', 'poison', 'wall', 'cannon', 'tesla', 'flame', 'sniper'] as const
  let i = Math.floor(Math.random() * order.length)
  for (let attempt = 0; attempt < 6; attempt++) {
    const type = order[i % order.length]
    if (b.gold < b.buildCost(type)) break
    // gather all free cells touching the path, then pick one at random
    const free: [number, number][] = []
    for (const k of b.pathCells) {
      const c = k % 12
      const r = Math.floor(k / 12)
      for (const [cc, rr] of [
        [c, r - 1],
        [c, r + 1],
        [c - 1, r],
        [c + 1, r],
      ] as [number, number][]) {
        if (b.canBuild(cc, rr)) free.push([cc, rr])
      }
    }
    if (free.length === 0) break
    const [cc, rr] = free[Math.floor(Math.random() * free.length)]
    const tw = b.build(type, cc, rr)
    if (!tw) break
    for (let u = 0; u < 4; u++) if (b.gold > b.upgradeCost(tw) * 1.6) b.upgrade(tw)
    if (tw.canEvolve && b.gold > b.evolveCost(tw) * 1.6) b.evolve(tw, (i % 2) as 0 | 1)
    i++
  }
}

function runStage(stageIndex: number, research: number): RunResult {
  const stage = STAGES[stageIndex]
  const save: SaveData = defaultSave()
  save.stagesCleared = stageIndex
  // simulate research progress
  for (const [id, rank] of [
    ['r_damage', research],
    ['r_rate', research],
    ['r_range', research],
    ['r_gold_kill', research],
    ['r_gold_start', research],
    ['r_lives', research],
  ] as [string, number][]) {
    save.research[id] = rank
  }
  const meta = computeMeta(save)
  const battle = new Battle({ meta, mode: 'stage', stage, map: stage })
  let over = false
  const state: { result: ReturnType<Battle['result']> | null } = { result: null }
  battle.onGameOver = (res) => {
    over = true
    state.result = res
  }
  const dt = 1 / 60
  let stalled = false
  for (let f = 0; f < 60 * 60 * 45 && !over; f++) {
    if (!battle.waveActive) battle.startWave()
    if (f % 30 === 0) autoBuild(battle)
    battle.update(dt)
  }
  if (!over) {
    stalled = true
    const left = battle.enemies.map((e) => `${e.def.id}@${Math.round(e.dist)}/${Math.round(e.hp)}`)
    console.log(`  [stall] wave ${battle.waveNumber()} remaining: ${left.slice(0, 8).join(', ')} (${left.length})`)
    const e0 = battle.enemies[0]
    if (e0) {
      console.log(
        `  [debug] spd=${e0.effectiveSpeed} freeze=${e0.st.freeze} stun=${e0.st.stun} slow=${e0.st.slow}/${e0.st.slowTimer} spawnT=${e0.spawnT} pathTotal=${battle.pathMetrics.total}`,
      )
    }
    console.log(`  [debug] projectiles=${battle.projectiles.length} towers=${battle.towers.length} waveActive=${battle.waveActive}`)
  }
  return {
    mode: 'stage',
    stage: stage.id,
    waves: battle.wavesCleared,
    victory: state.result ? state.result.victory : false,
    lives: battle.lives,
    kills: battle.kills,
    gold: Math.round(battle.goldEarned),
    towers: battle.towers.length,
    stalled,
  }
}

function runEndless(rounds: number, research: number, mapIndex: number): RunResult {
  const save: SaveData = defaultSave()
  save.research.r_damage = research
  save.research.r_rate = research
  const meta = computeMeta(save)
  const map = STAGES[mapIndex]
  const battle = new Battle({ meta, mode: 'endless', stage: null, map })
  let over = false
  battle.onGameOver = () => {
    over = true
  }
  battle.autoWave = true
  const dt = 1 / 60
  for (let f = 0; f < 60 * 60 * 45 && !over; f++) {
    if (!battle.waveActive) battle.startWave()
    if (f % 30 === 0) autoBuild(battle)
    battle.update(dt)
  }
  return {
    mode: 'endless',
    stage: '-',
    waves: battle.wavesCleared,
    victory: false,
    lives: battle.lives,
    kills: battle.kills,
    gold: Math.round(battle.goldEarned),
    towers: battle.towers.length,
  }
}

function runDaily(): RunResult {
  const save = defaultSave()
  const meta = computeMeta(save)
  const daily = getDaily()
  const battle = new Battle({
    meta,
    mode: 'daily',
    stage: null,
    map: daily.map,
    customWaves: daily.waves,
  })
  let over = false
  battle.onGameOver = () => {
    over = true
  }
  battle.autoWave = true
  for (let f = 0; f < 60 * 60 * 45 && !over; f++) {
    if (!battle.waveActive) battle.startWave()
    if (f % 30 === 0) autoBuild(battle)
    battle.update(1 / 60)
  }
  return {
    mode: 'daily',
    stage: daily.title,
    waves: battle.wavesCleared,
    victory: battle.wavesCleared >= daily.goal,
    lives: battle.lives,
    kills: battle.kills,
    gold: Math.round(battle.goldEarned),
    towers: battle.towers.length,
  }
}

console.log('--- stage runs (research = 0) ---')
for (let i = 0; i < STAGES.length; i++) {
  console.log(JSON.stringify(runStage(i, 0)))
}
console.log('--- stage runs (research = 6) ---')
for (let i = 0; i < STAGES.length; i++) {
  console.log(JSON.stringify(runStage(i, 6)))
}
console.log('--- endless (map 0/1/2) ---')
for (const m of [0, 1, 2]) {
  for (const r of [0, 15, 30]) {
    console.log(JSON.stringify({ ...runEndless(1, r, m), map: m, research: r }))
  }
}
console.log('--- daily ---')
console.log(JSON.stringify(runDaily()))
