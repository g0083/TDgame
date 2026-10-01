import { CELL, COLS, ROWS, cellCenterX, cellCenterY, key } from '../core/grid'
import { buildMetrics, cellsToPoints, straightPath, type PathMetrics } from '../core/pathfind'
import { clamp } from '../core/math'
import { ENEMY_BY_ID } from '../data/enemies'
import { TOWER_BY_ID, towerSellValue, towerUpgradeCost } from '../data/towers'
import { ABILITIES } from '../data/abilities'
import { makeEndlessWave } from '../data/waves'
import { endlessPool, STAGES } from '../data/stages'
import type {
  AbilityId,
  EnemyId,
  EvolveDef,
  StageDef,
  TargetMode,
  TowerId,
  WaveDef,
} from '../data/types'
import { Fx } from '../render/fx'
import { audio } from '../audio/synth'
import { Enemy } from './enemy'
import { makeProjectile, type Projectile } from './projectile'
import { Tower, type TowerStats } from './tower'
import type { MetaBonus } from '../save/meta'

export type BattleMode = 'stage' | 'endless' | 'daily' | 'arena'

export interface BattleResult {
  victory: boolean
  wavesCleared: number
  kills: number
  goldEarned: number
  damageDealt: number
  livesLeft: number
  perfect: boolean
  coins: number
  mode: BattleMode
  stageId: string | null
}

export interface AbilityState {
  id: AbilityId
  charges: number
  maxCharges: number
  cd: number
  cooldown: number
}

const ABILITY_IDS: AbilityId[] = ['freeze', 'airstrike', 'meteor', 'rush', 'repair']

export interface BattleOptions {
  meta: MetaBonus
  mode: BattleMode
  stage: StageDef | null
  /** fallback map when there is no stage (endless on an empty stage field) */
  map: StageDef
  customWaves?: WaveDef[] | null
  /** extra enemy hp multiplier (daily / arena) */
  hpMul?: number
  speedMul?: number
}

export class Battle {
  mode: BattleMode = 'stage'
  stage: StageDef | null = null
  map: StageDef
  customWaves: WaveDef[] | null = null
  meta: MetaBonus
  fx = new Fx()

  gold: number
  lives: number
  maxLives: number
  wave = 0
  totalWaves: number
  waveActive = false
  paused = false
  speed = 1
  autoWave = false
  over = false
  victory = false
  started = false

  enemies: Enemy[] = []
  towers: Tower[] = []
  projectiles: Projectile[] = []
  /** cells occupied by towers or rocks */
  blocked = new Set<number>()
  /** path cells (never buildable) */
  pathCells = new Set<number>()
  pathMetrics: PathMetrics
  private flyMetrics: PathMetrics
  coreX = 0
  coreY = 0
  spawnX = 0

  /** pending spawns for the current wave */
  private spawnQueue: { id: EnemyId; at: number }[] = []
  private waveTime = 0

  // run stats
  kills = 0
  bossesKilled = 0
  goldEarned = 0
  damageDealt = 0
  towersBuilt = 0
  evolutions = 0
  wavesCleared = 0
  shieldCharges = 0
  lifeRegenAcc = 0

  abilities: AbilityState[] = []
  /** temporary global attack-speed buff timer */
  rushTimer = 0
  private idCounter = 1
  private rng = Math.random
  /** cached path polyline for rendering */
  private points: { x: number; y: number }[] = []

  /** called when a wave is fully cleared */
  onWaveClear: ((wave: number, reward: number) => void) | null = null
  onGameOver: ((res: BattleResult) => void) | null = null
  onLeak: ((lost: number) => void) | null = null

  constructor(opts: BattleOptions) {
    this.meta = opts.meta
    this.mode = opts.mode
    this.stage = opts.stage
    this.map = opts.map
    this.customWaves = opts.customWaves ?? null
    this.hpExtraMul = opts.hpMul ?? 1
    this.speedExtraMul = opts.speedMul ?? 1
    this.totalWaves = this.customWaves
      ? this.customWaves.length
      : opts.stage
        ? opts.stage.waves.length
        : 0
    // endless / arena / daily have no stage, so they use their own allowances
    const stageLives = opts.stage?.lives ?? (this.mode === 'stage' ? 20 : 26)
    this.lives = stageLives + this.meta.lives
    this.maxLives = this.lives
    this.shieldCharges = this.meta.shieldPerWave

    const cells = this.map.path
    const pts = cellsToPoints(cells)
    this.points = pts
    this.pathMetrics = buildMetrics(pts)
    // a longer map needs a bigger opening purse so early towers can be placed
    const baseGold = opts.stage
      ? opts.stage.startGold
      : Math.round(320 + Math.max(0, this.pathMetrics.total - 2600) * 0.1)
    this.gold = baseGold + this.meta.startGold
    const last = cells[cells.length - 1]
    this.spawnX = cells[0].c * CELL + CELL / 2
    this.coreX = last.c * CELL + CELL / 2
    this.coreY = ROWS * CELL + CELL - 6
    this.flyMetrics = buildMetrics(
      straightPath({ x: this.spawnX, y: -CELL }, { x: this.coreX, y: this.coreY }),
    )
    for (const c of cells) this.pathCells.add(key(c.c, c.r))
    for (const r of this.map.rocks) this.blocked.add(key(r.c, r.r))
    this.abilities = ABILITY_IDS.map((id) => {
      const def = ABILITIES.find((a) => a.id === id)!
      const max = def.charges + this.meta.abilityCharges
      return { id, charges: max, maxCharges: max, cd: 0, cooldown: def.cooldown }
    })
  }

