import { fmt, fmtTime } from './core/math'
import { STAGES } from './data/stages'
import { TOWERS } from './data/towers'
import { ALL_ENEMIES } from './data/enemies'
import { RESEARCH } from './data/research'
import { ACHIEVEMENTS } from './data/achievements'
import type { StatsSnapshot, StageDef, TowerId } from './data/types'
import { Battle, type BattleMode, type BattleResult } from './game/battle'
import { getDaily } from './game/daily'
import { computeMeta, researchCost, totalResearchRanks } from './save/meta'
import { loadSave, saveDebounced, saveNow, todayKey, type SaveData } from './save/save'
import { drawTowerIcon } from './render/sprites'
import { audio } from './audio/synth'
import { getLang, setLang, t, td, tn, type TKey } from './util/i18n'
import { clear, confirmDialog, h, iconCanvas, toast } from './ui/dom'
import { icon, iconText } from './ui/icons'
import { createShell, setScreen, type Screen, type ScreenId } from './ui/shell'
import { BattleView } from './ui/battleView'

const SCREENS: ScreenId[] = [
  'title',
  'stages',
  'battle',
  'result',
  'lab',
  'codex',
  'settings',
  'daily',
  'achievements',
]

/** A row of `total` stars, the first `n` of them lit. Replaces ★/☆ text. */
function starRow(n: number, cls = ''): HTMLElement {
  const row = h('div', { class: `star-row${cls ? ` ${cls}` : ''}` })
  for (let i = 0; i < 3; i++) {
    row.appendChild(h('span', { class: i < n ? 'star on' : 'star' }, [icon(i < n ? 'star' : 'starOff')]))
  }
  return row
}

/** Header back arrow shared by the meta screens. */
function backBtn(onBack: () => void): HTMLButtonElement {
  const b = h('button', {
    class: 'btn icon-btn ghost',
    'aria-label': t('menu.back'),
    onclick: onBack,
  }) as HTMLButtonElement
  b.appendChild(icon('arrowLeft'))
  return b
}

export class App {
  private save: SaveData
  private screens: Map<ScreenId, Screen>
  /** exposed for the automated tests (see scripts/test-tower-pos.ts) */
  battleView: BattleView | null = null
  private currentStage: StageDef | null = null
  private currentMode: BattleMode = 'stage'
  private lastResult: BattleResult | null = null
  private labBranch: 'economy' | 'power' | 'utility' | 'fortress' = 'economy'
  private codexTab: 'towers' | 'enemies' = 'towers'
  private playStartTime = 0
  private lastFrame = 0
  /** enemies/towers the player has actually seen (codex unlock tracking) */
  private seenEnemies = new Set<string>()
  private seenTowers = new Set<string>()

  constructor(root: HTMLElement) {
    this.save = loadSave()
    setLang(this.save.settings.lang)
    audio.sfxOn = this.save.settings.sfx
    audio.musicOn = this.save.settings.music
    this.screens = createShell(root, SCREENS)
    this.seenEnemies = new Set(this.save.achievements.filter((a) => a.startsWith('seen_e:')))
    this.restoreSeen()
    this.bindGlobal()
    this.showTitle()
    this.lastFrame = performance.now()
    requestAnimationFrame(this.frame)
  }

  private restoreSeen(): void {
    // nothing persisted beyond achievements today; codex unlocks live in-session
  }

  private get meta() {
    return computeMeta(this.save)
  }

  private persist(): void {
    saveDebounced(this.save)
  }

