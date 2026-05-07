#!/bin/bash
# Supabase Edge Function デプロイスクリプト
# 使い方: SUPABASE_ACCESS_TOKEN=xxx bash scripts/deploy-edge-function.sh

set -e

PROJECT_REF="iiziplsgfoijvnrsehms"
FUNCTION_NAME="suggest-formations"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"  # 環境変数から取得

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  # .env.supabase から読み込む
  if [ -f ".env.supabase" ]; then
    export $(grep -v '^#' .env.supabase | xargs)
  fi
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN が設定されていません"
  exit 1
fi

echo "1. Supabase CLIでリンク..."
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase link --project-ref $PROJECT_REF

echo "2. Anthropic APIキーをシークレットに設定..."
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_KEY" \
  --project-ref $PROJECT_REF

echo "3. Edge Functionをデプロイ..."
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase functions deploy $FUNCTION_NAME \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

echo "✅ デプロイ完了!"
echo "Edge Function URL: https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"
