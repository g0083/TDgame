import { TOWER_BY_ID } from '../data/towers'
import type { EvolveDef, TargetMode, TowerId, TowerLevel } from '../data/types'
import { cellCenterX, cellCenterY } from '../core/grid'

export interface TowerStats extends TowerLevel {
  damage: number
  range: number
  cooldown: number
}

export class Tower {
  id: number
  type: TowerId
  c: number
  r: number
  x: number
  y: number
  /** 1..maxLevel */
  level = 1
  evolve: EvolveDef | null = null
  cooldown = 0
  angle = -Math.PI / 2
  targetMode: TargetMode = 'first'
  invested: number
  /** buffs from Amplifiers, recomputed each frame */
  buffDamage = 0
  buffRate = 0
  /** total damage dealt, for stats */
  damageDealt = 0
  kills = 0
  /** fire animation timer */
  fireFlash = 0
  /** for beams: current target */
  beamAngle = -Math.PI / 2
  spin = Math.random() * Math.PI * 2
  /** id of the enemy currently being shot (for drawing the tracer) */
  lastTargetX = 0
  lastTargetY = 0

  constructor(id: number, type: TowerId, c: number, r: number, invested: number) {
    this.id = id
    this.type = type
    this.c = c
    this.r = r
    this.x = cellCenterX(c)
    this.y = cellCenterY(r)
    this.invested = invested
  }

  get def() {
    return TOWER_BY_ID[this.type]
  }

  /** Base stats of the current level, before evolutions / buffs. */
  baseStats(): TowerStats {
    const lvl = this.def.levels[Math.min(this.level, this.def.levels.length) - 1]
    return { ...lvl }
  }

  /**
   * Final combat stats: level base × evolution multipliers + additive effects
   * × global research × amplifier buffs × adjacency synergy.
   */
  stats(
    meta: {
      damageMul: number
      rateMul: number
      rangeMul: number
      critAdd: number
      pierceAdd: number
      dotMul: number
      evoDamageMul: number
    },
    synergy: Partial<TowerLevel> | null,
  ): TowerStats {
    const s = this.baseStats()
    const out: TowerStats = { ...s }
    const evoMul = this.evolve?.mul
    const evoAdd = this.evolve?.add
    if (evoMul) {
      for (const k of Object.keys(evoMul) as (keyof TowerLevel)[]) {
        const v = (out[k] as number) ?? 0
        ;(out[k] as number) = v * ((evoMul[k] as number) ?? 1)
      }
    }
    if (evoAdd) {
      for (const k of Object.keys(evoAdd) as (keyof TowerLevel)[]) {
        const v = (out[k] as number) ?? 0
        ;(out[k] as number) = v + ((evoAdd[k] as number) ?? 0)
      }
    }
    if (synergy) {
      for (const k of Object.keys(synergy) as (keyof TowerLevel)[]) {
        const v = synergy[k]
        if (v === undefined) continue
        const cur = (out[k] as number) ?? 0
        if (k === 'damage' || k === 'range' || k === 'splash' || k === 'burn' || k === 'poison' || k === 'crit' || k === 'slow') {
          ;(out[k] as number) = cur * v
        } else {
          ;(out[k] as number) = cur + v
        }
      }
    }
    const evolvedMul = this.evolve ? meta.evoDamageMul : 1
    out.damage = (out.damage ?? 0) * meta.damageMul * evolvedMul * (1 + this.buffDamage)
    out.cooldown = Math.max(0.04, (out.cooldown ?? 1) / (meta.rateMul * (1 + this.buffRate)))
    out.range = (out.range ?? 60) * meta.rangeMul
    out.crit = (out.crit ?? 0) + meta.critAdd
    out.pierce = (out.pierce ?? 0) + meta.pierceAdd
    if (out.burn) out.burn *= meta.dotMul
    if (out.poison) out.poison *= meta.dotMul
    return out
  }

  /** Base stats of an arbitrary level, before evolutions / buffs. */
  statsOfLevel(level: number): TowerStats {
    const idx = Math.max(1, Math.min(level, this.def.levels.length)) - 1
    return { ...this.def.levels[idx] }
  }

  get maxLevelReached(): boolean {
    return this.level >= this.def.maxLevel
  }

  get canEvolve(): boolean {
    return this.level >= this.def.maxLevel && !this.evolve && !!this.def.evolves
  }

  get displayName(): string {
    return this.evolve ? this.evolve.name : this.def.name
  }

  tickAnim(dt: number): void {
    if (this.fireFlash > 0) this.fireFlash = Math.max(0, this.fireFlash - dt * 4)
    this.spin += dt * (this.type === 'tesla' ? 3.2 : 0.6)
  }
}
