# 振り付け・立ち位置エディタ（β）

Vite + React のフロントと、SQLite + Express の API（`server/index.mjs`）で構成されています。楽曲タイムラインと立ち位置の同期、協会参加申請、作品のクラウド保存、PWA インストール、動画確認用モジュール（IndexedDB）を含みます。

## 開発

```bash
npm install
cd server && npm install && cd ..
npm run dev
```

- フロント: `http://127.0.0.1:5173`（Vite が `/api` を `127.0.0.1:3001` にプロキシ）
- API: `http://127.0.0.1:3001`
- 初回ユーザーをサンプル協会の管理者にする処理あり。参加申請後、サーバログに出る承認リンク、または `/approve-membership?token=…` で承認できます。

環境変数（API 側）の例:

| 変数 | 説明 |
|------|------|
| `JWT_SECRET` | 本番では必ず変更 |
| `APP_BASE` | メール用承認リンクのオリジン（既定 `http://127.0.0.1:5173`） |
| `PORT` | API ポート（既定 3001） |
| `DATA_DIR` | SQLite とアップロードの親ディレクトリ（既定は `server` と同じ階層。本番の永続ボリュームを指す） |

## 本番ビルド・ホスティング

```bash
npm run build
npm run start:prod
```

`npm run build` 後、`server/index.mjs` は `../dist` があれば **同一オリジンで静的ファイル＋ `/api`** を配信します（`fetch("/api/...")` のまま利用可）。

### 完全無料だけ（継続課金 0 円・クレジットカード不要を目指す場合）

多くの PaaS（Fly.io / Render / Railway 等）は **無料枠があっても登録時にクレジットカードを求める**ことがあります。「カードを一切使わない」前提なら、次のどれかになります。

#### A. フロントだけ無料公開（手軽・GitHub / Cloudflare アカウントのみのことが多い）

1. `npm run build` で `dist/` を生成する。
2. **Cloudflare Pages** または **GitHub Pages** に `dist` の中身を公開する（リポジトリ連携ならビルドコマンドに `npm run build`、出力ディレクトリに `dist`）。

**制限**: このリポジトリの API（`server/`）は動きません。ログイン・クラウド保存・`/api` 依存の機能は使えません。UI のデモや PWA の見た目確認向きです。

#### B. API まで 0 円で動かす（推奨・データも残る）

**Oracle Cloud Infrastructure の Always Free**（ARM 仮想マシン）は **継続課金なしの無料枠**があり、ディスク付きで SQLite を置けます。電話認証や、地域・時期によっては支払い方法の確認が求められる場合もあります（最新は [Oracle の Always Free 説明](https://www.oracle.com/cloud/free/) を確認）。

1. Always Free の Compute に Ubuntu 等を立てる。
2. Docker を入れ、このリポジトリの `Dockerfile` でイメージをビルドして起動する。
3. 環境変数 `JWT_SECRET`・`APP_BASE`（公開 URL）・`DATA_DIR`（永続ディスクのマウント先）を設定する。
4. ファイアウォールで HTTP/HTTPS を開ける。

同一マシンでフロント＋APIが動くため、`client.ts` を変えずに済みます。

#### C. 自宅 PC を 0 円で公開（トンネル）

自宅で `npm run start:prod` を常時動かし、**Cloudflare Tunnel**（無料）などで HTTPS 公開する方法もあります（PCは常時起動が前提）。

---

### 参考（クレジットカード登録のある「無料枠」）

`Dockerfile` と `fly.toml` は **Fly.io** 向けの例として残してあります。無料枠でも **カード登録が必要**なことが多いので、「完全無料のみ」の条件には含めていません。使う場合は [Fly の料金](https://fly.io/docs/about/pricing/) を確認してください。

`dist/` だけを静的ホストに置き、API を別 URL で動かす場合は CORS と `src/api/client.ts` の `base` 調整が必要です。

## PWA

`vite-plugin-pwa` によりオフラインキャッシュと Web App Manifest を生成します。`npm run build` 後の `dist` を配信すると「インストール」が利用可能になります。

## Capacitor（モバイルラップの準備）

同一の `npm run build` 出力を Capacitor の `webDir` に指定してラップできます。ファイルピッカー・IndexedDB クォータは iOS/Android 実機で要検証です。動画モジュールは現状ブラウザ IndexedDB 保存です。本番ではオブジェクトストレージ＋署名 URL への移行を想定しています。

## 今後（計画上の未実装・拡張）

- **フェーズ C**: リアルタイム共同編集（CRDT / オペレーション変換等）は未実装。現状は会員・協会承認・作品のユーザー単位クラウド保存と JSON 共有に留まります。
- **フェーズ B（一部のみ）**: エディタ内の「3D（簡易）」は俯瞰用の最小表示です。プロップ・アニメ、MediaRecorder による動画書き出し、本格的なオービット編集 UI は含みません。
- Stripe 本番連携（現状は `POST /api/billing/placeholder-purchase` の開発用フラグのみ）
