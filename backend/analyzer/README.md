# Fly.io へのデプロイ手順（楽曲解析 API）

## 1. 初回

```bash
cd backend/analyzer
fly auth login
fly launch --name choreocore-song-analyzer --region nrt --copy-config --no-deploy
fly deploy
```

疎通確認:

```bash
curl https://choreocore-song-analyzer.fly.dev/health
```

## 2. Supabase 接続

Dashboard SQL で `016_song_analysis.up.sql` を実行。

```bash
npx supabase secrets set ANALYZER_API_URL=https://choreocore-song-analyzer.fly.dev --project-ref iiziplsgfoijvnrsehms
npx supabase functions deploy analyze-song --project-ref iiziplsgfoijvnrsehms
```

## 3. アプリ側

音源をクラウド保存（`audioSupabasePath`）した作品で AI提案を実行。
結果の「解析」が `fly` / `fly-cache` になれば接続成功。失敗時は `browser` にフォールバック。