  // ── global bindings ───────────────────────────────────────
  private bindGlobal(): void {
    const unlock = () => {
      audio.init()
      audio.setMusic(this.save.settings.music)
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('beforeunload', () => saveNow(this.save))
  }

  private frame = (now: number): void => {
    const dt = (now - this.lastFrame) / 1000
    this.lastFrame = now
    if (this.battleView) {
      // battleView runs its own loop; nothing to do here
    } else if (this.playStartTime > 0) {
      // idle
    }
    void dt
    requestAnimationFrame(this.frame)
  }

  private haptic(pattern: number | number[] = 12): void {
    if (!this.save.settings.haptics) return
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern)
      } catch {
        /* ignore */
      }
    }
  }

  // ── title ─────────────────────────────────────────────────
  showTitle(): void {
    const s = setScreen(this.screens, 'title')
    clear(s.body)
    const coins = h('div', { class: 'coins' }, [iconText('coin', fmt(this.save.coins))])
    const hero = h('div', { class: 'hero' }, [
      h('div', { class: 'logo', text: t('app.title') }),
      h('div', { class: 'sub', text: t('app.subtitle') }),
      coins,
    ])

    const mk = (iconName: string, label: string, sub: string, onclick: () => void, extraClass = '') => {
      audio.play('click')
      return h(
        'button',
        { class: `btn ${extraClass}`, onclick },
        [
          h('span', { class: 'menu-ico' }, [icon(iconName)]),
          h('span', { class: 'grow' }, [h('span', { text: label }), h('span', { class: 'sub-label', text: sub })]),
          h('span', { class: 'chev' }, [icon('chevronRight')]),
        ],
      )
    }

    const daily = getDaily()
    const dailyDone = this.save.lastDaily === daily.key && this.save.dailyBest >= daily.goal

    const menu = h('div', { class: 'menu-list' }, [
      mk('play', t('menu.play'), `${this.save.stagesCleared}/${STAGES.length} ${t('menu.stages')}`, () => this.showStages(), 'primary'),
      mk('infinite', t('menu.endless'), `${t('arena.best', { n: this.save.endlessBest })}`, () => this.startEndless('endless')),
      mk(
        'trophy',
        t('menu.arena'),
        this.meta.arenaUnlocked ? t('arena.best', { n: this.save.arenaBest }) : t('common.locked'),
        () => {
          if (this.meta.arenaUnlocked) this.startEndless('arena')
          else toast(t('arena.locked'))
        },
      ),
      mk('calendar', t('menu.daily'), dailyDone ? t('daily.done') : t('daily.goal', { n: daily.goal }), () => this.showDaily()),
      mk('flask', t('menu.lab'), `${t('lab.points')}: ${this.save.coins}`, () => this.showLab()),
      mk('book', t('menu.codex'), t('codex.towers'), () => this.showCodex()),
      mk('medal', t('ach.title'), `${this.save.achievements.length}/${ACHIEVEMENTS.length}`, () => this.showAchievements()),
      mk('gear', t('menu.settings'), '', () => this.showSettings()),
    ])

    s.body.append(hero, menu)
  }

  // ── stage select ──────────────────────────────────────────
  showStages(): void {
    const s = setScreen(this.screens, 'stages')
    clear(s.body)
    s.body.appendChild(
      h('div', { class: 'screen-header' }, [
        backBtn(() => this.showTitle()),
        h('div', { class: 'screen-title', text: t('menu.stages') }),
      ]),
    )
    for (const st of STAGES) {
      const locked = !!st.unlock && this.save.stagesCleared < st.unlock.stagesCleared
      const stars = this.save.stageStars[st.id] ?? 0
      const card = h(
        'button',
        {
          class: `stage-card${locked ? ' locked' : ''}`,
          onclick: () => (locked ? toast(t('common.locked')) : this.startStage(st)),
        },
        [
          h('div', { class: 'idx', text: String(st.index + 1) }),
          h('div', { class: 'meta' }, [
            h('span', { text: tn(st.name, st.nameJa) }),
            h('small', {
              text: locked
                ? `${t('common.locked')} (${t('menu.stages')} ${st.unlock!.stagesCleared})`
                : `${t('battle.wave')} ${st.waves.length}`,
            }),
            locked ? null : starRow(stars),
            locked ? null : h('small', { text: `${t('common.lives')} ${st.lives}` }),
          ]),
          locked ? h('span', { class: 'trail' }, [icon('lock')]) : h('span', { class: 'trail' }, [icon('chevronRight')]),
        ],
      )
      s.body.appendChild(card)
    }
  }

  // ── battle lifecycle ──────────────────────────────────────

  private startStage(stage: StageDef): void {
    this.currentStage = stage
    this.currentMode = 'stage'
    this.launch({ meta: this.meta, mode: 'stage', stage, map: stage })
  }

  private startEndless(mode: 'endless' | 'arena'): void {
    if (mode === 'arena' && !this.meta.arenaUnlocked) {
      toast(t('arena.locked'))
      return
    }
    this.currentStage = null
    this.currentMode = mode
    // endless uses the earlier (shorter) maps so a run stays brisk
    const map = STAGES[rngInt(0, mode === 'arena' ? 5 : 2)]
    const researchRanks = totalResearchRanks(this.save)
    const hpMul = mode === 'arena' ? 1.4 + researchRanks * 0.02 : 1
    const speedMul = mode === 'arena' ? 1.08 : 1
    this.launch({ meta: this.meta, mode, stage: null, map, hpMul, speedMul })
  }

  private startDaily(): void {
    const daily = getDaily()
    this.currentStage = null
    this.currentMode = 'daily'
    this.launch({
      meta: this.meta,
      mode: 'daily',
      stage: null,
      map: daily.map,
      customWaves: daily.waves,
    })
  }

  private launch(opts: ConstructorParameters<typeof Battle>[0]): void {
    audio.init()
    const battle = new Battle(opts)
    this.destroyBattle()
    const view = new BattleView(battle, opts.mode, {
      onExit: () => this.confirmExit(battle),
      onFinish: (res) => this.onBattleEnd(res, battle),
      haptics: () => this.haptic(),
    })
    view.stagesClearedProvider = () => this.save.stagesCleared
    this.battleView = view
    this.playStartTime = performance.now()
    for (const [, sc] of this.screens) sc.el.classList.remove('active')
    document.getElementById('app')!.appendChild(view.el)
    view.el.classList.add('active')
    // the canvas can only be measured once it is in the document
    view.onMounted()
    view.start()
  }

  private destroyBattle(): void {
    if (this.battleView) {
      this.battleView.destroy()
      this.battleView = null
    }
  }

  private async confirmExit(battle: Battle): Promise<void> {
    const ok = await confirmDialog(
      t('battle.abandon'),
      t('battle.abandon') + '?',
      t('common.confirm'),
      t('common.cancel'),
    )
    if (ok) battle.retreat()
    else battle.paused = false
  }


  private onBattleEnd(res: BattleResult, battle: Battle): void {
    const elapsed = Math.max(0, (performance.now() - this.playStartTime) / 1000)
    this.playStartTime = 0

    const st = this.save.stats
    st.kills += res.kills
    st.wavesCleared += res.wavesCleared
    st.goldEarned += res.goldEarned
    st.towersBuilt += battle.towersBuilt
    st.bossesKilled += battle.bossesKilled
    st.evolutions += battle.evolutions
    st.totalDamage += res.damageDealt
    st.playSeconds += Math.round(elapsed)
    st.maxWave = Math.max(st.maxWave, res.wavesCleared)

    let coins = res.coins
    if (res.victory && res.mode === 'stage' && res.stageId) {
      const stage = STAGES.find((x) => x.id === res.stageId)
      if (stage) {
        coins += stage.reward
        const stars = this.calcStars(battle)
        this.save.stageStars[res.stageId] = Math.max(this.save.stageStars[res.stageId] ?? 0, stars)
        if (this.save.stagesCleared <= stage.index) {
          this.save.stagesCleared = Math.max(this.save.stagesCleared, stage.index + 1)
        }
      }
    }
    if (res.mode === 'endless') {
      const prev = this.save.endlessBest
      this.save.endlessBest = Math.max(prev, res.wavesCleared)
      if (res.wavesCleared > prev) coins += 30 + res.wavesCleared * 5
    }
    if (res.mode === 'arena') {
      const prev = this.save.arenaBest
      this.save.arenaBest = Math.max(prev, res.wavesCleared)
      if (res.wavesCleared > prev) coins += 60 + res.wavesCleared * 10
    }
    if (res.mode === 'daily') {
      const daily = getDaily()
      const goalMet = res.wavesCleared >= daily.goal
      this.save.lastDaily = daily.key
      if (goalMet) {
        coins += daily.reward
        const tag = `daily_done:${daily.key}`
        if (!this.save.achievements.includes(tag)) {
          this.save.achievements.push(tag)
          this.save.dailiesDone = this.save.achievements.filter((a) => a.startsWith('daily_done:')).length
        }
      }
      this.save.dailyBest = Math.max(this.save.dailyBest, res.wavesCleared)
    }

    this.save.coins += coins
    this.lastResult = res
    for (const e of battle.enemies) this.seenEnemies.add(e.def.id)
    for (const tw of battle.towers) this.seenTowers.add(tw.type)
    this.checkAchievements()

    this.destroyBattle()
    this.showResult(res, coins)
    this.persist()
  }

  /** 1★ clear, 2★ no lives lost, 3★ no lives lost and rich. */
  private calcStars(battle: Battle): number {
    if (battle.lives >= battle.maxLives) return 3
    if (battle.lives > battle.maxLives * 0.5) return 2
    return 1
  }

  private snapshot(): StatsSnapshot {
    const st = this.save.stats
    return {
      ...st,
      stagesCleared: this.save.stagesCleared,
      dailiesDone: this.save.dailiesDone,
      coins: this.save.coins,
    }
  }

  private checkAchievements(): void {
    const snap = this.snapshot()
    let earned = 0
    for (const a of ACHIEVEMENTS) {
      if (this.save.achievements.includes(a.id)) continue
      if (a.progress(snap) >= a.goal) {
        this.save.achievements.push(a.id)
        earned += a.reward
        setTimeout(() => toast(`${tn(a.name, a.nameJa)} +${a.reward}`, 'gold', 2400), 300)
      }
    }
    if (earned > 0) this.save.coins += earned
  }


  // ── result screen ─────────────────────────────────────────
  private showResult(res: BattleResult, coins: number): void {
    const s = setScreen(this.screens, 'result')
    clear(s.body)
    const title = res.victory ? t('battle.victory') : t('battle.defeat')
    const cls = res.victory ? 'win' : 'lose'

    const rows = h('div', { class: 'result-rows' }, [
      h('div', {}, [h('span', { text: t('battle.wave') }), h('b', { text: String(res.wavesCleared) })]),
      h('div', {}, [h('span', { text: t('battle.kills') }), h('b', { text: fmt(res.kills) })]),
      h('div', {}, [h('span', { text: t('battle.damage') }), h('b', { text: fmt(res.damageDealt) })]),
      h('div', {}, [h('span', { text: t('common.gold') }), h('b', { text: fmt(res.goldEarned) })]),
      h('div', {}, [h('span', { text: t('common.lives') }), h('b', { text: String(res.livesLeft) })]),
    ])

    let stars: HTMLElement | null = null
    if (res.victory && res.mode === 'stage' && res.stageId) {
      const n = this.save.stageStars[res.stageId] ?? 0
      stars = starRow(n, 'stars')
    }

    const card = h('div', { class: 'result-card' }, [
      h('h2', { class: cls, text: title }),
      stars,
      rows,
      h('div', { style: 'font-size:22px;font-weight:800;color:var(--gold)', text: `+${fmt(coins)} ${t('common.coins')}` }),
    ])

    const canNext =
      res.victory && res.mode === 'stage' && res.stageId
        ? (STAGES.find((x) => x.id === res.stageId)?.index ?? 0) + 1 < STAGES.length
        : false

    const footer = h('div', { class: 'screen-footer' }, [
      h('button', { class: 'btn ghost', text: t('menu.back'), onclick: () => this.showTitle() }),
      h('button', { class: 'btn primary', text: t('battle.retry'), onclick: () => this.replay() }),
    ])
    if (canNext) {
      const nextIdx = (STAGES.find((x) => x.id === res.stageId)?.index ?? 0) + 1
      footer.insertBefore(
        h('button', { class: 'btn gold', text: t('battle.next'), onclick: () => this.startStage(STAGES[nextIdx]) }),
        footer.firstChild,
      )
    }

    s.body.appendChild(card)
    s.el.appendChild(footer)
  }
  private replay(): void {
    switch (this.currentMode) {
      case 'stage':
        if (this.currentStage) this.startStage(this.currentStage)
        break
      case 'endless':
      case 'arena':
        this.startEndless(this.currentMode)
        break
      case 'daily':
        this.startDaily()
        break
    }
  }

  // ── daily ─────────────────────────────────────────────────
  showDaily(): void {
    const s = setScreen(this.screens, 'daily')
    clear(s.body)
    const daily = getDaily()
    const doneToday = this.save.lastDaily === daily.key && this.save.dailyBest >= daily.goal

    s.body.appendChild(
      h('div', { class: 'screen-header' }, [
        backBtn(() => this.showTitle()),
        h('div', { class: 'screen-title', text: t('daily.title') }),
      ]),
    )

    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const msLeft = tomorrow.getTime() - now.getTime()

    const card = h('div', { class: 'daily-card' }, [
      h('h3', { text: tn(daily.title, daily.titleJa) }),
      h('p', { text: `${t('daily.goal', { n: daily.goal })} · ${t('daily.reward')}: ${fmt(daily.reward)} ${t('common.coins')}` }),
      h('div', { class: 'big', text: `${t('daily.best', { n: this.save.dailyBest })}` }),
      h('p', { class: 'hint', text: t('daily.resetsIn', { t: fmtTime(msLeft / 1000) }) }),
      h('button', {
        class: `btn ${doneToday ? 'ghost' : 'primary'}`,
        text: doneToday ? t('daily.done') : t('menu.daily'),
        disabled: doneToday,
        onclick: () => this.startDaily(),
      }),
    ])
    s.body.appendChild(card)

    // seed / info card
    s.body.appendChild(
      h('div', { class: 'daily-card' }, [
        h('h3', { text: tn(daily.map.name, daily.map.nameJa) }),
        h('p', {
          text: `${daily.waves.length} ${t('battle.wave')} · ${daily.pool.length} ${t('codex.enemies')} types`,
        }),
        h('p', { class: 'hint', text: `seed: ${daily.seed}` }),
      ]),
    )
  }


  // ── research lab ──────────────────────────────────────────
  showLab(): void {
    const s = setScreen(this.screens, 'lab')
    clear(s.body)
    s.body.appendChild(
      h('div', { class: 'screen-header' }, [
        backBtn(() => this.showTitle()),
        h('div', { class: 'screen-title', text: t('lab.title') }),
        h('div', { class: 'pill gold' }, [iconText('coin', fmt(this.save.coins))]),
      ]),
    )

    const branches: [typeof this.labBranch, TKey][] = [
      ['economy', 'lab.economy'],
      ['power', 'lab.power'],
      ['utility', 'lab.utility'],
      ['fortress', 'lab.fortress'],
    ]
    const tabs = h('div', { class: 'branch-tabs' })
    for (const [b, key] of branches) {
      tabs.appendChild(
        h('button', {
          class: `btn small ${this.labBranch === b ? 'active' : 'ghost'}`,
          text: t(key),
          onclick: () => {
            this.labBranch = b
            audio.play('click')
            this.showLab()
          },
        }),
      )
    }
    s.body.appendChild(tabs)

    for (const def of RESEARCH) {
      if (def.branch !== this.labBranch) continue
      const rank = this.save.research[def.id] ?? 0
      const maxed = rank >= def.maxRank
      const cost = maxed ? 0 : researchCost(def.id, rank)
      const afford = this.save.coins >= cost

      const pips = h('div', { class: 'rank-pips' })
      for (let i = 0; i < def.maxRank; i++) {
        pips.appendChild(h('i', { class: i < rank ? 'on' : '' }))
      }

      const card = h('div', { class: 'research-card' }, [
        h('div', { class: 'ico' }, [icon(def.icon)]),
        h('div', { class: 'body' }, [
          h('strong', { text: `${tn(def.name, def.nameJa)}  ${rank}/${def.maxRank}` }),
          h('small', { text: td(def.desc, def.descJa) }),
          h('small', { style: 'color:var(--accent)', text: tn(def.effect, def.effectJa) }),
          pips,
        ]),
        h('button', {
          class: 'btn small buy primary',
          text: maxed ? t('lab.max') : fmt(cost),
          disabled: maxed || !afford,
          onclick: () => this.buyResearch(def.id),
        }),
      ])
      s.body.appendChild(card)
    }
  }

  private buyResearch(id: string): void {
    const def = RESEARCH.find((r) => r.id === id)
    if (!def) return
    const rank = this.save.research[id] ?? 0
    if (rank >= def.maxRank) return
    const cost = researchCost(id, rank)
    if (this.save.coins < cost) {
      audio.play('deny')
      return
    }
    this.save.coins -= cost
    this.save.research[id] = rank + 1
    this.save.stats.researchSpent += 1
    this.checkAchievements()
    audio.play('upgrade')
    this.haptic()
    this.persist()
    this.showLab()
  }

  // ── codex ─────────────────────────────────────────────────
  showCodex(): void {
    const s = setScreen(this.screens, 'codex')
    clear(s.body)
    s.body.appendChild(
      h('div', { class: 'screen-header' }, [
        backBtn(() => this.showTitle()),
        h('div', { class: 'screen-title', text: t('codex.title') }),
      ]),
    )
    const tabs = h('div', { class: 'branch-tabs' }, [
      h('button', {
        class: `btn small ${this.codexTab === 'towers' ? 'active' : 'ghost'}`,
        text: t('codex.towers'),
        onclick: () => {
          this.codexTab = 'towers'
          this.showCodex()
        },
      }),
      h('button', {
        class: `btn small ${this.codexTab === 'enemies' ? 'active' : 'ghost'}`,
        text: t('codex.enemies'),
        onclick: () => {
          this.codexTab = 'enemies'
          this.showCodex()
        },
      }),
    ])
    s.body.appendChild(tabs)

    if (this.codexTab === 'towers') {
      for (const def of TOWERS) {
        const ic = iconCanvas(28)
        ic.draw((c) => drawTowerIcon(c, def, 28))
        const unlockTxt = def.unlock
          ? `${t('common.locked')} — ${t('menu.stages')} ${def.unlock.stagesCleared}`
          : tn(def.desc, def.descJa)
        s.body.appendChild(
          h('div', { class: 'codex-item' }, [
            h('div', { class: 'ico' }, [ic.canvas]),
            h('div', { class: 'body' }, [
              h('strong', {}, [`${tn(def.name, def.nameJa)} · `, iconText('coin', String(def.cost))]),
              h('small', { text: unlockTxt }),
              h('div', { class: 'tags' }, [
                h('span', { class: 'tag', text: `Lv1 ${def.levels[0].damage}` }),
                h('span', { class: 'tag', text: `range ${def.levels[0].range}` }),
                h('span', { class: 'tag', text: `${(1 / def.levels[0].cooldown).toFixed(1)}/s` }),
              ]),
              def.evolves
                ? h('div', { class: 'tags' }, [
                    h('span', { class: 'tag', text: `→ ${tn(def.evolves[0].name, def.evolves[0].nameJa)}` }),
                    h('span', { class: 'tag', text: `→ ${tn(def.evolves[1].name, def.evolves[1].nameJa)}` }),
                  ])
                : null,
            ]),
          ]),
        )
      }
    } else {
      for (const def of ALL_ENEMIES) {
        const tags = def.traits.map((tr) => h('span', { class: 'tag', text: tr }))
        s.body.appendChild(
          h('div', { class: 'codex-item' }, [
            h('div', { class: 'ico', style: `background:${def.accent}55` }, [icon(def.boss ? 'crown' : 'skull')]),
            h('div', { class: 'body' }, [
              h('strong', { text: tn(def.name, def.nameJa) }),
              h('small', { text: td(def.desc, def.descJa) }),
              h('div', { class: 'tags' }, [
                h('span', { class: 'tag', text: `HP ${def.hp}` }),
                h('span', { class: 'tag', text: `SPD ${def.speed}` }),
                h('span', { class: 'tag' }, [iconText('coin', String(def.bounty))]),
                ...tags,
              ]),
            ]),
          ]),
        )
      }
    }
  }


  // ── achievements ──────────────────────────────────────────
  showAchievements(): void {
    const s = setScreen(this.screens, 'achievements')
    clear(s.body)
    s.body.appendChild(
      h('div', { class: 'screen-header' }, [
        backBtn(() => this.showTitle()),
        h('div', { class: 'screen-title', text: t('ach.title') }),
        h('div', { class: 'pill gold', text: `${this.save.achievements.length}/${ACHIEVEMENTS.length}` }),
      ]),
    )
    const snap = this.snapshot()
    for (const a of ACHIEVEMENTS) {
      const done = this.save.achievements.includes(a.id)
      const p = Math.min(a.progress(snap), a.goal)
      const pct = Math.floor((p / a.goal) * 100)
      s.body.appendChild(
        h('div', { class: 'codex-item' }, [
          h('div', { class: 'ico' }, [icon(a.icon)]),
          h('div', { class: 'body' }, [
            h('strong', { text: tn(a.name, a.nameJa) }),
            h('small', { text: td(a.desc, a.descJa) }),
            h('small', { text: `${fmt(p)} / ${fmt(a.goal)} (${pct}%)` }),
            h('div', { class: 'rank-pips' }, [h('i', { class: 'on', style: `width:${pct}%` })]),
          ]),
          done
            ? h('span', { class: 'pill accent' }, [icon('check')])
            : h('span', { class: 'pill gold' }, [iconText('coin', `+${a.reward}`)]),
        ]),
      )
    }
  }


  // ── settings ──────────────────────────────────────────────
  showSettings(): void {
    const s = setScreen(this.screens, 'settings')
    clear(s.body)
    s.body.appendChild(
      h('div', { class: 'screen-header' }, [
        backBtn(() => this.showTitle()),
        h('div', { class: 'screen-title', text: t('settings.title') }),
      ]),
    )

    const row = (label: string, control: HTMLElement) =>
      h('div', { class: 'setting-row' }, [h('div', { class: 'label', text: label }), control])
    const sw = (on: boolean, onToggle: () => void) =>
      h('button', { class: `switch ${on ? 'on' : ''}`, onclick: () => { onToggle(); audio.play('click') } })

    s.body.appendChild(
      row(
        t('settings.lang'),
        h('button', {
          class: 'btn small ghost',
          text: getLang() === 'ja' ? '日本語 / English' : 'English / 日本語',
          onclick: () => {
            this.save.settings.lang = getLang() === 'ja' ? 'en' : 'ja'
            setLang(this.save.settings.lang)
            this.persist()
            this.showSettings()
          },
        }),
      ),
    )
    s.body.appendChild(
      row(
        t('settings.sfx'),
        sw(this.save.settings.sfx, () => {
          this.save.settings.sfx = !this.save.settings.sfx
          audio.sfxOn = this.save.settings.sfx
          if (this.save.settings.sfx) audio.play('click')
          this.persist()
          this.showSettings()
        }),
      ),
    )
    s.body.appendChild(
      row(
        t('settings.music'),
        sw(this.save.settings.music, () => {
          this.save.settings.music = !this.save.settings.music
          audio.setMusic(this.save.settings.music)
          this.persist()
          this.showSettings()
        }),
      ),
    )
    s.body.appendChild(
      row(
        t('settings.haptics'),
        sw(this.save.settings.haptics, () => {
          this.save.settings.haptics = !this.save.settings.haptics
          this.persist()
          this.showSettings()
        }),
      ),
    )
    s.body.appendChild(
      row(
        t('settings.quality'),
        h('button', {
          class: 'btn small ghost',
          text: this.save.settings.quality === 'high' ? 'High' : 'Low',
          onclick: () => {
            this.save.settings.quality = this.save.settings.quality === 'high' ? 'low' : 'high'
            this.persist()
            this.showSettings()
          },
        }),
      ),
    )

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    s.body.appendChild(
      h('div', { style: 'margin-top:16px' }, [
        h('button', {
          class: 'btn primary',
          text: isStandalone ? t('settings.installed') : t('settings.install'),
          disabled: isStandalone,
          onclick: () => this.promptInstall(),
        }),
      ]),
    )
    s.body.appendChild(
      h('div', {
        class: 'hint',
        text: `${t('settings.offlineReady')}${isIOS() ? ' · ' + t('settings.iosHint') : ''}`,
      }),
    )
    s.body.appendChild(
      h('div', { style: 'margin-top:10px' }, [
        h('button', {
          class: 'btn ghost small',
          text: t('settings.checkUpdate'),
          onclick: () => this.checkUpdate(),
        }),
      ]),
    )
    s.body.appendChild(
      h('div', { style: 'margin-top:24px' }, [
        h('button', {
          class: 'btn danger small',
          text: t('settings.reset'),
          onclick: () => this.resetAll(),
        }),
      ]),
    )
    s.body.appendChild(
      h('div', { class: 'hint', style: 'margin-top:20px;text-align:center', text: `${t('app.title')} · v1.0.0` }),
    )
  }


  private async promptInstall(): Promise<void> {
    const anyWin = window as unknown as { __aegisInstallPrompt?: { prompt: () => Promise<void> } }
    const p = anyWin.__aegisInstallPrompt
    if (p) {
      await p.prompt()
      anyWin.__aegisInstallPrompt = undefined
      toast(t('toast.installed'))
      return
    }
    if (isIOS()) toast(t('settings.iosHint'), 'accent', 3600)
    else toast('Browser menu → "Install app"', 'accent', 3200)
  }

  private async checkUpdate(): Promise<void> {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.()
      await Promise.all((regs ?? []).map((r) => r.update()))
    } catch {
      /* ignore */
    }
    toast(t('settings.updated'), 'accent')
  }

  private async resetAll(): Promise<void> {
    const ok = await confirmDialog(
      t('settings.reset'),
      t('settings.resetConfirm'),
      t('common.confirm'),
      t('common.cancel'),
    )
    if (!ok) return
    localStorage.removeItem('aegis-td-save-v1')
    location.reload()
  }
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function rngInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