  /** Polyline of the map path in field coordinates (for rendering). */
  get pathPoints() {
    return this.points
  }

  hpExtraMul = 1
  speedExtraMul = 1

  get currentWaveDef(): WaveDef | null {
    const w = this.wave + 1
    if (this.customWaves) return this.customWaves[w - 1] ?? null
    if (this.mode === 'endless' || this.mode === 'arena') {
      return makeEndlessWave(w, endlessPool(w), this.mode === 'arena' ? 4 : 5)
    }
    return this.stage?.waves[w - 1] ?? null
  }

  waveNumber(): number {
    return this.wave + 1
  }

  get isBossWave(): boolean {
    return !!this.currentWaveDef?.boss
  }

  // ── building ────────────────────────────────────────────────

  canBuild(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false
    return !this.blocked.has(key(c, r))
  }

  buildCost(type: TowerId): number {
    return Math.round(TOWER_BY_ID[type].cost * this.meta.buildCostMul)
  }

  upgradeCost(t: Tower): number {
    return Math.round(towerUpgradeCost(t.def, t.level) * this.meta.upgradeCostMul)
  }

  evolveCost(t: Tower): number {
    return Math.round(t.def.cost * 2.6 * this.meta.upgradeCostMul)
  }

  sellValue(t: Tower): number {
    return Math.round(towerSellValue(t.def, t.level) * this.meta.sellMul)
  }

  build(type: TowerId, c: number, r: number): Tower | null {
    if (!this.canBuild(c, r)) return null
    const cost = this.buildCost(type)
    if (this.gold < cost) {
      audio.play('deny')
      return null
    }
    this.gold -= cost
    const t = new Tower(this.idCounter++, type, c, r, cost)
    this.towers.push(t)
    this.blocked.add(key(c, r))
    this.towersBuilt++
    audio.play('build')
    this.fx.ring(t.x, t.y, 26, t.def.color, 3, 0.4)
    this.fx.burst(t.x, t.y, t.def.color, 8, 70, 2.5)
    return t
  }

  upgrade(t: Tower): boolean {
    if (t.level >= t.def.maxLevel || t.evolve) return false
    const cost = this.upgradeCost(t)
    if (this.gold < cost) {
      audio.play('deny')
      return false
    }
    this.gold -= cost
    t.invested += cost
    t.level++
    audio.play('upgrade')
    this.fx.ring(t.x, t.y, 30, t.def.color, 3, 0.4)
    this.fx.burst(t.x, t.y, t.def.color, 12, 90, 2.5)
    this.fx.text(t.x, t.y - 16, `Lv${t.level}`, '#ffffff', 14)
    return true
  }

  evolve(t: Tower, choice: 0 | 1): boolean {
    if (!t.canEvolve || !t.def.evolves) return false
    const cost = this.evolveCost(t)
    if (this.gold < cost) {
      audio.play('deny')
      return false
    }
    this.gold -= cost
    t.invested += cost
    t.evolve = t.def.evolves[choice]
    this.evolutions++
    audio.play('evolve')
    this.fx.addFlash(0.35, t.evolve.color)
    this.fx.addShake(6)
    this.fx.ring(t.x, t.y, 54, t.evolve.color, 4, 0.6)
    this.fx.burst(t.x, t.y, t.evolve.color, 24, 150, 3)
    return true
  }

  sell(t: Tower): void {
    const i = this.towers.indexOf(t)
    if (i < 0) return
    this.towers.splice(i, 1)
    this.blocked.delete(key(t.c, t.r))
    this.gold += this.sellValue(t)
    audio.play('sell')
    this.fx.burst(t.x, t.y, '#888888', 10, 80, 2.5)
  }

  cycleTarget(t: Tower): void {
    const modes: TargetMode[] = ['first', 'last', 'strong', 'close', 'weak']
    const i = modes.indexOf(t.targetMode)
    t.targetMode = modes[(i + 1) % modes.length]
    audio.play('click')
  }

  towerAt(c: number, r: number): Tower | null {
    for (const t of this.towers) if (t.c === c && t.r === r) return t
    return null
  }

  // ── wave control ────────────────────────────────────────────

