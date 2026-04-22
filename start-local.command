#!/usr/bin/env bash
# ChoreoGrid をローカルで見る: ダブルクリックでターミナルが開き、API + Vite が起動します。
# このウィンドウを閉じるとアプリは止まります。ブラウザで http://localhost:5173 を開いてください。

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ChoreoGrid ローカル起動"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "エラー: npm が見つかりません。Node.js をインストールしてください。"
  read -r -p "Enter で終了…" _
  exit 1
fi

echo "→ 依存関係（ルート）…"
npm install
echo "→ 依存関係（server）…"
( cd server && npm install )

echo ""
echo "→ 開発サーバー起動中（終了するまでこのウィンドウを開いたままにしてください）"
echo "   ブラウザ: http://localhost:5173"
echo ""

NO_OPEN=1 npm run dev

echo ""
read -r -p "サーバーが終了しました。Enter で閉じます…" _
