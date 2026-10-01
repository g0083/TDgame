import { COLS, ROWS, pxToCell } from '../core/grid'
import { fmt } from '../core/math'
import { TOWERS } from '../data/towers'
import { ABILITIES } from '../data/abilities'
import { ENEMY_BY_ID } from '../data/enemies'
import type { AbilityId, TowerId } from '../data/types'
import type { Battle, BattleMode, BattleResult } from '../game/battle'
import type { Tower } from '../game/tower'
import { Renderer } from '../render/renderer'
import { drawTowerIcon } from '../render/sprites'
import { audio } from '../audio/synth'
import { t, tn, td, type TKey } from '../util/i18n'
import { clear, h, iconCanvas, toast } from './dom'

export interface BattleViewCallbacks {
  onExit: () => void
  onFinish: (res: BattleResult) => void
  haptics: () => void
}

export class BattleView {
  readonly el: HTMLElement
  /** exposed for the automated tests (see scripts/test-tower-pos.ts) */
  renderer: Renderer
  private battle: Battle
  private cb: BattleViewCallbacks
  private mode: BattleMode

  // HUD elements
  private goldEl!: HTMLElement
  private livesEl!: HTMLElement
  private waveEl!: HTMLElement
  private bannerEl!: HTMLElement
  private buildBar!: HTMLElement
  private abilityRow!: HTMLElement
  private waveBtn!: HTMLButtonElement
  private speedBtn!: HTMLButtonElement
  private pauseBtn!: HTMLButtonElement
  private sheet!: HTMLElement
  private canvas!: HTMLCanvasElement
  private autoBtn!: HTMLButtonElement
  private mainEl!: HTMLElement
  private previewEl!: HTMLElement

  private selectedBuild: TowerId | null = null
  private selectedTowerId: number | null = null
  private hoverCell: { c: number; r: number } | null = null
  private bannerTimer = 0
  private rafId = 0
  private lastTime = 0
  private running = false
  private lowQuality = false

  constructor(battle: Battle, mode: BattleMode, cb: BattleViewCallbacks) {
    this.battle = battle
    this.mode = mode
    this.cb = cb
    this.el = h('div', { class: 'screen', id: 'screen-battle' })
    this.build()
    const cv = this.canvas
    this.renderer = new Renderer(cv)
    this.bindInput()
    this.refreshHud()
    this.refreshBuildBar()

    battle.onGameOver = (res) => {
      this.stop()
      this.cb.onFinish(res)
    }
    battle.onWaveClear = (wave, reward) => {
      if (reward > 0) this.banner(`+${reward} ${t('common.gold')}`, 'good')
      else this.banner(t('battle.waveClear'), 'good')
      void wave
    }
    battle.onLeak = () => this.cb.haptics()
  }

  get battleRef(): Battle {
    return this.battle
  }

  private build(): void {
    // ── top HUD ──
    this.goldEl = h('span', { text: '0' })
    this.livesEl = h('span', { text: '0' })
    this.waveEl = h('div', { class: 'wave-label', text: '' })
    this.pauseBtn = h('button', {
      class: 'btn icon-btn ghost small',
      text: '⏸',
      'aria-label': 'pause',
      onclick: () => this.togglePause(),
    }) as HTMLButtonElement
    this.speedBtn = h('button', {
      class: 'btn speed-toggle ghost small',
      text: '1x',
      onclick: () => this.cycleSpeed(),
    }) as HTMLButtonElement
    this.autoBtn = h('button', {
      class: 'btn small ghost auto-toggle',
      text: 'AUTO',
      onclick: () => this.toggleAuto(),
    }) as HTMLButtonElement
    const quitBtn = h('button', {
      class: 'btn icon-btn ghost small',
      text: '✕',
      'aria-label': 'menu',
      onclick: () => this.askExit(),
    })

    const hud = h('div', { class: 'hud' }, [
      h('div', { class: 'stat gold' }, [h('span', { text: '💰' }), this.goldEl]),
      h('div', { class: 'stat lives' }, [h('span', { text: '❤️' }), this.livesEl]),
      h('div', { class: 'spacer' }),
      this.waveEl,
      this.autoBtn,
      this.speedBtn,
      this.pauseBtn,
      quitBtn,
    ])

    // ── abilities row ──
    this.waveBtn = h('button', {
      class: 'btn primary wave-btn',
      text: t('battle.startWave'),
      onclick: () => this.startWave(),
    }) as HTMLButtonElement
    this.abilityRow = h('div', { class: 'hud-row' })
    this.fillAbilities()

    // ── field ──
    this.canvas = h('canvas', { id: 'game-canvas' }) as HTMLCanvasElement
    this.bannerEl = h('div', { class: 'banner' })
    this.previewEl = h('div', { class: 'wave-preview' })
    const overlay = h('div', { class: 'field-overlay' }, [this.bannerEl])
    const wrap = h('div', { class: 'field-wrap' }, [this.canvas, overlay])
    this.mainEl = h('div', { class: 'battle-main' }, [wrap, this.previewEl])

    // ── build bar ──
    this.buildBar = h('div', { class: 'build-bar' })

    // ── tower info sheet ──
    this.sheet = h('div', { class: 'sheet' })

    this.el.append(hud, this.mainEl, this.abilityRow, this.buildBar, this.sheet)
  }

