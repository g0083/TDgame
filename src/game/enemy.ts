import { ENEMY_BY_ID, ENEMY_SPEED_SCALE } from '../data/enemies'
import type { EnemyDef, EnemyId } from '../data/types'
import { clamp } from '../core/math'
import { samplePath, type PathMetrics } from '../core/pathfind'

export interface StatusState {
  slow: number
  slowTimer: number
  burn: number
  burnTimer: number
  poison: number
  poisonTimer: number
  poisonStacks: number
  stun: number
  freeze: number
  chill: number
  marked: number
}

export class Enemy {
  id: number
  def: EnemyDef
  hp = 0
  maxHp = 0
  shield = 0
  maxShield = 0
  /** distance travelled along the path, in px */
  dist = 0
  x = 0
  y = 0
  angle = 0
  baseSpeed: number
  bounty: number
  radius: number
  alive = true
  reachedCore = false
  hitFlash = 0
  flying = false
  slowImmune = false
  armored = false
  regen = 0
  hasShield = false
  isBoss = false
  isElite = false
  splitInto?: { id: EnemyId; count: number }
  summon?: { id: EnemyId; count: number; every: number }
  summonTimer = 0
  auraHeal = 0
  hidden = false
  phaser = false
  phaseT = 0
  phased = false
  enrage = false
  st: StatusState = {
    slow: 0,
    slowTimer: 0,
    burn: 0,
    burnTimer: 0,
    poison: 0,
    poisonTimer: 0,
    poisonStacks: 0,
    stun: 0,
    freeze: 0,
    chill: 0,
    marked: 0,
  }
  /** small sinusoidal offset so groups don't perfectly overlap */
  wobble: number
  scale: number
  spawnT = 0
  /** true on the frame the summoner should spawn children */
  wantsSummon = false

  constructor(id: number, defId: EnemyId, hpMul: number, speedMul: number) {
    this.id = id
    this.def = ENEMY_BY_ID[defId]
    this.maxHp = this.def.hp * hpMul
    this.hp = this.maxHp
    this.baseSpeed = this.def.speed * ENEMY_SPEED_SCALE * speedMul
    this.bounty = this.def.bounty
    this.radius = this.def.radius
    this.flying = this.def.traits.includes('flying')
    this.slowImmune = this.def.traits.includes('slowImmune')
    this.armored = this.def.traits.includes('armored')
    this.regen = this.def.traits.includes('regen') ? this.maxHp * 0.012 : 0
    this.hasShield = this.def.traits.includes('shield')
    this.isBoss = !!this.def.boss
    this.isElite = this.def.traits.includes('elite') || this.def.traits.includes('boss')
    this.splitInto = this.def.splitInto
    this.summon = this.def.summon
    this.auraHeal = this.def.auraHeal ?? 0
    this.hidden = this.def.traits.includes('stealth')
    this.phaser = this.def.traits.includes('phasing')
    this.scale = this.def.scale
    this.wobble = Math.random() * Math.PI * 2
    this.maxShield = this.maxHp * (this.hasShield ? 0.45 : 0)
    this.shield = this.maxShield
  }

  get targetable(): boolean {
    return this.alive && !this.phased
  }

  get effectiveSpeed(): number {
    if (this.st.freeze > 0 || this.st.stun > 0) return 0
    let s = 1 - clamp(this.st.slow, 0, 0.9)
    if (this.slowImmune) s = 1
    if (this.st.chill > 0) s *= 0.85
    let base = this.baseSpeed
    if (this.enrage) base *= 1.6
    return base * s
  }

  applySlow(amount: number, duration: number, strengthMul = 1): void {
    if (this.slowImmune) return
    const a = clamp(amount * strengthMul, 0, 0.9)
    if (a >= this.st.slow) {
      this.st.slow = a
      this.st.slowTimer = Math.max(this.st.slowTimer, duration)
    } else {
      this.st.slowTimer = Math.max(this.st.slowTimer, duration * 0.5)
    }
  }

  applyBurn(dps: number, duration: number): void {
    this.st.burn = Math.max(this.st.burn, dps)
    this.st.burnTimer = Math.max(this.st.burnTimer, duration)
  }

  applyPoison(dps: number, duration: number, maxStacks: number): void {
    this.st.poison = Math.max(this.st.poison, dps)
    this.st.poisonStacks = Math.min(maxStacks, this.st.poisonStacks + 1)
    this.st.poisonTimer = Math.max(this.st.poisonTimer, duration)
  }

  applyStun(duration: number): void {
    this.st.stun = Math.max(this.st.stun, duration)
  }

  applyFreeze(duration: number): void {
    this.st.freeze = Math.max(this.st.freeze, duration)
  }

  /** Returns actual damage dealt (used for stats/leech). */
  takeDamage(amount: number, ignoreArmor = false): number {
    if (!this.alive) return 0
    let dmg = amount
    if (!ignoreArmor && this.armored) {
      dmg = Math.max(dmg * 0.55, dmg - this.def.armor)
    }
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg)
      this.shield -= absorbed
      dmg -= absorbed
    }
    this.hp -= dmg
    this.hitFlash = 0.12
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
    }
    return amount
  }

  heal(amount: number): void {
    if (!this.alive) return
    // poison suppresses healing
    const mul = this.st.poisonTimer > 0 ? 0.25 : 1
    this.hp = Math.min(this.maxHp, this.hp + amount * mul)
  }

  updateStatuses(dt: number): number {
    let dot = 0
    const st = this.st
    if (st.slowTimer > 0) {
      st.slowTimer -= dt
      if (st.slowTimer <= 0) st.slow = 0
    }
    if (st.burnTimer > 0) {
      st.burnTimer -= dt
      dot += st.burn * dt
      if (st.burnTimer <= 0) st.burn = 0
    }
    if (st.poisonTimer > 0) {
      st.poisonTimer -= dt
      dot += st.poison * st.poisonStacks * dt
      if (st.poisonTimer <= 0) {
        st.poison = 0
        st.poisonStacks = 0
      }
    }
    if (st.stun > 0) st.stun = Math.max(0, st.stun - dt)
    if (st.freeze > 0) st.freeze = Math.max(0, st.freeze - dt)
    if (st.chill > 0) st.chill = Math.max(0, st.chill - dt)
    if (st.marked > 0) st.marked = Math.max(0, st.marked - dt)
    if (this.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt)
    if (this.hasShield && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.maxShield * 0.06 * dt)
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt)
    if (this.phaser) {
      this.phaseT += dt
      if (this.phaseT >= 3) {
        this.phaseT = 0
        this.phased = !this.phased
      }
    }
    if (this.isBoss && !this.enrage && this.hp < this.maxHp * 0.5) this.enrage = true
    if (this.summon) {
      this.summonTimer += dt
      if (this.summonTimer >= this.summon.every) {
        this.summonTimer = 0
        this.wantsSummon = true
      }
    }
    return dot
  }

  /** Move along the path. Returns true when the core is reached. */
  move(dt: number, metrics: PathMetrics): boolean {
    if (this.spawnT < 0.25) {
      this.spawnT += dt
      const p0 = samplePath(metrics, 0)
      this.x = p0.x
      this.y = p0.y
      return false
    }
    this.dist += this.effectiveSpeed * dt
    const total = metrics.total
    const p = samplePath(metrics, Math.min(this.dist, total))
    this.x = p.x
    this.y = p.y
    this.angle = p.angle
    if (this.dist >= total) {
      this.reachedCore = true
      this.alive = false
      return true
    }
    return false
  }
}

