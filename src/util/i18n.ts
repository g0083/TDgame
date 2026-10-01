export type Lang = 'ja' | 'en'

const dict = {
  // ── meta ui ──
  'app.title': ['Aegis TD', 'Aegis TD'],
  'app.subtitle': ['Simple Tower Defense', 'シンプルなタワーディフェンス'],
  'menu.play': ['プレイ', 'プレイ'],
  'menu.endless': ['エンドレス', 'エンドレス'],
  'menu.arena': ['アリーナ', 'アリーナ'],
  'menu.daily': ['デイリー', 'デイリー'],
  'menu.lab': ['研究所', '研究所'],
  'menu.codex': ['図鑑', '図鑑'],
  'menu.settings': ['設定', '設定'],
  'menu.stages': ['ステージ', 'ステージ'],
  'menu.back': ['戻る', '戻る'],
  'common.close': ['閉じる', '閉じる'],
  'common.cancel': ['キャンセル', 'キャンセル'],
  'common.confirm': ['決定', '決定'],
  'common.gold': ['ゴールド', 'ゴールド'],
  'common.coins': ['コイン', 'コイン'],
  'common.lives': ['ライフ', 'ライフ'],
  'common.wave': ['ウェーブ', 'ウェーブ'],
  'common.lv': ['レベル', 'レベル'],
  'common.owned': ['所有数', '所有数'],
  'common.locked': ['未解放', '未解放'],
  'common.max': ['MAX', 'MAX'],

  // ── battle ──
  'battle.startWave': ['ウェーブ開始', 'ウェーブ開始'],
  'battle.nextWave': ['次のWave', '次のウェーブ'],
  'battle.pause': ['一時停止', '一時停止'],
  'battle.resume': ['再開', '再開'],
  'battle.speed': ['速度', '速度'],
  'battle.wave': ['Wave', 'ウェーブ'],
  'battle.waveOf': ['/ {n} ウェーブ', '/ 全{n}ウェーブ'],
  'battle.enemyIncoming': ['敵出現中', '敵出現中'],
  'battle.waveClear': ['ウェーブクリア！', 'ウェーブクリア！'],
  'battle.victory': ['勝利！', '勝利！'],
  'battle.defeat': ['敗北…', '敗北…'],
  'battle.retry': ['リトライ', 'リトライ'],
  'battle.next': ['次へ', '次へ'],
  'battle.menu': ['メニュー', 'メニュー'],
  'battle.abandon': ['リタイア', 'リタイア'],
  'battle.pickTower': ['タワーを選択して設置', 'タワーを選択して設置'],
  'battle.upgrade': ['強化', '強化'],
  'battle.evolve': ['進化する', '進化する'],
  'battle.sell': ['売却', '売却'],
  'battle.target': ['攻撃対象', '攻撃対象'],
  'battle.cannotAfford': ['ゴールドが足りません', 'ゴールドが足りません'],
  'battle.blocked': ['ここには置けません', 'ここには置けません'],
  'battle.noRoom': ['設置できる場所がありません', '設置できる場所がありません'],
  'battle.synergyActive': ['シナジー発動中', 'シナジー発動中'],
  'battle.autoWave': ['自動進行', '自動進行'],
  'battle.stats': ['戦闘統計', '戦闘統計'],
  'battle.kills': ['撃破数', '撃破数'],
  'battle.damage': ['総ダメージ', '総ダメージ'],
  'battle.coinsEarned': ['獲得コイン', '獲得コイン'],
  'battle.stars': ['評価', '評価'],
  'battle.selectEvolve': ['進化先を選択', '進化先を選択'],
  'battle.interest': ['利息 +{n}', '利息 +{n}'],
  'battle.shieldBlock': ['シールドで防御！', 'シールドで防御！'],
  'battle.towerLimit': ['この場所は塞がっています', 'この場所は塞がっています'],

  'target.first': ['先頭', '先頭'],
  'target.last': ['最後尾', '最後尾'],
  'target.strong': ['最強', '最強'],
  'target.close': ['最近接', '最近接'],
  'target.weak': ['最弱', '最弱'],

  'ability.freeze': ['絶対零度', '絶対零度'],
  'ability.airstrike': ['空襲', '空襲'],
  'ability.meteor': ['隕石雨', '隕石雨'],
  'ability.rush': ['ラッシュアワー', 'ラッシュアワー'],
  'ability.repair': ['緊急修理', '緊急修理'],

  // ── meta ──
  'lab.title': ['研究所', '研究所'],
  'lab.points': ['研究ポイント', '研究ポイント'],
  'lab.economy': ['経済', '経済'],
  'lab.power': ['火力', '火力'],
  'lab.utility': ['機能', '機能'],
  'lab.fortress': ['要塞', '要塞'],
  'lab.rank': ['ランク', 'ランク'],
  'lab.max': ['最大', '最大'],
  'lab.upgrade': ['研究する', '研究する'],

  'codex.title': ['図鑑', '図鑑'],
  'codex.towers': ['タワー', 'タワー'],
  'codex.enemies': ['敵', '敵'],
  'codex.seen': ['発見数', '発見数'],

  'ach.title': ['実績', '実績'],
  'ach.claimed': ['受取済み', '受取済み'],
  'ach.claim': ['受取', '受取'],

  'daily.title': ['デイリーチャレンジ', 'デイリーチャレンジ'],
  'daily.today': ['今日のチャレンジ', '今日のチャレンジ'],
  'daily.done': ['クリア済み', 'クリア済み'],
  'daily.resetsIn': ['リセットまで {t}', 'リセットまで {t}'],
  'daily.goal': ['目標: {n}Wave到達', '目標: {n}ウェーブ到達'],
  'daily.best': ['最高記録: {n}', '最高記録: {n}'],
  'daily.reward': ['クリア報酬', 'クリア報酬'],

  'arena.title': ['アリーナ', 'アリーナ'],
  'arena.desc': [
    '最高難度の挑戦モード。研究の進捗に応じて敵がさらに強化される。',
    'The ultimate challenge mode: enemies scale further as your research grows.',
  ],
  'arena.best': ['最高記録: Wave {n}', '最高記録: Wave {n}'],
  'arena.locked': ['「継承の極意」の研究が必要です', '「継承の極意」の研究が必要です'],

  'settings.title': ['設定', '設定'],
  'settings.lang': ['言語', '言語'],
  'settings.sfx': ['効果音', '効果音'],
  'settings.music': ['BGM', 'BGM'],
  'settings.haptics': ['バイブレーション', 'バイブレーション'],
  'settings.quality': ['描画品質', '描画品質'],
  'settings.install': ['アプリをインストール', 'アプリをインストール'],
  'settings.installed': ['インストール済み', 'インストール済み'],
  'settings.iosHint': [
    'iOS: Safariの「分享」→「ホーム画面に追加」',
    'iOS: Safariの「共有」→「ホーム画面に追加」',
  ],
  'settings.reset': ['データを初期化', 'データを初期化'],
  'settings.resetConfirm': ['本当に初期化しますか？', '本当に初期化しますか？'],
  'settings.offlineReady': ['オフラインプレイ対応', 'オフラインプレイ対応'],
  'settings.checkUpdate': ['更新を確認', '更新を確認'],
  'settings.updated': ['最新です', '最新です'],

  'toast.installed': ['インストールしました！', 'インストールしました！'],
  'toast.researched': ['研究を完了しました', '研究を完了しました'],
  'toast.achievement': ['実績解除！', '実績解除！'],
  'toast.coins': ['+{n} コイン', '+{n} コイン'],
  'toast.newStage': ['新しいステージが解放！', '新しいステージが解放！'],
} as const

export type TKey = keyof typeof dict

let lang: Lang = 'ja'

export function setLang(l: Lang): void {
  lang = l
  document.documentElement.lang = l
}

export function getLang(): Lang {
  return lang
}

export function toggleLang(): Lang {
  setLang(lang === 'ja' ? 'en' : 'ja')
  return lang
}

/** Translate a key. `ja` field is the second entry. */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  const entry = dict[key]
  let s = (lang === 'ja' ? entry[1] : entry[0]) as string
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}

/** Pick the localized field from a data object that has name / nameJa. */
export function tn(name: string, nameJa: string): string {
  return lang === 'ja' ? nameJa : name
}
export function td(desc: string, descJa: string): string {
  return lang === 'ja' ? descJa : desc
}
