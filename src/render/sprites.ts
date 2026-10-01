import { TAU } from '../core/math'
import type { EnemyDef } from '../data/types'
import type { TowerDef } from '../data/types'

/** Draw an enemy body by its shape. Assumes ctx is already translated to the body. */
export function drawEnemyShape(
  ctx: CanvasRenderingContext2D,
  def: EnemyDef,
  radius: number,
  opts: { flash: number; phased: boolean; hidden: boolean; chilled: boolean; burning: boolean },
): void {
  const r = radius
  ctx.beginPath()
  switch (def.shape) {
    case 'square':
      ctx.rect(-r, -r, r * 2, r * 2)
      break
    case 'triangle':
      ctx.moveTo(0, -r * 1.15)
      ctx.lineTo(r, r * 0.85)
      ctx.lineTo(-r, r * 0.85)
      ctx.closePath()
      break
    case 'hex': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        const px = Math.cos(a) * r
        const py = Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      break
    }
    case 'diamond':
      ctx.moveTo(0, -r * 1.2)
      ctx.lineTo(r, 0)
      ctx.lineTo(0, r * 1.2)
      ctx.lineTo(-r, 0)
      ctx.closePath()
      break
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2
        const rr = i % 2 === 0 ? r : r * 0.45
        const px = Math.cos(a) * rr
        const py = Math.sin(a) * rr
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      break
    }
    default:
      ctx.arc(0, 0, r, 0, TAU)
  }
  ctx.closePath()

  if (opts.hidden) {
    ctx.fillStyle = 'rgba(120,130,180,0.18)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(160,170,220,0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
    return
  }

  const grad = ctx.createLinearGradient(-r, -r, r, r)
  grad.addColorStop(0, def.color)
  grad.addColorStop(1, def.accent)
  ctx.fillStyle = opts.phased ? 'rgba(140,240,220,0.25)' : grad
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = opts.flash > 0 ? '#ffffff' : opts.phased ? '#8ff0d8' : 'rgba(0,0,0,0.35)'
  ctx.stroke()

  if (opts.chilled) {
    ctx.strokeStyle = 'rgba(158,240,255,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  if (opts.burning) {
    ctx.fillStyle = 'rgba(255,140,50,0.28)'
    ctx.fill()
  }
}

/**
 * Draw a tower icon centred on the CURRENT canvas origin.
 *
 * The icon is authored in a 24x24 design space and centred on (0, 0), so the
 * caller is responsible for positioning: either translate to the cell centre
 * (battle field) or to the canvas centre (build bar / codex icons).
 * `size` is the on-screen edge length in CSS pixels.
 */
export function drawTowerIcon(
  ctx: CanvasRenderingContext2D,
  def: TowerDef,
  size: number,
  evolvedColor?: string,
): void {
  const s = size / 24
  ctx.save()
  ctx.scale(s, s)
  const c = evolvedColor ?? def.color
  const a = def.accent
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'

  const base = (fill: string) => {
    ctx.fillStyle = fill
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.moveTo(-9, 8)
    ctx.lineTo(9, 8)
    ctx.lineTo(6, 4)
    ctx.lineTo(-6, 4)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  switch (def.icon) {
    case 'arrow':
      base(a)
      ctx.fillStyle = c
      ctx.fillRect(-3, -2, 6, 8)
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(5, -2)
      ctx.lineTo(-5, -2)
      ctx.closePath()
      ctx.fill()
      break
    case 'cannon':
      base(a)
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(0, 0, 7, 0, TAU)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#222'
      ctx.fillRect(-2, -10, 4, 9)
      break
    case 'mortar':
      base(a)
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(-6, 6)
      ctx.lineTo(6, 6)
      ctx.lineTo(3, -8)
      ctx.lineTo(-3, -8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    case 'frost':
      base(a)
      ctx.strokeStyle = c
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI
        ctx.beginPath()
        ctx.moveTo(-Math.cos(ang) * 8, -Math.sin(ang) * 8)
        ctx.lineTo(Math.cos(ang) * 8, Math.sin(ang) * 8)
        ctx.stroke()
      }
      break
    case 'tesla':
      base(a)
      ctx.strokeStyle = c
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, 6)
      ctx.lineTo(0, -6)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, -7, 3.4, 0, TAU)
      ctx.fillStyle = c
      ctx.fill()
      ctx.stroke()
      break
    case 'poison':
      base(a)
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.quadraticCurveTo(6, -1, 0, 5)
      ctx.quadraticCurveTo(-6, -1, 0, -9)
      ctx.closePath()
      ctx.fill()
      break
    case 'sniper':
      base(a)
      ctx.strokeStyle = c
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(-8, 5)
      ctx.lineTo(8, -8)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, TAU)
      ctx.strokeStyle = c
      ctx.stroke()
      break
    case 'beam':
      base(a)
      ctx.fillStyle = c
      ctx.fillRect(-9, -3, 18, 5)
      ctx.fillStyle = '#fff'
      ctx.fillRect(-9, -1.5, 18, 2)
      break
    case 'flame':
      base(a)
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.quadraticCurveTo(7, -1, 0, 6)
      ctx.quadraticCurveTo(-7, -1, 0, -9)
      ctx.closePath()
      ctx.fill()
      break
    case 'amp':
      base(a)
      ctx.strokeStyle = c
      ctx.lineWidth = 2
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath()
        ctx.arc(0, 4, i * 4, Math.PI, 0)
        ctx.stroke()
      }
      break
    case 'mine':
      base(a)
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(0, -1, 6, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#7a5a00'
      ctx.font = 'bold 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('$', 0, 2)
      break
    case 'wall':
    default:
      base(a)
      ctx.fillStyle = c
      ctx.fillRect(-8, -8, 7, 9)
      ctx.fillRect(1, -8, 7, 9)
      break
  }
  ctx.restore()
}
