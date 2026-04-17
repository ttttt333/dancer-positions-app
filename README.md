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

## 本番ビルド・ホスティング

```bash
npm run build
```

`dist/` を静的ホスト（Cloudflare Pages / Vercel 等）に配置し、同一オリジンまたは CORS で API を公開します。フロントの `fetch("/api/...")` はビルド後も同一ドメインで配信するか、環境に合わせて `src/api/client.ts` の `base` をビルド時注入に差し替えてください。

## PWA

`vite-plugin-pwa` によりオフラインキャッシュと Web App Manifest を生成します。`npm run build` 後の `dist` を配信すると「インストール」が利用可能になります。

## Capacitor（モバイルラップの準備）

同一の `npm run build` 出力を Capacitor の `webDir` に指定してラップできます。ファイルピッカー・IndexedDB クォータは iOS/Android 実機で要検証です。動画モジュールは現状ブラウザ IndexedDB 保存です。本番ではオブジェクトストレージ＋署名 URL への移行を想定しています。

## 今後（計画上の未実装・拡張）

- **フェーズ C**: リアルタイム共同編集（CRDT / オペレーション変換等）は未実装。現状は会員・協会承認・作品のユーザー単位クラウド保存と JSON 共有に留まります。
- **フェーズ B（一部のみ）**: エディタ内の「3D（簡易）」は俯瞰用の最小表示です。プロップ・アニメ、MediaRecorder による動画書き出し、本格的なオービット編集 UI は含みません。
- Stripe 本番連携（現状は `POST /api/billing/placeholder-purchase` の開発用フラグのみ）
