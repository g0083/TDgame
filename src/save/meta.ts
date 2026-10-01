import { RESEARCH_BY_ID, RESEARCH } from '../data/research'
import type { SaveData } from '../save/save'

export interface MetaBonus {
  startGold: number
  killGoldMul: number
  interest: number
  mineMul: number
  buildCostMul: number
  upgradeCostMul: number
  damageMul: number
  rateMul: number
  rangeMul: number
  critAdd: number
  pierceAdd: number
  dotMul: number
  slowMul: number
  abilityCharges: number
  waveGold: number
  sellMul: number
  evoDamageMul: number
  synergyMul: number
  freezeMul: number
  lives: number
  shieldPerWave: number
  lifeRegen: number
  bossDamageMul: number
  leech: number
  enemyHpMul: number
  arenaUnlocked: boolean
}

const one = (): MetaBonus => ({
  startGold: 0,
  killGoldMul: 1,
  interest: 0,
  mineMul: 1,
  buildCostMul: 1,
  upgradeCostMul: 1,
  damageMul: 1,
  rateMul: 1,
  rangeMul: 1,
  critAdd: 0,
  pierceAdd: 0,
  dotMul: 1,
  slowMul: 1,
  abilityCharges: 0,
  waveGold: 0,
  sellMul: 1,
  evoDamageMul: 1,
  synergyMul: 1,
  freezeMul: 1,
  lives: 0,
  shieldPerWave: 0,
  lifeRegen: 0,
  bossDamageMul: 1,
  leech: 0,
  enemyHpMul: 1,
  arenaUnlocked: false,
})

/** Compute all permanent bonuses from the save's research ranks. */
export function computeMeta(save: SaveData): MetaBonus {
  const m = one()
  const r = (id: string) => save.research[id] ?? 0

  m.startGold = r('r_gold_start') * 30
  m.killGoldMul = 1 + r('r_gold_kill') * 0.04
  m.interest = Math.min(0.06, r('r_gold_interest') * 0.01)
  m.mineMul = 1 + r('r_mine_boost') * 0.12
  m.buildCostMul = Math.max(0.6, 1 - r('r_tower_cost') * 0.03)
  m.upgradeCostMul = Math.max(0.6, 1 - r('r_upgrade_cost') * 0.03)
  m.damageMul = 1 + r('r_damage') * 0.04
  m.rateMul = 1 + r('r_rate') * 0.03
  m.rangeMul = 1 + r('r_range') * 0.03
  m.critAdd = r('r_crit') * 0.02
  m.pierceAdd = r('r_pierce') * 0.05
  m.dotMul = 1 + r('r_burn') * 0.07
  m.slowMul = 1 + r('r_slow') * 0.04
  m.abilityCharges = r('r_ability')
  m.waveGold = r('r_wave_bonus') * 12
  m.sellMul = 1 + r('r_sell') * 0.06
  m.evoDamageMul = 1 + r('r_evo') * 0.06
  m.synergyMul = 1 + r('r_synergy') * 0.15
  m.freezeMul = 1 + r('r_freeze_power') * 0.12
  m.lives = r('r_lives')
  m.shieldPerWave = r('r_shield')
  m.lifeRegen = Math.min(1, r('r_regen') * 0.2)
  m.bossDamageMul = 1 + r('r_boss') * 0.08
  m.leech = r('r_leech') * 0.006
  m.enemyHpMul = Math.max(0.7, 1 - r('r_wave_hp') * 0.015)
  m.arenaUnlocked = r('r_prestige') > 0
  return m
}

export const researchCost = (id: string, rank: number): number => {
  const def = RESEARCH_BY_ID[id]
  if (!def) return Infinity
  return def.cost(rank)
}

export const totalResearchSpent = (save: SaveData): number => {
  let total = 0
  for (const def of RESEARCH) {
    const rank = save.research[def.id] ?? 0
    for (let i = 0; i < rank; i++) total += def.cost(i)
  }
  return total
}

export const totalResearchRanks = (save: SaveData): number => {
  let total = 0
  for (const def of RESEARCH) total += save.research[def.id] ?? 0
  return total
}