  startWave(): void {
    if (this.waveActive || this.over) return
    const def = this.currentWaveDef
    if (!def) return
    this.waveActive = true
    this.started = true
    this.waveTime = 0
    this.spawnQueue = []
    for (const e of def.entries) {
      const delay = e.delay ?? 0
      for (let i = 0; i < e.count; i++) {
        this.spawnQueue.push({ id: e.id, at: delay + i * e.gap })
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at)
    if (this.meta.waveGold > 0) this.addGold(this.meta.waveGold)
    if (this.meta.interest > 0) {
      const interest = Math.floor(this.gold * this.meta.interest)
      if (interest > 0) {
        this.addGold(interest)
        this.fx.text(this.coreX, this.coreY - 40, `+${interest}`, '#ffd76b', 14)
      }
    }
    audio.play(def.boss ? 'boss' : 'wave')
  }

  addGold(n: number): void {
    this.gold += n
    this.goldEarned += n
  }

  private spawnEnemy(id: EnemyId): void {
    const def = this.currentWaveDef
    const hpMul = (def?.hpMul ?? 1) * this.meta.enemyHpMul * this.hpExtraMul
    const e = new Enemy(this.idCounter++, id, hpMul, this.speedExtraMul)
    if (e.flying) {
      e.dist = 0
    }
    this.enemies.push(e)
    if (e.isBoss) {
      this.fx.addShake(8)
      this.fx.addFlash(0.3, '#ff5555')
    }
  }


  // ── main update ─────────────────────────────────────────────

  update(rawDt: number): void {
    if (this.paused || this.over) {
      this.fx.update(rawDt * 0.35)
      return
    }
    const steps = this.speed
    const dt = Math.min(0.05, rawDt) * steps
    for (let s = 0; s < steps; s++) this.step(Math.min(0.05, rawDt))
    this.fx.update(rawDt)
    if (this.rushTimer > 0) this.rushTimer = Math.max(0, this.rushTimer - rawDt)
    for (const a of this.abilities) {
      if (a.charges < a.maxCharges && a.cd > 0) a.cd = Math.max(0, a.cd - rawDt)
    }
    if (this.meta.lifeRegen > 0 && this.lives < this.maxLives) {
      this.lifeRegenAcc += this.meta.lifeRegen * rawDt
      if (this.lifeRegenAcc >= 1) {
        const n = Math.floor(this.lifeRegenAcc)
        this.lifeRegenAcc -= n
        this.lives = Math.min(this.maxLives, this.lives + n)
      }
    }
    void dt
  }

  private step(dt: number): void {
    // spawning
    if (this.waveActive) {
      this.waveTime += dt
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime) {
        const s = this.spawnQueue.shift()!
        this.spawnEnemy(s.id)
      }
    }

    // enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      if (!e.alive) {
        this.onEnemyDeath(e, i)
        continue
      }
      const dot = e.updateStatuses(dt)
      if (dot > 0) {
        this.dealDamage(e, dot, true, false, false)
      }
      if (e.wantsSummon) {
        e.wantsSummon = false
        if (e.summon) {
          for (let k = 0; k < e.summon.count; k++) {
            const child = new Enemy(this.idCounter++, e.summon.id, 1, 1)
            child.dist = Math.max(0, e.dist - 20)
            this.enemies.push(child)
          }
          this.fx.burst(e.x, e.y, e.def.color, 10, 80, 2.5)
        }
      }
      if (!e.alive) {
        this.onEnemyDeath(e, i)
        continue
      }
      const metrics = e.flying ? this.flyMetrics : this.pathMetrics
      if (e.move(dt, metrics)) {
        this.handleLeak(e)
        this.enemies.splice(i, 1)
      }
    }

    // healer auras
    this.applyHealers(dt)

    // towers
    this.updateAmplifiers()
    for (const t of this.towers) {
      t.tickAnim(dt)
      const st = this.towerStats(t)
      if (t.cooldown > 0) t.cooldown -= dt
      this.fireTower(t, st, dt)
    }

    // projectiles
    this.updateProjectiles(dt)

    // meteors
    this.updateMeteors(dt)

    // wave completion
    this.checkWaveEnd()
  }

  private applyHealers(dt: number): void {
    for (const h of this.enemies) {
      if (!h.auraHeal || !h.alive) continue
      for (const o of this.enemies) {
        if (o === h || !o.alive) continue
        const d = Math.hypot(o.x - h.x, o.y - h.y)
        if (d < 70) o.heal(h.auraHeal * dt)
      }
    }
  }

  private updateAmplifiers(): void {
    for (const t of this.towers) {
      t.buffDamage = 0
      t.buffRate = 0
    }
    const amps = this.towers.filter((t) => t.def.kind === 'support')
    if (amps.length === 0) return
    for (const amp of amps) {
      const st = this.towerStats(amp)
      const stackMul = amp.evolve?.tag === 'stack' ? 1 + (amps.length - 1) * 0.2 : 1
      for (const t of this.towers) {
        if (t === amp) continue
        if (t.def.kind === 'support') continue
        const d = Math.hypot(t.x - amp.x, t.y - amp.y)
        if (d > st.range) continue
        t.buffDamage += (st.buffDamage ?? 0) * stackMul
        t.buffRate += (st.buffRate ?? 0) * stackMul
        if (amp.evolve?.tag === 'risk') {
          for (const e of this.enemies) {
            if (Math.hypot(e.x - amp.x, e.y - amp.y) <= st.range) e.st.marked = Math.max(e.st.marked, 0.1)
          }
        }
      }
    }
  }

  /** Adjacency synergy: returns the modifier if a matching neighbour exists. */
  private synergyFor(t: Tower): Record<string, number> | null {
    const syn = t.def.synergy
    if (!syn) return null
    for (const o of this.towers) {
      if (o === t || o.type !== syn.with) continue
      if (Math.abs(o.c - t.c) + Math.abs(o.r - t.r) === 1) {
        const out: Record<string, number> = {}
        for (const [k, v] of Object.entries(syn.effect)) {
          if (typeof v === 'number') out[k] = 1 + (v - 1) * this.meta.synergyMul
        }
        return out
      }
    }
    return null
  }

  towerStats(t: Tower): TowerStats {
    const rateMul = this.rushTimer > 0 ? this.meta.rateMul * 2 : this.meta.rateMul
    return t.stats({ ...this.meta, rateMul }, this.synergyFor(t) as never)
  }

  /** Preview of the stats a tower would have at the next level. */
  previewUpgrade(t: Tower): TowerStats | null {
    if (t.level >= t.def.maxLevel || t.evolve) return null
    const preview = new Tower(t.id, t.type, t.c, t.r, t.invested)
    preview.level = t.level + 1
    preview.evolve = t.evolve
    const rateMul = this.rushTimer > 0 ? this.meta.rateMul * 2 : this.meta.rateMul
    return preview.stats({ ...this.meta, rateMul }, this.synergyFor(t) as never)
  }

  /** true if this tower has an active adjacency synergy right now. */
  hasSynergy(t: Tower): boolean {
    return this.synergyFor(t) !== null
  }

  private enemiesInRange(t: Tower, range: number): Enemy[] {
    const out: Enemy[] = []
    for (const e of this.enemies) {
      if (!e.targetable) continue
      if (e.hidden && e.dist > 120) continue
      const d = Math.hypot(e.x - t.x, e.y - t.y)
      if (d <= range) out.push(e)
    }
    return out
  }

  private pickTarget(t: Tower, list: Enemy[]): Enemy | null {
    if (list.length === 0) return null
    switch (t.targetMode) {
      case 'first': {
        let best = list[0]
        for (const e of list) if (e.dist > best.dist) best = e
        return best
      }
      case 'last': {
        let best = list[0]
        for (const e of list) if (e.dist < best.dist) best = e
        return best
      }
      case 'strong': {
        let best = list[0]
        for (const e of list) if (e.hp + e.shield > best.hp + best.shield) best = e
        return best
      }
      case 'weak': {
        let best = list[0]
        for (const e of list) if (e.hp + e.shield < best.hp + best.shield) best = e
        return best
      }
      case 'close': {
        let best = list[0]
        let bd = Infinity
        for (const e of list) {
          const d = Math.hypot(e.x - t.x, e.y - t.y)
          if (d < bd) {
            bd = d
            best = e
          }
        }
        return best
      }
      default:
        return list[0]
    }
  }

  private canHit(t: Tower, e: Enemy): boolean {
    if (e.flying) {
      // only these tower types can hit air
      return t.type === 'mortar' || t.type === 'sniper' || t.type === 'beam' || t.type === 'tesla'
    }
    return true
  }



  private fireTower(t: Tower, st: TowerStats, dt: number): void {
    const kind = t.def.kind

    // ── non-attacking / support kinds ──
    if (kind === 'support') return

    if (kind === 'economy') {
      const gold = (st.gold ?? 0) * this.meta.mineMul * dt
      this.gold += gold
      this.goldEarned += gold
      if (t.evolve?.tag === 'hybrid' && t.cooldown <= 0) {
        t.cooldown = st.cooldown
        // geyser erupts on the nearest enemy
        const list = this.enemiesInRange(t, st.range + 30)
        const target = this.pickTarget(t, list)
        if (target) {
          this.areaDamage(t, target.x, target.y, st.splash ?? 40, st.damage, st)
          audio.play('splash')
        }
      }
      return
    }

    // ── continuous beam: fires every frame while a target is in range ──
    if (kind === 'beam') {
      const list = this.enemiesInRange(t, st.range).filter((e) => this.canHit(t, e))
      if (list.length === 0) return
      const target = this.pickTarget(t, list)
      if (!target) return
      t.angle = Math.atan2(target.y - t.y, target.x - t.x)
      t.beamAngle = t.angle
      t.lastTargetX = target.x
      t.lastTargetY = target.y
      const shots = st.shots ?? 1
      for (let s = 0; s < shots; s++) {
        const a = t.angle + (shots > 1 ? (s - (shots - 1) / 2) * 0.28 : 0)
        this.beamHit(t, st, a, dt)
      }
      return
    }

    // ── flame: short cone, continuous ──
    if (kind === 'flame') {
      if (t.cooldown > 0) return
      t.cooldown = st.cooldown
      const list = this.enemiesInRange(t, st.range)
      if (list.length === 0) return
      const target = this.pickTarget(t, list)
      if (!target) return
      t.angle = Math.atan2(target.y - t.y, target.x - t.x)
      t.fireFlash = 1
      const nova = t.evolve?.tag === 'nova'
      for (const e of list) {
        const a = Math.atan2(e.y - t.y, e.x - t.x)
        let diff = Math.abs(((a - t.angle + Math.PI) % (Math.PI * 2)) - Math.PI)
        if (nova) diff = 0
        else if (diff > 0.6) continue
        this.dealDamage(e, st.damage, false, false, false, t)
        if (st.burn) e.applyBurn(st.burn, 2.5)
        if (t.evolve?.tag === 'pyre' || t.evolve?.tag === 'burn') {
          this.fx.particle({
            x: e.x,
            y: e.y,
            color: '#ff9a3c',
            life: 0.4,
            maxLife: 0.4,
            size: 4,
            vy: -20,
          })
        }
      }
      audio.play('flame')
      return
    }

    // ── frost / wall: aura pulse on cooldown ──
    if (kind === 'frost' || kind === 'wall') {
      if (t.cooldown > 0) return
      t.cooldown = st.cooldown
      const list = this.enemiesInRange(t, st.range)
      if (list.length === 0) return
      for (const e of list) {
        this.dealDamage(e, st.damage, false, false, false, t)
        e.applySlow(st.slow ?? 0.3, st.slowDur ?? 1.5, this.meta.slowMul)
        if (t.evolve?.tag === 'chill') e.st.chill = 2
        if (t.evolve?.tag === 'freeze') e.applyFreeze(0.6 * this.meta.freezeMul)
        if (t.evolve?.tag === 'thorns' && Math.hypot(e.x - t.x, e.y - t.y) < 26) {
          e.applyStun(0.3)
        }
      }
      audio.play(kind === 'frost' ? 'freeze' : 'hit')
      this.fx.ring(t.x, t.y, st.range, t.def.color, 2, 0.4)
      return
    }

    // ── chain lightning: instant hitscan that jumps ──
    if (kind === 'chain') {
      if (t.cooldown > 0) return
      t.cooldown = st.cooldown
      const list = this.enemiesInRange(t, st.range).filter((e) => this.canHit(t, e))
      if (list.length === 0) return
      const first = this.pickTarget(t, list)
      if (!first) return
      t.angle = Math.atan2(first.y - t.y, first.x - t.x)
      t.fireFlash = 1
      let current = first
      const hit = new Set<number>()
      const chains = st.chains ?? 1
      let dmg = st.damage
      for (let i = 0; i < chains; i++) {
        hit.add(current.id)
        this.dealDamage(current, dmg, false, false, false, t)
        this.fx.beam(t.x, t.y, current.x, current.y, t.evolve?.color ?? t.def.color, 2.5)
        // find next nearest
        let next: Enemy | null = null
        let bd = 70
        for (const e of this.enemiesInRange(t, st.range * 1.2)) {
          if (hit.has(e.id)) continue
          const d = Math.hypot(e.x - current.x, e.y - current.y)
          if (d < bd) {
            bd = d
            next = e
          }
        }
        if (!next) break
        this.fx.beam(current.x, current.y, next.x, next.y, t.evolve?.color ?? t.def.color, 2)
        current = next
        dmg *= 0.85
      }
      audio.play('zap')
      return
    }


    // ── projectile towers: single / sniper / splash / poison ──
    if (t.cooldown > 0) return
    const list = this.enemiesInRange(t, st.range).filter((e) => this.canHit(t, e))
    if (list.length === 0) return
    const target = this.pickTarget(t, list)
    if (!target) return

    const shots = st.shots ?? 1
    const isSniper = kind === 'sniper'
    const isSplash = kind === 'splash'
    const isPoison = kind === 'poison'

    // sniper hitscan with pierce along the line
    if (isSniper) {
      t.cooldown = st.cooldown
      t.angle = Math.atan2(target.y - t.y, target.x - t.x)
      t.fireFlash = 1
      for (let s = 0; s < shots; s++) {
        const a = t.angle + (shots > 1 ? (s - (shots - 1) / 2) * 0.1 : 0)
        this.hitscan(t, st, a)
      }
      audio.play('shoot')
      return
    }

    t.cooldown = st.cooldown
    t.angle = Math.atan2(target.y - t.y, target.x - t.x)
    t.fireFlash = 1

    for (let s = 0; s < shots; s++) {
      const spread = shots > 1 ? (s - (shots - 1) / 2) * 0.22 : 0
      const crit = Math.random() < (st.crit ?? 0)
      let dmg = st.damage
      if (crit) dmg *= 2
      // mortar targets a ground position (can hit air), others home in
      const ballistic = t.type === 'mortar' || t.type === 'cannon'
      const p = makeProjectile({
        x: t.x,
        y: t.y,
        tx: target.x,
        ty: target.y,
        targetId: ballistic ? -1 : target.id,
        ballistic,
        damage: dmg,
        damageType: t.def.damageType,
        crit,
        pierce: st.pierce ?? 0,
        splash: st.splash ?? 0,
        slow: st.slow ?? 0,
        slowDur: st.slowDur ?? 0,
        burn: st.burn ?? 0,
        poison: isPoison ? (st.poison ?? 0) : 0,
        poisonStacks: isPoison ? (st.special ?? 3) : 0,
        color: t.evolve?.color ?? t.def.color,
        kind: isSplash ? 'shell' : t.type === 'sniper' ? 'bullet' : isPoison ? 'orb' : 'bolt',
        speed: isSplash ? 260 : 420,
        arc: isSplash ? 40 : 0,
        sourceTower: t.id,
        tag: t.evolve?.tag ?? '',
      })
      // offset direction
      const a = t.angle + spread
      p.vx = Math.cos(a) * p.speed
      p.vy = Math.sin(a) * p.speed
      this.projectiles.push(p)
    }
    audio.play(isSplash ? 'splash' : isPoison ? 'zap' : 'shoot')
  }

  private hitscan(t: Tower, st: TowerStats, angle: number): void {
    const maxRange = st.range
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const ex = t.x + dx * maxRange
    const ey = t.y + dy * maxRange
    this.fx.beam(t.x, t.y, ex, ey, t.evolve?.color ?? t.def.color, 2)
    // sort enemies by distance along the line
    const hits: { e: Enemy; d: number }[] = []
    for (const e of this.enemies) {
      if (!e.targetable) continue
      if (!this.canHit(t, e)) continue
      if (e.hidden && e.dist > 120) continue
      const rel = (e.x - t.x) * dx + (e.y - t.y) * dy
      if (rel < 0 || rel > maxRange) continue
      const perp = Math.abs((e.x - t.x) * dy - (e.y - t.y) * dx)
      if (perp > e.radius + 4) continue
      hits.push({ e, d: rel })
    }
    hits.sort((a, b) => a.d - b.d)
    const maxHits = (st.pierce ?? 0) + 1
    for (let i = 0; i < hits.length && i < maxHits; i++) {
      const e = hits[i].e
      const crit = Math.random() < (st.crit ?? 0)
      this.dealDamage(e, st.damage * (crit ? 2 : 1), false, crit, false, t)
      if (st.slow) e.applySlow(st.slow, st.slowDur ?? 1, this.meta.slowMul)
    }
  }

  private beamHit(t: Tower, st: TowerStats, angle: number, dt: number): void {
    const maxRange = st.range
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const ex = t.x + dx * maxRange
    const ey = t.y + dy * maxRange
    this.fx.beam(t.x, t.y, ex, ey, t.evolve?.color ?? t.def.color, 2.5)
    for (const e of this.enemies) {
      if (!e.targetable) continue
      if (!this.canHit(t, e)) continue
      if (e.hidden && e.dist > 120) continue
      const rel = (e.x - t.x) * dx + (e.y - t.y) * dy
      if (rel < 0 || rel > maxRange) continue
      const perp = Math.abs((e.x - t.x) * dy - (e.y - t.y) * dx)
      if (perp > e.radius + 3) continue
      const crit = Math.random() < (st.crit ?? 0)
      this.dealDamage(e, st.damage * dt * (crit ? 2 : 1), false, crit, false, t)
      if (st.burn) e.applyBurn(st.burn, 1.5)
    }
  }


  // ── damage plumbing ─────────────────────────────────────────

  dealDamage(
    e: Enemy,
    amount: number,
    isDot = false,
    crit = false,
    ignoreArmor = false,
    source?: Tower,
  ): void {
    if (!e.alive || amount <= 0) return
    let dmg = amount
    if (!isDot) {
      dmg *= this.meta.damageMul
      if (e.isBoss) dmg *= this.meta.bossDamageMul
    } else {
      dmg *= this.meta.dotMul
    }
    // chill bonus: slowed enemies take extra damage from blizzard
    if (!isDot && e.st.chill > 0) dmg *= 1.15
    const dealt = e.takeDamage(dmg, ignoreArmor)
    if (dealt > 0) {
      this.damageDealt += dealt
      if (source) source.damageDealt += dealt
      if (this.meta.leech > 0) {
        this.gold += dealt * this.meta.leech
        this.goldEarned += dealt * this.meta.leech
      }
    }
    // floating damage number (throttled)
    if (!isDot && dealt > 0) {
      this.fx.text(e.x, e.y - e.radius - 4, String(Math.round(dealt)), crit ? '#ffd76b' : '#ffffff', crit ? 17 : 12, crit)
    }
    if (!e.alive && source) {
      source.kills++
    }
  }

  areaDamage(
    source: Tower | null,
    x: number,
    y: number,
    radius: number,
    damage: number,
    st: TowerStats,
  ): void {
    for (const e of this.enemies) {
      if (!e.targetable) continue
      if (source && !this.canHit(source, e)) continue
      const d = Math.hypot(e.x - x, e.y - y)
      if (d > radius + e.radius) continue
      const falloff = 1 - (d / (radius + e.radius)) * 0.4
      const crit = Math.random() < (st.crit ?? 0)
      this.dealDamage(e, damage * falloff * (crit ? 2 : 1), false, crit, false, source ?? undefined)
      if (st.slow) e.applySlow(st.slow, st.slowDur ?? 1, this.meta.slowMul)
      if (st.burn) e.applyBurn(st.burn, 2.5)
      if (st.poison) e.applyPoison(st.poison, 3, 3)
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.life -= dt
      p.t += dt
      if (p.life <= 0) {
        this.projectiles.splice(i, 1)
        continue
      }

      // homing
      if (p.targetId >= 0) {
        const target = this.enemies.find((e) => e.id === p.targetId && e.alive)
        if (target) {
          const a = Math.atan2(target.y - p.y, target.x - p.x)
          p.vx = Math.cos(a) * p.speed
          p.vy = Math.sin(a) * p.speed
        }
      }
      p.x += p.vx * dt
      p.y += p.vy * dt

      // out of bounds
      if (p.x < -40 || p.x > COLS * CELL + 40 || p.y < -80 || p.y > ROWS * CELL + 60) {
        this.projectiles.splice(i, 1)
        continue
      }

      // collision
      let collided = false
      for (const e of this.enemies) {
        if (!e.alive || p.hitIds.has(e.id)) continue
        if (p.sourceTower >= 0) {
          const st = this.projectileSourceStats(p)
          if (st && !this.canHitSource(p, e)) continue
        }
        const d = Math.hypot(e.x - p.x, e.y - p.y)
        if (d > e.radius + 5) continue

        p.hitIds.add(e.id)
        if (p.splash > 0) {
          const src = p.sourceTower >= 0 ? this.towerById(p.sourceTower) : null
          this.areaDamage(src, p.x, p.y, p.splash, p.damage, {
            ...(src ? this.towerStats(src) : { damage: p.damage, range: 0, cooldown: 1 }),
            splash: p.splash,
            slow: p.slow,
            slowDur: p.slowDur,
            burn: p.burn,
          })
          this.fx.ring(p.x, p.y, p.splash, p.color, 2, 0.3)
          this.fx.burst(p.x, p.y, p.color, 6, 90, 2.5)
          this.fx.addShake(1.5)
        } else {
          const src = p.sourceTower >= 0 ? this.towerById(p.sourceTower) : null
          this.dealDamage(e, p.damage, false, p.crit, false, src ?? undefined)
          if (p.slow) e.applySlow(p.slow, p.slowDur || 1, this.meta.slowMul)
          if (p.burn) e.applyBurn(p.burn, 2.5)
          if (p.poison) e.applyPoison(p.poison, 3.5, p.poisonStacks)
        }

        if (p.pierce > 0) {
          p.pierce--
          p.damage *= 0.85
        } else {
          collided = true
          break
        }
      }

      if (collided) {
        this.projectiles.splice(i, 1)
      }
    }
  }

  private towerById(id: number): Tower | null {
    for (const t of this.towers) if (t.id === id) return t
    return null
  }

  private projectileSourceStats(p: Projectile): TowerStats | null {
    const t = this.towerById(p.sourceTower)
    return t ? this.towerStats(t) : null
  }

  private canHitSource(p: Projectile, e: Enemy): boolean {
    const t = this.towerById(p.sourceTower)
    if (!t) return true
    if (e.flying) {
      return t.type === 'mortar' || t.type === 'sniper' || t.type === 'beam' || t.type === 'tesla'
    }
    return true
  }


  // ── death / leak handling ───────────────────────────────────

  private onEnemyDeath(e: Enemy, index: number): void {
    this.enemies.splice(index, 1)
    this.kills++
    if (e.isBoss) this.bossesKilled++
    const gold = Math.round(e.bounty * this.meta.killGoldMul)
    this.addGold(gold)
    if (e.isBoss) {
      audio.play('kill')
      this.fx.addShake(10)
      this.fx.addFlash(0.4, '#ffffff')
      this.fx.burst(e.x, e.y, e.def.color, 30, 180, 4)
      this.fx.ring(e.x, e.y, 120, e.def.color, 4, 0.6)
    } else {
      this.fx.burst(e.x, e.y, e.def.color, e.isElite ? 14 : 6, e.isElite ? 120 : 70, e.isElite ? 3 : 2)
    }
    // kill-gold frenzy mines
    for (const t of this.towers) {
      if (t.evolve?.tag === 'killgold') {
        this.gold += 2
        this.goldEarned += 2
      }
    }
    // splits
    if (e.splitInto) {
      for (let i = 0; i < e.splitInto.count; i++) {
        const child = new Enemy(this.idCounter++, e.splitInto.id, 0.6, 1)
        child.dist = Math.max(0, e.dist - 8)
        this.enemies.push(child)
      }
    }
    // poison plague: spread on death
    for (const t of this.towers) {
      if (t.evolve?.tag !== 'spread') continue
      const st = this.towerStats(t)
      for (const o of this.enemies) {
        if (!o.alive) continue
        if (Math.hypot(o.x - e.x, o.y - e.y) <= st.range) {
          o.applyPoison(st.poison ?? 10, 3, 3)
        }
      }
    }
  }

  private handleLeak(e: Enemy): void {
    let lost = e.def.leak
    if (this.shieldCharges > 0) {
      this.shieldCharges--
      lost = 0
      this.fx.text(this.coreX, this.coreY - 30, 'SHIELD', '#7cf0d8', 16)
      this.fx.addFlash(0.2, '#7cf0d8')
    }
    if (lost > 0) {
      this.lives -= lost
      this.fx.addShake(7)
      this.fx.addFlash(0.25, '#ff4444')
      this.fx.text(this.coreX, this.coreY - 30, `-${lost}`, '#ff6b6b', 18)
      this.onLeak?.(lost)
    }
    audio.play('leak')
    if (this.lives <= 0) {
      this.lives = 0
      this.endGame(false)
    }
  }

  // ── wave completion ─────────────────────────────────────────

  private checkWaveEnd(): void {
    if (!this.waveActive) return
    if (this.spawnQueue.length > 0) return
    if (this.enemies.length > 0) return
    this.waveActive = false
    this.wave++
    this.wavesCleared++
    this.shieldCharges = this.meta.shieldPerWave
    const def = this.stage?.waves[this.wave - 1]
    const reward = def?.reward ?? 0
    if (reward > 0) this.addGold(reward)
    this.onWaveClear?.(this.wave, reward)
    // stage clear
    if (this.totalWaves > 0 && this.wave >= this.totalWaves && this.mode === 'stage') {
      this.endGame(true)
    }
  }

  private endGame(victory: boolean): void {
    if (this.over) return
    this.over = true
    this.victory = victory
    audio.play(victory ? 'win' : 'lose')
    this.onGameOver?.(this.result())
  }

  /** Force-end the run (used when the player retreats). */
  retreat(): void {
    this.endGame(false)
  }

  result(): BattleResult {
    const perfect = this.lives >= this.maxLives && this.wavesCleared > 0
    const base = Math.round(
      this.kills * 1.2 + this.damageDealt / 900 + this.wavesCleared * 18 + (this.victory ? 150 : 0),
    )
    return {
      victory: this.victory,
      wavesCleared: this.wavesCleared,
      kills: this.kills,
      goldEarned: Math.round(this.goldEarned),
      damageDealt: Math.round(this.damageDealt),
      livesLeft: this.lives,
      perfect,
      coins: base,
      mode: this.mode,
      stageId: this.stage?.id ?? null,
    }
  }


  // ── abilities ───────────────────────────────────────────────

  useAbility(id: AbilityId): boolean {
    const a = this.abilities.find((x) => x.id === id)
    if (!a || a.charges <= 0) {
      audio.play('deny')
      return false
    }
    if (this.over) return false
    a.charges--
    a.cd = a.cooldown
    switch (id) {
      case 'freeze':
        for (const e of this.enemies) {
          if (!e.alive) continue
          e.applyFreeze(2.5 * this.meta.freezeMul)
        }
        audio.play('freeze')
        this.fx.addFlash(0.4, '#9ef0ff')
        this.fx.ring(this.coreX, this.coreY, 700, '#9ef0ff', 4, 0.7)
        break
      case 'airstrike': {
        // hit the longest contiguous run of enemies
        const list = [...this.enemies].filter((e) => e.alive).sort((a, b) => a.dist - b.dist)
        if (list.length === 0) return true
        let bestStart = 0
        let bestLen = 0
        let cur = 1
        for (let i = 1; i < list.length; i++) {
          if (list[i].dist - list[i - 1].dist < 40) cur++
          else cur = 1
          if (cur > bestLen) {
            bestLen = cur
            bestStart = i - cur + 1
          }
        }
        const cx = (list[bestStart].x + list[bestStart + bestLen - 1].x) / 2
        const cy = (list[bestStart].y + list[bestStart + bestLen - 1].y) / 2
        for (let i = 0; i < bestLen; i++) {
          const e = list[bestStart + i]
          this.dealDamage(e, 260, false, false, true)
        }
        this.fx.addShake(12)
        this.fx.addFlash(0.5, '#ffb26b')
        this.fx.ring(cx, cy, 140, '#ffb26b', 5, 0.6)
        this.fx.burst(cx, cy, '#ffb26b', 30, 200, 4)
        audio.play('boom')
        break
      }
      case 'meteor': {
        for (let i = 0; i < 6; i++) {
          const e = this.enemies[Math.floor(Math.random() * this.enemies.length)]
          const tx = e && Math.random() < 0.7 ? e.x : Math.random() * COLS * CELL
          const ty = e && Math.random() < 0.7 ? e.y : Math.random() * ROWS * CELL
          this.meteors.push({ x: tx, y: ty, t: -i * 0.18 })
        }
        audio.play('boom')
        break
      }
      case 'rush':
        this.rushTimer = 8
        this.fx.addFlash(0.3, '#ff9a3c')
        this.fx.text(this.coreX, this.coreY - 50, 'RUSH!', '#ff9a3c', 20)
        audio.play('upgrade')
        break
      case 'repair':
        this.lives = Math.min(this.maxLives, this.lives + 5)
        this.projectiles.length = 0
        this.fx.addFlash(0.25, '#7cf0d8')
        this.fx.text(this.coreX, this.coreY - 30, '+5', '#7cf0d8', 20)
        audio.play('upgrade')
        break
    }
    return true
  }

  /** Delayed meteor impacts from the Meteor Storm ability. */
  meteors: { x: number; y: number; t: number; done?: boolean }[] = []

  private updateMeteors(dt: number): void {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]
      m.t += dt
      if (m.t < 0) continue
      if (m.t < 0.001 || !m.done) {
        m.done = true
        this.areaDamage(null, m.x, m.y, 90, 200, { damage: 200, range: 0, cooldown: 1 })
        this.fx.addShake(9)
        this.fx.ring(m.x, m.y, 100, '#ff9a3c', 4, 0.5)
        this.fx.burst(m.x, m.y, '#ff9a3c', 20, 160, 3)
        audio.play('boom')
      }
      if (m.t > 0.5) this.meteors.splice(i, 1)
    }
  }


  /** All enemies currently alive (used by the wave preview UI). */
  aliveCount(): number {
    return this.enemies.length
  }

  /** Remaining enemies in the current wave, including not-yet-spawned ones. */
  remainingInWave(): number {
    return this.enemies.length + this.spawnQueue.length
  }

  /** Composition of the next wave, for the preview panel. */
  wavePreview(): { id: EnemyId; count: number }[] {
    const def = this.currentWaveDef
    if (!def) return []
    const map = new Map<EnemyId, number>()
    for (const e of def.entries) map.set(e.id, (map.get(e.id) ?? 0) + e.count)
    return [...map.entries()].map(([id, count]) => ({ id, count }))
  }
}

