export type DamageType = 'physical' | 'energy' | 'magic'

export type TowerKind =
  | 'single' // fast single target projectile
  | 'sniper' // pierce, long range, high crit
  | 'splash' // lobbed AoE
  | 'chain' // lightning arcs
  | 'beam' // continuous piercing beam
  | 'flame' // short cone DoT
  | 'frost' // aura slow
  | 'poison' // DoT stacking
  | 'wall' // slows + blocks/taunts
  | 'support' // buffs nearby towers
  | 'economy' // generates gold
  | 'trap' // one-shot high damage vs single

export type TargetMode = 'first' | 'last' | 'strong' | 'close' | 'weak'

export type TowerId =
  | 'arrow'
  | 'cannon'
  | 'mortar'
  | 'frost'
  | 'tesla'
  | 'poison'
  | 'sniper'
  | 'beam'
  | 'flame'
  | 'amp'
  | 'mine'
  | 'wall'

export type EvolveId = string

export interface TowerLevel {
  damage: number
  range: number
  cooldown: number
  /** number of projectiles fired per volley */
  shots?: number
  /** splash radius in px */
  splash?: number
  /** chain target count */
  chains?: number
  /** armor pierce 0..1 */
  pierce?: number
  crit?: number
  slow?: number
  slowDur?: number
  burn?: number
  poison?: number
  /** support aura */
  buffDamage?: number
  buffRate?: number
  /** economy */
  gold?: number
  /** special custom flag */
  special?: number
}

export interface EvolveDef {
  id: EvolveId
  name: string
  nameJa: string
  desc: string
  descJa: string
  color: string
  /** multipliers applied on top of the level stats */
  mul?: Partial<Record<keyof TowerLevel, number>>
  add?: Partial<Record<keyof TowerLevel, number>>
  /** replaces targeting behaviour */
  tag?: string
}

export interface TowerDef {
  id: TowerId
  name: string
  nameJa: string
  kind: TowerKind
  cost: number
  damageType: DamageType
  desc: string
  descJa: string
  color: string
  accent: string
  /** unlock: null = available from start */
  unlock: { stagesCleared: number; research?: string } | null
  maxLevel: number
  levels: TowerLevel[]
  evolves: [EvolveDef, EvolveDef] | null
  /** adjacency synergy: bonus when a neighbor of given type exists */
  synergy?: { with: TowerId; label: string; labelJa: string; effect: Partial<TowerLevel> }
  icon: string
}

export type EnemyId =
  | 'grunt'
  | 'runner'
  | 'brute'
  | 'armored'
  | 'shielded'
  | 'flyer'
  | 'healer'
  | 'splitter'
  | 'stealth'
  | 'cursed'
  | 'swarmer'
  | 'summoner'
  | 'phaser'
  | 'juggernaut'
  | 'boss_rush'
  | 'boss_swarm'
  | 'boss_titan'

export interface EnemyDef {
  id: EnemyId
  name: string
  nameJa: string
  hp: number
  speed: number
  /** base damage to the core if it reaches the goal */
  leak: number
  bounty: number
  radius: number
  color: string
  accent: string
  armor: number
  traits: string[]
  desc: string
  descJa: string
  boss?: boolean
  /** spawns children on death */
  splitInto?: { id: EnemyId; count: number }
  /** summons periodically */
  summon?: { id: EnemyId; count: number; every: number }
  /** heals nearby allies */
  auraHeal?: number
  shape: 'circle' | 'square' | 'triangle' | 'hex' | 'diamond' | 'star'
  scale: number
}

export type ResearchId = string

export interface ResearchDef {
  id: ResearchId
  name: string
  nameJa: string
  desc: string
  descJa: string
  branch: 'economy' | 'power' | 'utility' | 'fortress'
  maxRank: number
  cost: (rank: number) => number
  icon: string
  effect: string
  effectJa: string
}

export interface AchievementDef {
  id: string
  name: string
  nameJa: string
  desc: string
  descJa: string
  icon: string
  /** progress function evaluated against stats snapshot */
  progress: (s: StatsSnapshot) => number
  goal: number
  reward: number
}

export interface StatsSnapshot {
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
  coins: number
}

export interface WaveEntry {
  id: EnemyId
  count: number
  /** seconds between each spawn */
  gap: number
  /** seconds after wave start before this group begins */
  delay?: number
}

export interface WaveDef {
  entries: WaveEntry[]
  /** reward granted on clear */
  reward: number
  /** hp multiplier applied to all enemies in this wave */
  hpMul?: number
  boss?: boolean
}

export interface StageDef {
  id: string
  name: string
  nameJa: string
  index: number
  /** grid path (cell coords) from spawn to core */
  path: { c: number; r: number }[]
  /** additional non-path blocked cells (decor / obstacles) */
  rocks: { c: number; r: number }[]
  lives: number
  startGold: number
  waves: WaveDef[]
  background: string
  accent: string
  reward: number
  unlock: { stagesCleared: number } | null
}

export type AbilityId = 'freeze' | 'airstrike' | 'rush' | 'repair' | 'meteor'

export interface AbilityDef {
  id: AbilityId
  name: string
  nameJa: string
  desc: string
  descJa: string
  charges: number
  cooldown: number
  icon: string
}
