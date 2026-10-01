# Aegis TD — Simple Tower Defense

スマートフォンで遊べる、シンプルなグラフィックのタワーディフェンス PWA。

タイトル: **Aegis TD** / サブタイトル: **Simple Tower Defense**

ライブ: https://g0083.github.io/TDgame/

---

## 特徴

- **完全オフライン対応 PWA** — ホーム画面に追加してネイティブアプリのように起動
- **画像アセット ゼロ** — すべてのキャラクタ・タワー・背景は Canvas による手続き描画、音は WebAudio 合成
- **縦持ち最適化** — 論理解像度 480×640 のフィールドを画面に合わせてスケール、`env(safe-area-inset-*)` 対応
- **日本語 / 英語** 切替可能

## 長く遊べる要素

| 要素 | 内容 |
|---|---|
| **タワー 12 種** | 矢 / 大砲 / 臼砲 / 氷 / テスラ / 毒 / 狙撃 / レーザー / 炎上 / 増幅 / 金山 / 氷壁 |
| **進化 24 種** | 各タワーは Lv4 で 2 つの派生進化から 1 つを選択（プレイ中に分岐） |
| **敵 17 種** | 歩兵・走兵・Bruiser・装甲兵・シールド兵・飛行兵・医療兵・分裂体・ファントム・呪われた者・スウォーム・召喚師・位相体・Juggernaut + ボス 3 種 |
| **ステージ 6 面** | それぞれ異なる地形とウェーブ表、★3 評価 |
| **エンドレス** | 敵の HP・数・新タイプが無限にスケールする挑戦モード |
| **アリーナ** | 研究の進捗に応じて敵がさらに強化される名誉モード（研究で解放） |
| **デイリーチャレンジ** | 日付シードから自動生成。翌日リセット |
| **研究所 (Lab)** | 4 ブランチ 24 項目の恒久強化。40〜80 時間分の深度 |
| **実績 27 種** | 撃破数・連続ウェーブ・ボス・進化・無傷クリアなど |
| **図鑑** | 全タワー / 全敵のステータス・特性・説明 |
| **隣接シナジー** | 例: 矢と大砲を隣接させると交差砲火で +25% ダメージ |
| **スキル 5 種** | 絶対零度 / 空襲 / 隕石雨 / ラッシュアワー / 緊急修理 |
| **戦闘サポート** | 5 種のターゲットモード、AUTO 進行、1x/2x/3x 速度、ウェーブプレビュー＋特性別の対策ヒント |

## セットアップ

```bash
npm install
npm run dev        # 開発サーバー (http://localhost:5173)
```

## ビルドと検証

```bash
npm run typecheck  # TypeScript の型検査
npm run build      # 型検査 + 本番ビルド + Service Worker 生成
npm run preview    # dist/ をローカル確認 (Service Worker も動作)
npm run test:balance  # ヘッドレスで全ステージ・エンドレス・デイリーを自動シミュレーション
npm run test:subpath  # ビルド結果を /TDgame/ サブパス配信して検証（Pages 相当）
npm run test:live     # 公開済み URL (g0083.github.io/TDgame/) に直接アクセスして検証
npm run test:smoke    # Playwright で実ブラウザのスモークテスト
npm run icons          # PWA アイコンの再生成 (source.svg から)
```

## PWA について

- `vite-plugin-pwa` (Workbox) が `dist/sw.js` を生成し、アプリシェルを precache する
- ビルド後に一度ロードすれば、**完全にオフラインでプレイ可能**
- アイコン: 192 / 512 / maskable / apple-touch-icon を `public/icons/` に生成済み
- Android / Chrome: 設定画面の「アプリをインストール」ボタンから `beforeinstallprompt` 経由
- iOS / Safari: 「共有」→「ホーム画面に追加」（ゲーム内で案内を表示）

## 公開する場合

Service Worker には HTTPS (または `localhost`) が必要です。

### GitHub Pages

`.github/workflows/deploy-pages.yml` に自動デプロイ用のワークフローを同梱しています。
`main` ブランチへ push するたびに **ビルド → 公開** が自動で走ります。

このリポジトリ（`g0083/TDgame`）はプロジェクトサイトなので、公開 URL は
**https://g0083.github.io/TDgame/** になります。ワークフローは `VITE_BASE=/TDgame/` を
設定するため、自動的にサブパス配信に対応します。

> **Settings → Pages の手動設定は不要です。**
> 初回のデプロイ時に `actions/deploy-pages` が Pages を自動有効化します。
> （`actions/configure-pages` は Pages 有効化前に Pages API を参照して 404 で
> 失敗するため、使用していません。）

手動でビルドする場合は同じ環境変数を渡してください。

```bash
# Windows (PowerShell)
$env:VITE_BASE='/TDgame/'; npm run build

# macOS / Linux
VITE_BASE=/TDgame/ npm run build
```

`VITE_BASE` を指定しない場合は相対パス (`./`) でビルドされるため、
独自ドメインや `username.github.io` 直下でもそのまま動作します。

### その他の静的ホスト

`npm run build` で生成された `dist/` をそのままアップロードするだけです。

## ファイル構成

```
src/
├─ main.ts              エントリポイント
├─ app.ts               画面管理・モード遷移・セーブ連携
├─ core/                rng / math / grid / pathfind
├─ data/                towers / enemies / stages / waves / research / achievements / abilities
├─ game/                battle (シミュレーション本体) / enemy / tower / projectile / daily
├─ render/              renderer (描画) / sprites / fx (パーティクル)
├─ audio/               synth (WebAudio 合成 SE + BGM)
├─ save/                save (localStorage) / meta (研究ボーナス計算)
├─ ui/                  battleView / shell / dom / i18n
└─ styles.css
```

## セーブ

`localStorage` のキー `aegis-td-save-v1` に JSON で保存。スキーマ番号を持ち、
新しいバージョンではデフォルト値と deep-merge するため、更新しても壊れません。
設定画面の「データを初期化」でリセットできます。
