import type { AbilityDef } from './types'

export const ABILITIES: AbilityDef[] = [
  {
    id: 'freeze',
    name: 'Absolute Zero',
    nameJa: '絶対零度',
    desc: 'Freezes every enemy on the field for 2.5s.',
    descJa: '場中の敵を2.5秒完全凍結。',
    charges: 3,
    cooldown: 45,
    icon: 'snowflake',
  },
  {
    id: 'airstrike',
    name: 'Airstrike',
    nameJa: '空襲',
    desc: 'Massive damage along the longest stretch of path.',
    descJa: '経路の最大区間に大ダメージ。',
    charges: 3,
    cooldown: 40,
    icon: 'bomb',
  },
  {
    id: 'meteor',
    name: 'Meteor Storm',
    nameJa: '隕石雨',
    desc: 'Rains meteors across the whole field, 6 impacts.',
    descJa: 'フィールド全体に隕石を6回落下の。',
    charges: 2,
    cooldown: 60,
    icon: 'meteor',
  },
  {
    id: 'rush',
    name: 'Rush Hour',
    nameJa: 'ラッシュアワー',
    desc: 'All towers attack 2x faster for 8s.',
    descJa: '全タワーの攻撃速度が8秒間2倍。',
    charges: 3,
    cooldown: 50,
    icon: 'flame',
  },
  {
    id: 'repair',
    name: 'Emergency Repair',
    nameJa: '緊急修理',
    desc: 'Restore 5 lives and clear all projectiles.',
    descJa: 'ライフを5回復し弾をすべて除去。',
    charges: 2,
    cooldown: 70,
    icon: 'wrench',
  },
]

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]))