  private fillAbilities(): void {
    clear(this.abilityRow)
    for (const a of ABILITIES) {
      const btn = h('button', {
        class: 'ability-btn',
        text: a.icon,
        title: tn(a.name, a.nameJa),
        onclick: () => this.useAbility(a.id),
      })
      btn.dataset.ability = a.id
      const charge = h('span', { class: 'charges', text: '0' })
      btn.appendChild(charge)
      this.abilityRow.appendChild(btn)
    }
    this.abilityRow.appendChild(this.waveBtn)
  }

  // ── input ────────────────────────────────────────────────

  private bindInput(): void {
    const cv = this.canvas
    const onPos = (e: PointerEvent) => {
      const p = this.renderer.toField(e.clientX, e.clientY)
      this.hoverCell = pxToCell(p.x, p.y)
    }
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      cv.setPointerCapture(e.pointerId)
      onPos(e)
      this.handleTap()
    })
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.buttons > 0) onPos(e)
    })
    cv.addEventListener('pointerleave', () => {
      this.hoverCell = null
    })
    cv.addEventListener('contextmenu', (e) => e.preventDefault())

    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private onResize = (): void => {
    this.renderer.resize()
  }

  private onVisibility = (): void => {
    if (document.hidden) this.battle.paused = true
    audio.setIntensity(0)
  }

  /** Called once the view is attached to the DOM, so the canvas can be sized. */
  onMounted(): void {
    this.renderer.resize()
    this.refreshBuildBar()
  }

  private handleTap(): void {
    if (!this.hoverCell) return
    const { c, r } = this.hoverCell
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return
    const existing = this.battle.towerAt(c, r)
    if (this.selectedBuild) {
      if (existing) {
        // select it instead of building
        this.selectedTowerId = existing.id
        this.selectedBuild = null
        this.refreshBuildBar()
        this.showSheet(existing)
        return
      }
      const tower = this.battle.build(this.selectedBuild, c, r)
      if (tower) {
        this.cb.haptics()
        // keep the build tool active for rapid placement
        if (this.battle.gold < this.battle.buildCost(this.selectedBuild)) {
          this.selectedBuild = null
          this.refreshBuildBar()
        }
      } else {
        toast(t('battle.blocked'))
      }
      return
    }
    if (existing) {
      this.selectedTowerId = existing.id
      this.showSheet(existing)
    } else {
      this.selectedTowerId = null
      this.hideSheet()
    }
  }

  // ── HUD refresh ──────────────────────────────────────────

  refreshHud(): void {
    const b = this.battle
    this.goldEl.textContent = fmt(Math.floor(b.gold))
    this.livesEl.textContent = `${b.lives}`
    const total = b.totalWaves > 0 ? `/${b.totalWaves}` : ''
    this.waveEl.textContent = `${t('battle.wave')} ${b.waveNumber()}${total}`
    this.waveBtn.disabled = b.waveActive || b.over
    this.waveBtn.textContent = b.waveActive
      ? `${t('battle.enemyIncoming')} ${b.remainingInWave()}`
      : t('battle.nextWave')
    this.refreshAbilities()
    this.refreshPreview()
  }

  /** Shows the composition of the upcoming (or current) wave, plus counters. */
  private refreshPreview(): void {
    const b = this.battle
    const list = b.wavePreview()
    clear(this.previewEl)
    if (list.length === 0) return
    this.previewEl.appendChild(
      h('div', { class: 'preview-label', text: `${t('battle.nextWave')} — ${t('battle.wave')} ${b.waveNumber()}` }),
    )
    const row = h('div', { class: 'preview-row' })
    for (const item of list) {
      const def = ENEMY_BY_ID[item.id]
      row.appendChild(
        h('div', { class: 'preview-chip', style: `border-color:${def.color}55` }, [
          h('span', { class: 'dot', style: `background:${def.color}` }),
          h('span', { text: `${tn(def.name, def.nameJa)} ×${item.count}` }),
        ]),
      )
    }
    this.previewEl.appendChild(row)

    // counter hints, derived from the traits present in this wave
    const ids = new Set(list.map((x) => x.id))
    const hints: string[] = []
    if (ids.has('armored') || ids.has('juggernaut') || ids.has('boss_titan')) hints.push('⚡ <b>tesla</b> / <b>beam</b>')
    if (ids.has('flyer')) hints.push('🔫 <b>mortar</b> / <b>sniper</b>')
    if (ids.has('healer')) hints.push('💊 kill the <b>Medic</b> first')
    if (ids.has('swarmer') || ids.has('splitter')) hints.push('💥 <b>cannon</b> / <b>mortar</b>')
    if (ids.has('stealth')) hints.push('👁 watch the early game')
    if (ids.has('cursed')) hints.push('❄️ slowing is useless — use <b>damage</b>')
    if (ids.has('boss_rush') || ids.has('boss_swarm') || ids.has('boss_titan')) hints.push('👑 <b>boss</b>')
    if (hints.length > 0) {
      this.previewEl.appendChild(h('div', { class: 'preview-hint', html: hints.join(' · ') }))
    }
  }

  private refreshAbilities(): void {
    for (const a of this.battle.abilities) {
      const btn = this.abilityRow.querySelector<HTMLButtonElement>(`[data-ability="${a.id}"]`)
      if (!btn) continue
      const chargeEl = btn.querySelector<HTMLElement>('.charges')
      if (chargeEl) chargeEl.textContent = String(a.charges)
      const existing = btn.querySelector<HTMLElement>('.cd')
      if (a.cd > 0) {
        let cd = existing
        if (!cd) {
          cd = h('span', { class: 'cd' })
          btn.appendChild(cd)
        }
        cd.textContent = String(Math.ceil(a.cd))
      } else if (existing) {
        existing.remove()
      }
      btn.disabled = a.charges <= 0
    }
  }

  private useAbility(id: AbilityId): void {
    if (this.battle.useAbility(id)) {
      this.cb.haptics()
      this.refreshHud()
    }
  }

  private startWave(): void {
    if (this.battle.waveActive) return
    this.battle.startWave()
    this.cb.haptics()
    this.refreshHud()
  }

  private togglePause(): void {
    this.battle.paused = !this.battle.paused
    this.pauseBtn.textContent = this.battle.paused ? '▶' : '⏸'
    audio.setIntensity(this.battle.paused ? 0 : 0.6)
  }

  private cycleSpeed(): void {
    const b = this.battle
    b.speed = b.speed === 1 ? 2 : b.speed === 2 ? 3 : 1
    this.speedBtn.textContent = `${b.speed}x`
    this.cb.haptics()
  }

  private toggleAuto(): void {
    this.battle.autoWave = !this.battle.autoWave
    this.autoBtn.classList.toggle('primary', this.battle.autoWave)
    this.autoBtn.classList.toggle('ghost', !this.battle.autoWave)
    if (this.battle.autoWave && !this.battle.waveActive) this.battle.startWave()
    this.cb.haptics()
  }

  private askExit(): void {
    this.battle.paused = true
    this.pauseBtn.textContent = '▶'
    this.confirmExit()
  }

  private confirmExit(): void {
    // handled by the app via onExit
    this.cb.onExit()
  }


  // ── build bar ────────────────────────────────────────────

  refreshBuildBar(): void {
    clear(this.buildBar)
    for (const def of TOWERS) {
      const locked = !!def.unlock && this.stagesClearedProvider() < def.unlock.stagesCleared
      const cost = this.battle.buildCost(def.id)
      const cant = !locked && this.battle.gold < cost
      const ic = iconCanvas(28)
      ic.draw((c) => drawTowerIcon(c, def, 28))
      const btn = h(
        'button',
        {
          class: `tower-btn${locked ? ' locked' : ''}${cant ? ' cant' : ''}${
            this.selectedBuild === def.id ? ' selected' : ''
          }`,
          onclick: () => this.selectBuild(def.id),
        },
        [
          ic.canvas,
          h('span', { text: tn(def.name, def.nameJa).slice(0, 6) }),
          h('span', { class: 'cost', text: locked ? '🔒' : String(cost) }),
        ],
      )
      btn.title = locked
        ? `${tn(def.name, def.nameJa)} — ${t('common.locked')}`
        : `${tn(def.name, def.nameJa)}: ${td(def.desc, def.descJa)}`
      this.buildBar.appendChild(btn)
    }
  }

  private selectBuild(id: TowerId): void {
    const def = TOWERS.find((x) => x.id === id)!
    if (def.unlock && this.stagesClearedProvider() < def.unlock.stagesCleared) {
      audio.play('deny')
      toast(t('common.locked'))
      return
    }
    this.selectedBuild = this.selectedBuild === id ? null : id
    this.selectedTowerId = null
    this.hideSheet()
    this.refreshBuildBar()
    audio.play('click')
  }

  /** Provided by the app so the build bar can gate unlocks. */
  stagesClearedProvider: () => number = () => 99


  // ── tower sheet ──────────────────────────────────────────

  private hideSheet(): void {
    this.sheet.classList.remove('show')
    clear(this.sheet)
  }

  private closeSheet(): void {
    this.selectedTowerId = null
    this.hideSheet()
  }

  private showSheet(tower: Tower): void {
    clear(this.sheet)
    const b = this.battle
    const def = tower.def
    const st = b.towerStats(tower)
    const ic = iconCanvas(36)
    ic.draw((c) => drawTowerIcon(c, def, 36, tower.evolve?.color))

    const name = tower.evolve ? tn(tower.evolve.name, tower.evolve.nameJa) : tn(def.name, def.nameJa)
    const sub = tower.evolve
      ? `${tn(def.name, def.nameJa)} → ${tn(tower.evolve.name, tower.evolve.nameJa)}`
      : td(def.desc, def.descJa)

    const head = h('div', { class: 'sheet-head' }, [
      ic.canvas,
      h('div', { class: 't' }, [h('strong', { text: name }), h('small', { text: sub })]),
      h('button', { class: 'btn icon-btn ghost small', text: '✕', onclick: () => this.closeSheet() }),
    ])

    const nextSt = b.previewUpgrade(tower)
    const grid = h('div', { class: 'stat-grid' })
    const addRow = (label: string, value: string, next?: string) => {
      const row = h('div', {}, [h('span', { text: label }), h('b', { text: value })])
      if (next !== undefined) row.appendChild(h('span', { class: 'up', text: `→${next}` }))
      grid.appendChild(row)
    }
    addRow('DMG', fmt(st.damage), nextSt ? fmt(nextSt.damage) : undefined)
    addRow('RANGE', fmt(st.range), nextSt ? fmt(nextSt.range) : undefined)
    addRow('RATE', `${(1 / (st.cooldown || 1)).toFixed(2)}/s`, nextSt ? `${(1 / (nextSt.cooldown || 1)).toFixed(2)}/s` : undefined)
    if (st.crit) addRow('CRIT', `${Math.round(st.crit * 100)}%`)
    if (st.splash) addRow('SPLASH', fmt(st.splash))
    if (st.slow) addRow('SLOW', `${Math.round(st.slow * 100)}%`)
    if (st.burn) addRow('BURN', `${fmt(st.burn)}/s`)
    if (st.poison) addRow('POISON', `${fmt(st.poison)}/s`)
    if (st.chains) addRow('CHAINS', String(st.chains))
    if (st.gold) addRow('INCOME', `${fmt(st.gold * b.meta.mineMul)}/s`)
    addRow('KILLS', String(tower.kills))
    addRow('DMG DEALT', fmt(tower.damageDealt))
    if (b.hasSynergy(tower) && def.synergy) {
      addRow('SYNERGY', tn(def.synergy.label, def.synergy.labelJa))
    }

    const actions = h('div', { class: 'sheet-actions' })
    if (nextSt) {
      const cost = b.upgradeCost(tower)
      actions.appendChild(
        h('button', {
          class: 'btn primary',
          html: `${t('battle.upgrade')}<br><small>${cost} 💰</small>`,
          disabled: b.gold < cost,
          onclick: () => {
            if (b.upgrade(tower)) {
              this.cb.haptics()
              this.showSheet(tower)
              this.refreshBuildBar()
              this.refreshHud()
            }
          },
        }),
      )
    }
    actions.appendChild(
      h('button', {
        class: 'btn ghost small',
        text: `${t('battle.target')}: ${t(`target.${tower.targetMode}` as TKey)}`,
        onclick: () => {
          b.cycleTarget(tower)
          this.showSheet(tower)
        },
      }),
    )
    actions.appendChild(
      h('button', {
        class: 'btn danger small',
        html: `${t('battle.sell')}<br><small>${b.sellValue(tower)} 💰</small>`,
        onclick: () => {
          b.sell(tower)
          this.selectedTowerId = null
          this.closeSheet()
          this.refreshBuildBar()
          this.refreshHud()
        },
      }),
    )

    this.sheet.append(head, grid, actions)

    if (tower.canEvolve && def.evolves) {
      this.sheet.appendChild(h('div', { class: 'hint', text: t('battle.selectEvolve') }))
      const evoGrid = h('div', { class: 'evo-grid' })
      def.evolves.forEach((e, i) => {
        evoGrid.appendChild(
          h(
            'button',
            {
              class: 'evo-card',
              style: `border-color:${e.color}66`,
              onclick: () => {
                if (b.evolve(tower, i as 0 | 1)) {
                  this.cb.haptics()
                  this.showSheet(tower)
                }
              },
            },
            [
              h('strong', { text: tn(e.name, e.nameJa), style: `color:${e.color}` }),
              h('small', { text: td(e.desc, e.descJa) }),
              h('div', {
                class: 'pill gold',
                text: `${b.evolveCost(tower)} 💰`,
                style: 'margin-top:6px;display:inline-block',
              }),
            ],
          ),
        )
      })
      this.sheet.appendChild(evoGrid)
    }

    this.sheet.classList.add('show')
  }


  // ── loop ────────────────────────────────────────────────

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    audio.setIntensity(0.5)
    const loop = (now: number) => {
      if (!this.running) return
      const dt = Math.min(0.1, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.tick(dt)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    audio.setIntensity(0)
  }

  private hudTimer = 0

  private tick(dt: number): void {
    const b = this.battle
    b.update(dt)

    // auto start next wave after a short delay
    if (b.autoWave && !b.waveActive && !b.over) {
      b.startWave()
    }

    this.renderer.draw(b, {
      hoverCell: this.hoverCell,
      selectedTowerId: this.selectedTowerId,
      showRanges: false,
      lowQuality: this.lowQuality,
    })

    this.hudTimer += dt
    if (this.hudTimer > 0.2) {
      this.hudTimer = 0
      this.refreshHud()
      this.refreshBuildBar()
      if (this.selectedTowerId !== null) {
        const t = b.towers.find((x) => x.id === this.selectedTowerId)
        if (t) this.showSheet(t)
        else this.closeSheet()
      }
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show')
    }

    // music intensity follows the action
    const intensity = b.over ? 0 : 0.35 + Math.min(0.65, b.enemies.length / 18)
    audio.setIntensity(intensity)
  }

  private banner(text: string, cls: '' | 'boss' | 'good' = ''): void {
    this.bannerEl.textContent = text
    this.bannerEl.className = `banner show ${cls}`
    this.bannerTimer = 1.6
  }

  destroy(): void {
    this.stop()
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.el.remove()
  }
}

