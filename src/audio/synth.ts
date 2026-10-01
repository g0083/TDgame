/**
 * All audio is synthesized with WebAudio: zero asset files,
 * which keeps the bundle tiny and makes the game fully offline.
 */

export type SfxName =
  | 'shoot'
  | 'splash'
  | 'zap'
  | 'beam'
  | 'flame'
  | 'hit'
  | 'kill'
  | 'leak'
  | 'build'
  | 'upgrade'
  | 'evolve'
  | 'sell'
  | 'coin'
  | 'wave'
  | 'boss'
  | 'win'
  | 'lose'
  | 'click'
  | 'freeze'
  | 'boom'
  | 'deny'

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private musicTimer = 0
  private musicStep = 0
  private musicIntensity = 0
  sfxOn = true
  musicOn = true
  private started = false

  /** Must be called from a user gesture on iOS. */
  init(): void {
    if (this.started) {
      void this.ctx?.resume()
      return
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      return
    }
    this.started = true
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    this.sfxGain = ctx.createGain()
    this.sfxGain.gain.value = 0.55
    this.sfxGain.connect(this.master)

    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.0
    this.musicGain.connect(this.master)

    const len = Math.floor(ctx.sampleRate * 1.0)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    this.startMusic()
  }

  resume(): void {
    void this.ctx?.resume()
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'square',
    gain = 0.2,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain) return
    const t0 = this.now() + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.sfxGain)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private noise(
    dur: number,
    gain = 0.2,
    filterFreq = 1200,
    q = 1,
    delay = 0,
    sweepTo?: number,
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.sfxGain || !this.noiseBuf) return
    const t0 = this.now() + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(filterFreq, t0)
    if (sweepTo !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.sfxGain)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  play(name: SfxName, variation = 0): void {
    if (!this.sfxOn) return
    if (!this.ctx) return
    const v = 1 + variation * 0.06
    switch (name) {
      case 'shoot':
        this.tone(720 * v, 0.055, 'square', 0.07, 420 * v)
        break
      case 'splash':
        this.noise(0.24, 0.22, 500, 0.8, 0, 160)
        this.tone(120, 0.2, 'sine', 0.14, 60)
        break
      case 'zap':
        this.tone(1500 * v, 0.07, 'sawtooth', 0.08, 320)
        this.noise(0.09, 0.1, 3200, 2)
        break
      case 'beam':
        this.tone(880 * v, 0.09, 'sawtooth', 0.045, 1200 * v)
        break
      case 'flame':
        this.noise(0.16, 0.08, 700, 0.6, 0, 400)
        break
      case 'hit':
        this.noise(0.05, 0.07, 2400, 1.5)
        break
      case 'kill':
        this.tone(300, 0.09, 'square', 0.08, 600)
        this.noise(0.1, 0.1, 900, 0.8, 0, 200)
        break
      case 'leak':
        this.tone(180, 0.35, 'sawtooth', 0.16, 60)
        break
      case 'build':
        this.tone(420, 0.08, 'triangle', 0.12, 640)
        this.tone(640, 0.1, 'triangle', 0.1, 880, 0.06)
        break
      case 'upgrade':
        this.tone(520, 0.07, 'square', 0.1, 780)
        this.tone(780, 0.1, 'square', 0.1, 1180, 0.06)
        break
      case 'evolve':
        this.tone(330, 0.12, 'sawtooth', 0.1, 990)
        this.tone(660, 0.16, 'square', 0.1, 1320, 0.1)
        this.tone(990, 0.22, 'triangle', 0.12, 1760, 0.2)
        break
      case 'sell':
        this.tone(700, 0.1, 'square', 0.09, 300)
        break
      case 'coin':
        this.tone(1180, 0.05, 'square', 0.05, 1560)
        break
      case 'wave':
        this.tone(330, 0.12, 'square', 0.1, 495)
        this.tone(495, 0.16, 'square', 0.1, 660, 0.1)
        break
      case 'boss':
        this.tone(110, 0.5, 'sawtooth', 0.2, 70)
        this.tone(165, 0.5, 'square', 0.12, 90, 0.05)
        this.noise(0.6, 0.16, 260, 0.6)
        break
      case 'win':
        ;[523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28, 'square', 0.11, undefined, i * 0.11))
        break
      case 'lose':
        ;[440, 370, 294, 220].forEach((f, i) => this.tone(f, 0.32, 'sawtooth', 0.12, undefined, i * 0.14))
        break
      case 'click':
        this.tone(560, 0.035, 'square', 0.06, 720)
        break
      case 'freeze':
        this.tone(1800, 0.5, 'sine', 0.12, 300)
        this.noise(0.5, 0.1, 4200, 3, 0, 500)
        break
      case 'boom':
        this.noise(0.5, 0.28, 320, 0.5, 0, 60)
        this.tone(90, 0.45, 'sine', 0.2, 40)
        break
      case 'deny':
        this.tone(200, 0.12, 'square', 0.1, 120)
        break
    }
  }


  // ── simple procedural BGM ──
  private startMusic(): void {
    const tick = () => {
      if (!this.ctx || !this.musicGain) return
      if (this.musicOn) {
        this.musicGain.gain.setTargetAtTime(0.16, this.now(), 0.5)
        this.step()
      } else {
        this.musicGain.gain.setTargetAtTime(0.0, this.now(), 0.4)
      }
      this.musicTimer = window.setTimeout(tick, 260)
    }
    tick()
  }

  setMusic(on: boolean): void {
    this.musicOn = on
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(on ? 0.16 : 0, this.now(), 0.3)
    }
  }

  /** 0 = menu calm, 1 = battle intense */
  setIntensity(v: number): void {
    this.musicIntensity = v
  }

  private step(): void {
    const ctx = this.ctx
    if (!ctx || !this.musicGain) return
    const s = this.musicStep++
    const t0 = this.now()
    const bassPattern = [0, 0, 7, 0, 5, 5, 3, 3]
    const root = 55 * Math.pow(2, this.musicIntensity * 0.17)
    const note = bassPattern[s % bassPattern.length]
    const freq = root * Math.pow(2, note / 12)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24)
    osc.connect(g)
    g.connect(this.musicGain)
    osc.start(t0)
    osc.stop(t0 + 0.26)

    if (s % 2 === 0 && this.musicIntensity > 0.25) {
      const arp = [12, 15, 19, 22, 19, 15][(s / 2) % 6]
      const f2 = freq * Math.pow(2, arp / 12)
      const o2 = ctx.createOscillator()
      const g2 = ctx.createGain()
      o2.type = 'square'
      o2.frequency.value = f2
      g2.gain.setValueAtTime(0.0001, t0)
      g2.gain.exponentialRampToValueAtTime(0.05 * this.musicIntensity, t0 + 0.01)
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14)
      o2.connect(g2)
      g2.connect(this.musicGain)
      o2.start(t0)
      o2.stop(t0 + 0.16)
    }

    if (this.musicIntensity > 0.6 && s % 4 === 2 && this.noiseBuf) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      const f = ctx.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = 6000
      const g3 = ctx.createGain()
      g3.gain.setValueAtTime(0.03 * this.musicIntensity, t0)
      g3.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
      src.connect(f)
      f.connect(g3)
      g3.connect(this.musicGain)
      src.start(t0)
      src.stop(t0 + 0.06)
    }
  }

  dispose(): void {
    if (this.musicTimer) clearTimeout(this.musicTimer)
    this.musicTimer = 0
    void this.ctx?.close()
    this.ctx = null
    this.started = false
  }
}

export const audio = new AudioEngine()

