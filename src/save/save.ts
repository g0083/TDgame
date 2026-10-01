import { dayKey } from '../core/rng'

const KEY = 'aegis-td-save-v1'
const SCHEMA = 1

export interface TowerSave {
  type: string
  level: number
  evolve: string | null
  c: number
  r: number
  targetMode: string
  invested: number
}

export interface SaveData {
  schema: number
  coins: number
  research: Record<string, number>
  stagesCleared: number
  stageStars: Record<string, number>
  bestWave: number
  endlessBest: number
  arenaBest: number
  dailyBest: number
  dailiesDone: number
  achievements: string[]
  stats: {
    kills: number
    wavesCleared: number
    goldEarned: number
    towersBuilt: number
    bossesKilled: number
    maxWave: number
    perfectStages: number
    stagesCleared: number
    playSeconds: number
    evolutions: number
    researchSpent: number
    dailiesDone: number
    totalDamage: number
  }
  settings: {
    lang: 'ja' | 'en'
    sfx: boolean
    music: boolean
    haptics: boolean
    quality: 'low' | 'high'
  }
  lastDaily: string | null
  createdAt: number
}

const defaultStats = (): SaveData['stats'] => ({
  kills: 0,
  wavesCleared: 0,
  goldEarned: 0,
  towersBuilt: 0,
  bossesKilled: 0,
  maxWave: 0,
  perfectStages: 0,
  stagesCleared: 0,
  playSeconds: 0,
  evolutions: 0,
  researchSpent: 0,
  dailiesDone: 0,
  totalDamage: 0,
})

export const defaultSave = (): SaveData => ({
  schema: SCHEMA,
  coins: 0,
  research: {},
  stagesCleared: 0,
  stageStars: {},
  bestWave: 0,
  endlessBest: 0,
  arenaBest: 0,
  dailyBest: 0,
  dailiesDone: 0,
  achievements: [],
  stats: defaultStats(),
  settings: { lang: 'ja', sfx: true, music: true, haptics: true, quality: 'high' },
  lastDaily: null,
  createdAt: Date.now(),
})

/** Deep-merge loaded data over the defaults so new fields are always present. */
function migrate(raw: unknown): SaveData {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base
  const d = raw as Partial<SaveData>
  const out: SaveData = {
    ...base,
    ...d,
    schema: SCHEMA,
    research: { ...(d.research ?? {}) },
    stageStars: { ...(d.stageStars ?? {}) },
    stats: { ...base.stats, ...(d.stats ?? {}) },
    settings: { ...base.settings, ...(d.settings ?? {}) },
    achievements: Array.isArray(d.achievements) ? d.achievements : [],
  }
  // numeric safety
  out.coins = Math.max(0, Number(out.coins) || 0)
  out.stagesCleared = Math.max(0, Number(out.stagesCleared) || 0)
  for (const k of Object.keys(out.research)) {
    const v = Number(out.research[k])
    out.research[k] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
  }
  return out
}

let cache: SaveData | null = null

export function loadSave(): SaveData {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? migrate(JSON.parse(raw)) : defaultSave()
  } catch {
    cache = defaultSave()
  }
  return cache
}

let saveTimer = 0
export function saveNow(data: SaveData): void {
  cache = data
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* storage full or blocked - ignore */
  }
}

/** Debounced write; safe to call every frame. */
export function saveDebounced(data: SaveData, delay = 400): void {
  cache = data
  if (saveTimer) return
  saveTimer = window.setTimeout(() => {
    saveTimer = 0
    saveNow(data)
  }, delay)
}

export function resetSave(): SaveData {
  cache = defaultSave()
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  return cache
}

export const todayKey = (): string => dayKey()
