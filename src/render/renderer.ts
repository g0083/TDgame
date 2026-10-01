import { CELL, COLS, FIELD_H, FIELD_W, ROWS } from '../core/grid'
import { TAU, clamp } from '../core/math'
import type { Battle } from '../game/battle'
import { drawEnemyShape, drawTowerIcon } from './sprites'

export interface RenderOpts {
  /** cell the player is hovering / building on */
  hoverCell: { c: number; r: number } | null
  selectedTowerId: number | null
  showRanges: boolean
  lowQuality: boolean
}

export class Renderer {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private cssW = FIELD_W
  private cssH = FIELD_H
  /** cached static background */
  private bg: HTMLCanvasElement | null = null
  private bgKey = ''

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2D context unavailable')
    this.ctx = ctx
    this.resize()
  }

  /** Fit the logical 480x640 field into the available box, keeping the aspect. */
  resize(): { w: number; h: number } {
    const parent = this.canvas.parentElement
    const availW = parent ? parent.clientWidth : FIELD_W
    const availH = parent ? parent.clientHeight : FIELD_H
    const scale = Math.min(availW / FIELD_W, availH / FIELD_H)
    this.cssW = Math.floor(FIELD_W * scale)
    this.cssH = Math.floor(FIELD_H * scale)
    this.dpr = Math.min(3, window.devicePixelRatio || 1)
    this.canvas.width = Math.floor(this.cssW * this.dpr)
    this.canvas.height = Math.floor(this.cssH * this.dpr)
    this.canvas.style.width = `${this.cssW}px`
    this.canvas.style.height = `${this.cssH}px`
    return { w: this.cssW, h: this.cssH }
  }

  /** Convert a client point into logical field coordinates. */
  toField(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * FIELD_W
    const y = ((clientY - rect.top) / rect.height) * FIELD_H
    return { x, y }
  }

  private buildBackground(b: Battle): void {
    const c = document.createElement('canvas')
    c.width = FIELD_W
    c.height = FIELD_H
    const g = c.getContext('2d')
    if (!g) return
    const map = b.map

    // base gradient
    const grad = g.createLinearGradient(0, 0, 0, FIELD_H)
    grad.addColorStop(0, map.background)
    grad.addColorStop(1, '#05070d')
    g.fillStyle = grad
    g.fillRect(0, 0, FIELD_W, FIELD_H)

    // subtle grid
    g.strokeStyle = 'rgba(255,255,255,0.045)'
    g.lineWidth = 1
    for (let x = 0; x <= COLS; x++) {
      g.beginPath()
      g.moveTo(x * CELL + 0.5, 0)
      g.lineTo(x * CELL + 0.5, FIELD_H)
      g.stroke()
    }
    for (let y = 0; y <= ROWS; y++) {
      g.beginPath()
      g.moveTo(0, y * CELL + 0.5)
      g.lineTo(FIELD_W, y * CELL + 0.5)
      g.stroke()
    }

    // decorative terrain blobs (deterministic per stage)
    let seed = 0
    for (const ch of map.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    g.globalAlpha = 0.06
    g.fillStyle = map.accent
    for (let i = 0; i < 26; i++) {
      const x = rnd() * FIELD_W
      const y = rnd() * FIELD_H
      const r = 12 + rnd() * 34
      g.beginPath()
      g.arc(x, y, r, 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1

    // path
    const pts = b.pathPoints
    if (pts.length > 1) {
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.strokeStyle = 'rgba(0,0,0,0.35)'
      g.lineWidth = CELL * 0.78
      g.beginPath()
      g.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
      g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.07)'
      g.lineWidth = CELL * 0.62
      g.stroke()
      // centre dashes
      g.strokeStyle = 'rgba(255,255,255,0.10)'
      g.lineWidth = 3
      g.setLineDash([8, 12])
      g.stroke()
      g.setLineDash([])
    }

    // rocks
    for (const rk of map.rocks) {
      const x = rk.c * CELL + CELL / 2
      const y = rk.r * CELL + CELL / 2
      g.fillStyle = 'rgba(255,255,255,0.06)'
      g.strokeStyle = 'rgba(255,255,255,0.14)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(x, y, CELL * 0.34, 0, TAU)
      g.fill()
      g.stroke()
      g.beginPath()
      g.arc(x, y, CELL * 0.2, 0, TAU)
      g.stroke()
    }

    // core
    const cx = b.coreX
    const cy = b.coreY - 14
    g.save()
    g.translate(cx, cy)
    g.fillStyle = map.accent
    g.globalAlpha = 0.5
    g.beginPath()
    g.arc(0, 0, 26, 0, TAU)
    g.fill()
    g.globalAlpha = 1
    g.strokeStyle = '#ffffff'
    g.lineWidth = 2
    g.beginPath()
    g.arc(0, 0, 18, 0, TAU)
    g.stroke()
    g.beginPath()
    g.arc(0, 0, 10, 0, TAU)
    g.stroke()
    g.restore()

    this.bg = c
    this.bgKey = map.id
  }

  draw(b: Battle, opts: RenderOpts): void {
    const ctx = this.ctx
    const sx = (this.cssW / FIELD_W) * this.dpr
    const sy = (this.cssH / FIELD_H) * this.dpr
    ctx.setTransform(sx, 0, 0, sy, 0, 0)
    ctx.clearRect(0, 0, FIELD_W, FIELD_H)

    if (!this.bg || this.bgKey !== b.map.id) this.buildBackground(b)
    if (this.bg) ctx.drawImage(this.bg, 0, 0)

    // camera shake
    ctx.save()
    ctx.translate(b.fx.offsetX, b.fx.offsetY)

    this.drawMeteors(b)
    this.drawBuildGhost(b, opts)
    this.drawRanges(b, opts)
    this.drawTowers(b, opts)
    this.drawEnemies(b)
    this.drawProjectiles(b)
    this.drawFx(b)
    ctx.restore()

    this.drawHoverCell(b, opts)
    this.drawFlash(b)
  }

  private drawFlash(b: Battle): void {
    if (b.fx.flash <= 0) return
    const ctx = this.ctx
    ctx.globalAlpha = b.fx.flash
    ctx.fillStyle = b.fx.flashColor
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    ctx.globalAlpha = 1
  }

  private drawMeteors(b: Battle): void {
    const ctx = this.ctx
    for (const m of b.meteors) {
      if (m.t < 0) {
        // incoming warning marker
        ctx.save()
        ctx.globalAlpha = 0.4
        ctx.strokeStyle = '#ff9a3c'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(m.x, m.y, 34, 0, TAU)
        ctx.stroke()
        ctx.restore()
      } else {
        const p = clamp(m.t / 0.5, 0, 1)
        const y = m.y - 300 * (1 - p)
        ctx.save()
        ctx.globalAlpha = 1 - p * 0.5
        ctx.fillStyle = '#ffcf6b'
        ctx.beginPath()
        ctx.arc(m.x, y, 8 + p * 4, 0, TAU)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,140,60,0.4)'
        ctx.beginPath()
        ctx.arc(m.x, y, 16 + p * 8, 0, TAU)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  private drawBuildGhost(b: Battle, opts: RenderOpts): void {
    if (!opts.hoverCell) return
    const { c, r } = opts.hoverCell
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return
    const x = c * CELL
    const y = r * CELL
    const ctx = this.ctx
    const blocked = !b.canBuild(c, r) && !b.towerAt(c, r)
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = blocked ? '#ff5b5b' : '#7cf0d8'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 4])
    ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4)
    ctx.setLineDash([])
    if (blocked) {
      ctx.strokeStyle = '#ff5b5b'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(x + 10, y + 10)
      ctx.lineTo(x + CELL - 10, y + CELL - 10)
      ctx.moveTo(x + CELL - 10, y + 10)
      ctx.lineTo(x + 10, y + CELL - 10)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawRanges(b: Battle, opts: RenderOpts): void {
    const ctx = this.ctx
    if (opts.selectedTowerId !== null) {
      const t = b.towers.find((x) => x.id === opts.selectedTowerId)
      if (t) {
        const st = b.towerStats(t)
        ctx.save()
        ctx.fillStyle = 'rgba(124,240,216,0.10)'
        ctx.strokeStyle = 'rgba(124,240,216,0.55)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(t.x, t.y, st.range, 0, TAU)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    }
    if (opts.showRanges) {
      for (const t of b.towers) {
        if (t.def.kind === 'support' || t.def.kind === 'economy') continue
        const st = b.towerStats(t)
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(t.x, t.y, st.range, 0, TAU)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    }
  }


  private drawTowers(b: Battle, opts: RenderOpts): void {
    const ctx = this.ctx
    for (const t of b.towers) {
      const size = CELL - 6
      const x = t.x - size / 2
      const y = t.y - size / 2
      // pad
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.32)'
      roundRect(ctx, x, y, size, size, 7)
      ctx.fill()
      ctx.strokeStyle = t.evolve ? t.evolve.color : 'rgba(255,255,255,0.2)'
      ctx.lineWidth = t.evolve ? 2 : 1.2
      ctx.stroke()
      ctx.restore()

      // turret head rotation for directional towers
      const st = b.towerStats(t)
      const directional =
        t.def.kind !== 'support' && t.def.kind !== 'economy' && t.def.kind !== 'frost' && t.def.kind !== 'wall'
      ctx.save()
      ctx.translate(t.x, t.y)
      if (directional) ctx.rotate(t.angle + Math.PI / 2)
      ctx.translate(-t.x, -t.y)
      drawTowerIcon(ctx, t.def, size, t.evolve?.color)
      ctx.restore()

      // tesla spin
      if (t.def.kind === 'chain') {
        ctx.save()
        ctx.translate(t.x, t.y)
        ctx.rotate(t.spin)
        ctx.strokeStyle = t.evolve?.color ?? t.def.color
        ctx.globalAlpha = 0.7
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(0, 0, 15, 0.3, 2.4)
        ctx.stroke()
        ctx.restore()
      }
      // flame cone hint
      if (t.def.kind === 'flame') {
        ctx.save()
        ctx.globalAlpha = 0.14
        ctx.fillStyle = t.evolve?.color ?? t.def.color
        ctx.beginPath()
        ctx.moveTo(t.x, t.y)
        const a0 = t.angle - 0.6
        const a1 = t.angle + 0.6
        ctx.arc(t.x, t.y, st.range, a0, a1)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
      // support aura
      if (t.def.kind === 'support') {
        ctx.save()
        ctx.globalAlpha = 0.10
        ctx.fillStyle = t.evolve?.color ?? t.def.color
        ctx.beginPath()
        ctx.arc(t.x, t.y, st.range, 0, TAU)
        ctx.fill()
        ctx.restore()
      }
      // mine income sparkle
      if (t.def.kind === 'economy') {
        ctx.save()
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 300)
        ctx.fillStyle = t.def.color
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('+' + Math.round(st.gold ?? 0) + '/s', t.x, t.y - 17)
        ctx.restore()
      }

      // fire flash
      if (t.fireFlash > 0) {
        ctx.save()
        ctx.globalAlpha = t.fireFlash * 0.6
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(t.x, t.y, size * 0.55, 0, TAU)
        ctx.fill()
        ctx.restore()
      }

      // selection ring
      if (opts.selectedTowerId === t.id) {
        ctx.save()
        ctx.strokeStyle = '#7cf0d8'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(t.x, t.y, CELL * 0.55, 0, TAU)
        ctx.stroke()
        ctx.restore()
      }

      // level pips
      ctx.save()
      for (let i = 0; i < t.def.maxLevel; i++) {
        const px = t.x - (t.def.maxLevel * 5) / 2 + i * 5 + 2.5
        ctx.fillStyle = i < t.level ? (t.evolve ? t.evolve.color : '#ffe066') : 'rgba(255,255,255,0.25)'
        ctx.fillRect(px - 1.5, t.y + CELL * 0.34, 3, 3)
      }
      ctx.restore()

      // synergy indicator
      if (b.hasSynergy(t)) {
        ctx.save()
        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#ffe066'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('⚡', t.x, t.y - CELL * 0.36)
        ctx.restore()
      }
    }
  }

  private drawEnemies(b: Battle): void {
    const ctx = this.ctx
    const showHp = true
    for (const e of b.enemies) {
      const r = e.radius * e.scale
      ctx.save()
      ctx.translate(e.x, e.y)

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.ellipse(0, r * 0.75, r * 0.8, r * 0.35, 0, 0, TAU)
      ctx.fill()

      // body
      drawEnemyShape(ctx, e.def, r, {
        flash: e.hitFlash > 0 ? 1 : 0,
        phased: e.phased,
        hidden: e.hidden && e.dist > 120,
        chilled: e.st.slow > 0 || e.st.freeze > 0,
        burning: e.st.burnTimer > 0,
      })

      // status marks
      if (e.st.freeze > 0) {
        ctx.strokeStyle = 'rgba(200,245,255,0.95)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(-r, -r, r * 2, r * 2)
      } else if (e.st.poisonTimer > 0) {
        ctx.fillStyle = 'rgba(166,255,143,0.55)'
        ctx.beginPath()
        ctx.arc(r * 0.5, -r * 0.6, 2.5, 0, TAU)
        ctx.fill()
      } else if (e.st.burnTimer > 0) {
        ctx.fillStyle = 'rgba(255,150,60,0.75)'
        ctx.beginPath()
        ctx.arc(-r * 0.5, -r * 0.6, 2.5, 0, TAU)
        ctx.fill()
      }
      if (e.st.slow > 0 && e.st.freeze <= 0) {
        ctx.strokeStyle = 'rgba(158,240,255,0.8)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(0, 0, r + 3, 0, TAU)
        ctx.stroke()
      }

      // boss crown
      if (e.isBoss) {
        ctx.fillStyle = '#ffd76b'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('★', 0, -r - 6)
      }

      // hp bar
      if (showHp && (e.hp < e.maxHp || e.shield > 0)) {
        const w = Math.max(16, r * 2)
        const hpRatio = clamp(e.hp / e.maxHp, 0, 1)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(-w / 2, -r - 11, w, 4)
        ctx.fillStyle = e.isBoss ? '#ff5b5b' : hpRatio > 0.5 ? '#7ce87c' : hpRatio > 0.25 ? '#ffe066' : '#ff8f8f'
        ctx.fillRect(-w / 2, -r - 11, w * hpRatio, 4)
        if (e.shield > 0) {
          ctx.fillStyle = '#b3a0ff'
          ctx.fillRect(-w / 2, -r - 14, w * clamp(e.shield / Math.max(1, e.maxShield), 0, 1), 2.5)
        }
      }
      ctx.restore()
    }
  }


  private drawProjectiles(b: Battle): void {
    const ctx = this.ctx
    for (const p of b.projectiles) {
      ctx.save()
      // arc offset for lobbed shells
      let y = p.y
      if (p.ballistic) {
        const total = Math.max(1, Math.hypot(p.tx - p.x, p.ty - p.y))
        y = p.y - Math.sin(clamp(p.t * 2.4, 0, Math.PI)) * p.arc
        void total
      }
      const a = Math.atan2(p.vy, p.vx)
      ctx.translate(p.x, y)
      ctx.rotate(a)
      switch (p.kind) {
        case 'shell':
          ctx.fillStyle = '#2b2b33'
          ctx.beginPath()
          ctx.arc(0, 0, 4.5, 0, TAU)
          ctx.fill()
          ctx.fillStyle = p.color
          ctx.fillRect(2, -1.5, 5, 3)
          break
        case 'orb':
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, 4, 0, TAU)
          ctx.fill()
          ctx.globalAlpha = 0.4
          ctx.beginPath()
          ctx.arc(0, 0, 7, 0, TAU)
          ctx.fill()
          break
        case 'bullet':
          ctx.fillStyle = p.color
          ctx.fillRect(-6, -1.2, 12, 2.4)
          break
        default:
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.moveTo(6, 0)
          ctx.lineTo(-3, -2.4)
          ctx.lineTo(-3, 2.4)
          ctx.closePath()
          ctx.fill()
      }
      if (p.crit) {
        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#ffd76b'
        ctx.beginPath()
        ctx.arc(0, 0, 7, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  private drawFx(b: Battle): void {
    const ctx = this.ctx
    const fx = b.fx
    // beams
    for (const bm of fx.beams) {
      ctx.save()
      ctx.globalAlpha = (bm.life / bm.maxLife) * 0.9
      ctx.strokeStyle = bm.color
      ctx.lineWidth = bm.width
      ctx.beginPath()
      ctx.moveTo(bm.x1, bm.y1)
      ctx.lineTo(bm.x2, bm.y2)
      ctx.stroke()
      ctx.globalAlpha = (bm.life / bm.maxLife) * 0.35
      ctx.lineWidth = bm.width * 3
      ctx.stroke()
      ctx.restore()
    }
    // rings
    for (const rg of fx.rings) {
      ctx.save()
      ctx.globalAlpha = 1 - rg.life / rg.maxLife
      ctx.strokeStyle = rg.color
      ctx.lineWidth = rg.width
      ctx.beginPath()
      ctx.arc(rg.x, rg.y, rg.r, 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
    // particles
    for (const p of fx.particles) {
      ctx.save()
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1)
      ctx.fillStyle = p.color
      if (p.shape === 'square') {
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TAU)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
    // floating text
    ctx.save()
    ctx.textAlign = 'center'
    for (const tx of fx.texts) {
      ctx.globalAlpha = clamp(tx.life / tx.maxLife, 0, 1)
      ctx.font = tx.crit ? `bold ${tx.size + 2}px sans-serif` : `${tx.size}px sans-serif`
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.strokeText(tx.text, tx.x, tx.y)
      ctx.fillStyle = tx.color
      ctx.fillText(tx.text, tx.x, tx.y)
    }
    ctx.restore()
  }

  private drawHoverCell(b: Battle, opts: RenderOpts): void {
    if (!opts.hoverCell) return
    const { c, r } = opts.hoverCell
    const t = b.towerAt(c, r)
    if (!t) return
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2)
    ctx.restore()
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
): void {
  const rr = Math.min(rad, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

