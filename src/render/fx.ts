/** Lightweight particle + floating-text system, drawn on the battle canvas. */

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
  drag: number
  shape: 'dot' | 'square' | 'spark' | 'ring' | 'smoke'
  rot: number
  vr: number
}

export interface FloatText {
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  text: string
  color: string
  size: number
  crit: boolean
}

export interface Beam {
  x1: number
  y1: number
  x2: number
  y2: number
  life: number
  maxLife: number
  color: string
  width: number
}

export interface Ring {
  x: number
  y: number
  r: number
  maxR: number
  life: number
  maxLife: number
  color: string
  width: number
}

export class Fx {
  particles: Particle[] = []
  texts: FloatText[] = []
  beams: Beam[] = []
  rings: Ring[] = []
  /** camera shake magnitude in px */
  shake = 0
  private shakeX = 0
  private shakeY = 0
  /** flash overlay 0..1 */
  flash = 0
  flashColor = '#ffffff'
  lowQuality = false

  clear(): void {
    this.particles.length = 0
    this.texts.length = 0
    this.beams.length = 0
    this.rings.length = 0
    this.shake = 0
    this.flash = 0
  }

  addShake(v: number): void {
    this.shake = Math.min(18, this.shake + v)
  }

  addFlash(v: number, color = '#ffffff'): void {
    this.flash = Math.min(0.85, this.flash + v)
    this.flashColor = color
  }

  particle(p: Partial<Particle> & { x: number; y: number; color: string }): void {
    if (this.lowQuality && this.particles.length > 220) return
    this.particles.push({
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      size: 3,
      gravity: 0,
      drag: 0.9,
      shape: 'dot',
      rot: 0,
      vr: 0,
      ...p,
    })
    if (this.particles.length > 600) this.particles.shift()
  }

  burst(x: number, y: number, color: string, n = 8, speed = 90, size = 3): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5
      const s = speed * (0.5 + Math.random() * 0.7)
      this.particle({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.65,
        size: size * (0.7 + Math.random() * 0.8),
        color,
        shape: 'dot',
      })
    }
  }

  text(x: number, y: number, text: string, color = '#fff', size = 13, crit = false): void {
    this.texts.push({
      x: x + (Math.random() - 0.5) * 8,
      y,
      vy: -34,
      life: 0.75,
      maxLife: 0.75,
      text,
      color,
      size,
      crit,
    })
    if (this.texts.length > 60) this.texts.shift()
  }

  beam(x1: number, y1: number, x2: number, y2: number, color: string, width = 2.5): void {
    this.beams.push({ x1, y1, x2, y2, life: 0.12, maxLife: 0.12, color, width })
  }

  ring(x: number, y: number, maxR: number, color: string, width = 3, life = 0.35): void {
    this.rings.push({ x, y, r: 0, maxR, life, maxLife: life, color, width })
  }

  update(dt: number): void {
    const ps = this.particles
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life -= dt
      if (p.life <= 0) {
        ps.splice(i, 1)
        continue
      }
      p.vy += p.gravity * dt
      p.vx *= p.drag
      p.vy *= p.drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]
      t.life -= dt
      if (t.life <= 0) {
        this.texts.splice(i, 1)
        continue
      }
      t.y += t.vy * dt
      t.vy *= 0.9
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt
      if (this.beams[i].life <= 0) this.beams.splice(i, 1)
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      r.life -= dt
      if (r.life <= 0) {
        this.rings.splice(i, 1)
        continue
      }
      const t = 1 - r.life / r.maxLife
      r.r = r.maxR * t
    }
    if (this.shake > 0.05) {
      this.shake *= Math.pow(0.0015, dt)
      const a = Math.random() * Math.PI * 2
      this.shakeX = Math.cos(a) * this.shake
      this.shakeY = Math.sin(a) * this.shake
    } else {
      this.shake = 0
      this.shakeX = 0
      this.shakeY = 0
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2)
  }

  get offsetX(): number {
    return this.shakeX
  }
  get offsetY(): number {
    return this.shakeY
  }
}
