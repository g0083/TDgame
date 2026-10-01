import { COLS, ROWS, pxToCell } from '../core/grid'
import { fmt } from '../core/math'
import { TOWERS, towerUpgradeCost } from '../data/towers'
import { ABILITIES } from '../data/abilities'
import { ENEMY_BY_ID } from '../data/enemies'
import type { AbilityId, TowerDef, TowerId } from '../data/types'
import { icon, iconText } from './icons'
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
  private towerBtnRow!: HTMLElement
  private infoBtn!: HTMLButtonElement
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
      'aria-label': 'menu',
      onclick: () => this.askExit(),
    })
    quitBtn.appendChild(icon('cross'))

    const hud = h('div', { class: 'hud' }, [
      h('div', { class: 'stat gold' }, [h('span', { class: 'ico-wrap' }, [icon('coin')]), this.goldEl]),
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

    // ── build bar: scrollable tower buttons pinned left, info button right ──
    this.buildBar = h('div', { class: 'build-bar' })
    this.towerBtnRow = h('div', { class: 'build-bar-scroll' })
    this.infoBtn = h('button', {
      class: 'build-info-btn',
      'aria-label': t('battle.towerInfo'),
      onclick: () => this.showBuildInfo(),
    }) as HTMLButtonElement
    this.infoBtn.appendChild(icon('info'))
    this.buildBar.append(this.towerBtnRow, this.infoBtn)

    // ── tower info sheet ──
    this.sheet = h('div', { class: 'sheet' })

    this.el.append(hud, this.mainEl, this.abilityRow, this.buildBar, this.sheet)
  }

  private fillAbilities(): void {
    clear(this.abilityRow)
    for (const a of ABILITIES) {
      const btn = h('button', {
        class: 'ability-btn',
        title: tn(a.name, a.nameJa),
        'aria-label': tn(a.name, a.nameJa),
        onclick: () => this.useAbility(a.id),
      })
      btn.appendChild(icon(a.icon))
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
    const hints: [string, string][] = []
    if (ids.has('armored') || ids.has('juggernaut') || ids.has('boss_titan'))
      hints.push(['bolt', '<b>tesla</b> / <b>beam</b>'])
    if (ids.has('flyer')) hints.push(['crosshair', '<b>mortar</b> / <b>sniper</b>'])
    if (ids.has('healer')) hints.push(['syringe', 'kill the <b>Medic</b> first'])
    if (ids.has('swarmer') || ids.has('splitter'))
      hints.push(['burst', '<b>cannon</b> / <b>mortar</b>'])
    if (ids.has('stealth')) hints.push(['eyeOff', 'watch the early game'])
    if (ids.has('cursed')) hints.push(['snowflake', 'slowing is useless — use <b>damage</b>'])
    if (ids.has('boss_rush') || ids.has('boss_swarm') || ids.has('boss_titan'))
      hints.push(['crown', '<b>boss</b>'])
    if (hints.length > 0) {
      const hintRow = h('div', { class: 'preview-hint' })
      hints.forEach(([name, html], i) => {
        if (i > 0) hintRow.appendChild(h('span', { class: 'hint-sep', text: '·' }))
        hintRow.appendChild(h('span', { class: 'hint-item' }, [icon(name)]))
        const txt = h('span', { html })
        hintRow.appendChild(txt)
      })
      this.previewEl.appendChild(hintRow)
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
    clear(this.towerBtnRow)
    for (const def of TOWERS) {
      const locked = !!def.unlock && this.stagesClearedProvider() < def.unlock.stagesCleared
      const cost = this.battle.buildCost(def.id)
      const cant = !locked && this.battle.gold < cost
      const ic = iconCanvas(28)
      ic.draw((c) => drawTowerIcon(c, def, 28))
      // tap = select for building, long-press (or right click) = full details
      let pressTimer = 0
      let suppressClick = false
      const btn = h(
        'button',
        {
          class: `tower-btn${locked ? ' locked' : ''}${cant ? ' cant' : ''}${
            this.selectedBuild === def.id ? ' selected' : ''
          }`,
          onclick: () => {
            if (suppressClick) {
              suppressClick = false
              return
            }
            this.selectBuild(def.id)
          },
          oncontextmenu: (e: Event) => {
            e.preventDefault()
            suppressClick = true
            this.showTowerInfo(def)
          },
        },
        [
          ic.canvas,
          h('span', { class: 'tb-name', text: tn(def.name, def.nameJa) }),
          h('span', { class: 'cost' }, locked ? [icon('lock')] : [String(cost)]),
        ],
      )
      btn.addEventListener('pointerdown', () => {
        pressTimer = window.setTimeout(() => {
          pressTimer = 0
          suppressClick = true
          this.showTowerInfo(def)
        }, 380)
      })
      const cancel = () => {
        if (pressTimer) {
          clearTimeout(pressTimer)
          pressTimer = 0
        }
      }
      btn.addEventListener('pointerup', cancel)
      btn.addEventListener('pointercancel', cancel)
      btn.addEventListener('pointerleave', cancel)
      btn.title = locked
        ? `${tn(def.name, def.nameJa)} — ${t('common.locked')}`
        : `${tn(def.name, def.nameJa)}: ${td(def.desc, def.descJa)}`
      this.towerBtnRow.appendChild(btn)
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

  /** Browsable list of every tower, opened from the "?" button. */
  private showBuildInfo(): void {
    clear(this.sheet)
    this.sheet.appendChild(
      h('div', { class: 'sheet-head' }, [
        h('div', { class: 't' }, [h('strong', { text: t('codex.towers') })]),
        this.closeSheetBtn(),
      ]),
    )
    this.sheet.appendChild(h('p', { class: 'sheet-desc', text: t('battle.pickTowerInfo') }))

    const grid = h('div', { class: 'info-list' })
    for (const def of TOWERS) {
      const locked = !!def.unlock && this.stagesClearedProvider() < def.unlock.stagesCleared
      const ic = iconCanvas(30)
      ic.draw((c) => drawTowerIcon(c, def, 30))
      grid.appendChild(
        h(
          'button',
          { class: `info-row${locked ? ' locked' : ''}`, onclick: () => this.showTowerInfo(def) },
          [
            ic.canvas,
            h('div', { class: 'grow' }, [
              h(
              'strong',
              {},
              [
                `${tn(def.name, def.nameJa)} · `,
                iconText('coin', String(this.battle.buildCost(def.id))),
              ],
            ),
              h('small', { text: locked ? t('common.locked') : td(def.desc, def.descJa) }),
            ]),
            h('span', { text: '›' }),
          ],
        ),
      )
    }
    this.sheet.appendChild(grid)
    this.sheet.classList.add('show')
  }

  /** Full details for a tower type, shown before building. */
  private showTowerInfo(def: TowerDef): void {
    clear(this.sheet)
    const locked = !!def.unlock && this.stagesClearedProvider() < def.unlock.stagesCleared
    const cost = this.battle.buildCost(def.id)
    const meta = this.battle.meta

    const ic = iconCanvas(44)
    ic.draw((c) => drawTowerIcon(c, def, 44))
    this.sheet.appendChild(
      h('div', { class: 'sheet-head' }, [
        ic.canvas,
        h('div', { class: 't' }, [
          h('strong', { text: tn(def.name, def.nameJa) }),
          h('small', { text: locked ? t('common.locked') : `${t('common.gold')} ${cost}` }),
        ]),
        this.closeSheetBtn(),
      ]),
    )
    this.sheet.appendChild(h('p', { class: 'sheet-desc', text: td(def.desc, def.descJa) }))
    this.sheet.appendChild(this.traitTags(def))
    if (locked) {
      this.sheet.appendChild(
        h('div', { class: 'hint', text: `${t('menu.stages')} ${def.unlock!.stagesCleared} ${t('battle.clearStage')} →` }),
      )
    }

    // level table (with research bonuses applied)
    const table = h('div', { class: 'lvl-table' })
    table.appendChild(
      h('div', { class: 'lvl-row head' }, [
        h('span', { text: 'Lv' }),
        h('span', { text: t('codex.damage') }),
        h('span', { text: t('codex.range') }),
        h('span', { text: t('codex.rate') }),
        h('span', { text: t('codex.cost') }),
      ]),
    )
    for (let lv = 1; lv <= def.maxLevel; lv++) {
      const raw = def.levels[lv - 1]
      table.appendChild(
        h('div', { class: 'lvl-row' }, [
          h('span', { text: String(lv) }),
          h('span', { text: fmt(raw.damage * meta.damageMul) }),
          h('span', { text: fmt(raw.range * meta.rangeMul) }),
          h('span', { text: `${(meta.rateMul / raw.cooldown).toFixed(2)}/s` }),
          h('span', { text: lv > 1 ? fmt(this.upgradeCostFor(def, lv)) : '—' }),
        ]),
      )
    }
    this.sheet.appendChild(table)

    // extra properties present on the top level
    const l4 = def.levels[def.levels.length - 1]
    const extras: string[] = []
    if (l4.splash) extras.push(`${t('codex.splash')} ${fmt(l4.splash)}`)
    if (l4.chains) extras.push(`${t('codex.chains')} ${l4.chains}`)
    if (l4.slow) extras.push(`${t('codex.slow')} ${Math.round(l4.slow * 100)}%`)
    if (l4.burn) extras.push(`${t('codex.burn')} ${fmt(l4.burn * meta.dotMul)}/s`)
    if (l4.poison) extras.push(`${t('codex.poison')} ${fmt(l4.poison * meta.dotMul)}/s`)
    if (l4.crit) extras.push(`CRIT ${Math.round(l4.crit * 100)}%`)
    if (l4.pierce) extras.push(`${t('codex.pierce')} ${Math.round(l4.pierce * 100)}%`)
    if (l4.gold) extras.push(`${t('codex.income')} ${fmt(l4.gold * meta.mineMul)}/s`)
    if (extras.length) {
      this.sheet.appendChild(h('div', { class: 'preview-hint', text: `${t('codex.properties')}: ${extras.join(' · ')}` }))
    }
    const canAir = def.id === 'mortar' || def.id === 'sniper' || def.id === 'beam' || def.id === 'tesla'
    this.sheet.appendChild(
      h('div', {
        class: 'preview-hint',
        text: `${t('codex.targets')}: ${t('codex.ground')}${canAir ? ` + ${t('codex.air')}` : ''} · ${t('codex.dmgType')} ${t(`codex.dmg.${def.damageType}`)}`,
      }),
    )

    // adjacency synergy
    if (def.synergy) {
      const partner = TOWERS.find((x) => x.id === def.synergy!.with)
      this.sheet.appendChild(
        h('div', { class: 'synergy-note' }, [
          h('span', { class: 'pill gold' }, [icon('bolt')]),
          h('span', {
            text: `${tn(def.synergy.label, def.synergy.labelJa)} (${tn(partner?.name ?? '', partner?.nameJa ?? '')})`,
          }),
        ]),
      )
    }

    // evolution branches
    if (def.evolves) {
      this.sheet.appendChild(h('div', { class: 'hint', text: `${t('battle.evolve')} (Lv${def.maxLevel})` }))
      const grid = h('div', { class: 'evo-grid' })
      for (const e of def.evolves) {
        grid.appendChild(
          h('div', { class: 'evo-card', style: `border-color:${e.color}66` }, [
            h('strong', { text: tn(e.name, e.nameJa), style: `color:${e.color}` }),
            h('small', { text: td(e.desc, e.descJa) }),
          ]),
        )
      }
      this.sheet.appendChild(grid)
    }
    this.sheet.classList.add('show')
  }

  /** Provided by the app so the build bar can gate unlocks. */
  stagesClearedProvider: () => number = () => 99

  // ── tower reference sheet (available before building) ────

  private upgradeCostFor(def: TowerDef, level: number): number {
    return Math.round(towerUpgradeCost(def, level - 1) * this.battle.meta.upgradeCostMul)
  }

  /** Short chips describing what a tower is good against. */
  private traitTags(def: TowerDef): HTMLElement {
    const row = h('div', { class: 'tags' })
    const add = (s: string) => row.appendChild(h('span', { class: 'tag', text: s }))
    switch (def.id) {
      case 'arrow':
        add(`${t('trait.fast')} · ${t('trait.cheap')}`)
        break
      case 'cannon':
        add(`${t('trait.swarm')} · ${t('trait.splash')}`)
        break
      case 'mortar':
        add(`${t('trait.air')} · ${t('trait.boss')}`)
        break
      case 'frost':
        add(`${t('trait.slow')} · ${t('trait.aoe')}`)
        break
      case 'tesla':
        add(`${t('trait.chain')} · ${t('trait.armor')}`)
        break
      case 'poison':
        add(`${t('trait.tank')} · ${t('trait.dot')}`)
        break
      case 'sniper':
        add(`${t('trait.crit')} · ${t('trait.pierce')}`)
        break
      case 'beam':
        add(`${t('trait.aoe')} · ${t('trait.air')}`)
        break
      case 'flame':
        add(`${t('trait.swarm')} · ${t('trait.area')}`)
        break
      case 'amp':
        add(`${t('trait.buff')} · ${t('trait.economy')}`)
        break
      case 'mine':
        add(`${t('trait.income')} · ${t('trait.maze')}`)
        break
      case 'wall':
        add(`${t('trait.maze')} · ${t('trait.slow')}`)
        break
    }
    if (def.synergy) {
      const st = h('span', { class: 'tag gold' }, [icon('bolt')])
      st.appendChild(document.createTextNode(` ${t('trait.synergy')}`))
      row.appendChild(st)
    }
    return row
  }


  // ── tower sheet ──────────────────────────────────────────

  private hideSheet(): void {
    this.sheet.classList.remove('show')
    clear(this.sheet)
  }

  private closeSheet(): void {
    this.selectedTowerId = null
    this.hideSheet()
  }

  /** Shared "close" button for the sheets. */
  private closeSheetBtn(): HTMLButtonElement {
    const b = h('button', {
      class: 'btn icon-btn ghost small',
      'aria-label': t('common.close'),
      onclick: () => this.closeSheet(),
    }) as HTMLButtonElement
    b.appendChild(icon('cross'))
    return b
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
      this.closeSheetBtn(),
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
      const upBtn = h('button', {
        class: 'btn primary',
        disabled: b.gold < cost,
        onclick: () => {
          if (b.upgrade(tower)) {
            this.cb.haptics()
            this.showSheet(tower)
            this.refreshBuildBar()
            this.refreshHud()
          }
        },
      })
      upBtn.append(t('battle.upgrade'))
      upBtn.appendChild(h('small', {}, [iconText('coin', String(cost))]))
      actions.appendChild(upBtn)
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
    const sellBtn = h('button', {
      class: 'btn danger small',
      onclick: () => {
        b.sell(tower)
        this.selectedTowerId = null
        this.closeSheet()
        this.refreshBuildBar()
        this.refreshHud()
      },
    })
    sellBtn.append(t('battle.sell'))
    sellBtn.appendChild(h('small', {}, [iconText('coin', String(b.sellValue(tower)))]))
    actions.appendChild(sellBtn)

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
              style: 'margin-top:6px;display:inline-block',
            }, [iconText('coin', String(b.evolveCost(tower)))]),
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

