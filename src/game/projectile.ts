import type { DamageType } from '../data/types'

export type ProjKind = 'bolt' | 'shell' | 'orb' | 'bullet' | 'flame' | 'rail'

export interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  damage: number
  damageType: DamageType
  /** target enemy id, or -1 for a fixed destination */
  targetId: number
  /** fixed destination (used by lobbed shells) */
  tx: number
  ty: number
  /** true for ballistic (arcing) projectiles that target a ground position */
  ballistic: boolean
  life: number
  pierce: number
  crit: boolean
  splash: number
  slow: number
  slowDur: number
  burn: number
  poison: number
  poisonStacks: number
  chains: number
  color: string
  kind: ProjKind
  /** arc height for rendering lobbed shells */
  arc: number
  t: number
  /** enemies already hit (for pierce) */
  hitIds: Set<number>
  sourceTower: number
  /** special flags from evolution tags */
  tag: string
  /** multi-shot spread angle */
  spread: number
}

export function makeProjectile(init: Partial<Projectile> & { x: number; y: number }): Projectile {
  return {
    vx: 0,
    vy: 0,
    speed: 320,
    damage: 10,
    damageType: 'physical',
    targetId: -1,
    tx: 0,
    ty: 0,
    ballistic: false,
    life: 3,
    pierce: 0,
    crit: false,
    splash: 0,
    slow: 0,
    slowDur: 0,
    burn: 0,
    poison: 0,
    poisonStacks: 3,
    chains: 0,
    color: '#ffffff',
    kind: 'bolt',
    arc: 0,
    t: 0,
    hitIds: new Set<number>(),
    sourceTower: -1,
    tag: '',
    spread: 0,
    ...init,
  }
}
