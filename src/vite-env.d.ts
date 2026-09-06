/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Supabase プロジェクト URL。設定時は従来の `/api` ではなく Supabase 認証＋`projects` テーブルを使う（末尾スラッシュなし）。
   */
  readonly VITE_SUPABASE_URL?: string;
  /** `anon` public key（クライアント可）。service_role は絶対に入れない */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * Node API のオリジン（末尾スラッシュなし）。未設定時は相対パス（Vite 開発時はプロキシの /api）。
   * Vercel 等「静的ホストのみ」のときは必須。例: https://your-api.fly.dev
   */
  readonly VITE_API_BASE_URL?: string;
  /** 例: wss://api.example.com （未設定時は開発では hostname:3001） */
  readonly VITE_COLLAB_WS?: string;
  /**
   * Formation Reconstruction Engine。未設定は ON。
   * `"0"` / `"false"` / `"off"` で旧経路に戻す。
   */
  readonly VITE_FORMATION_IMPORT_ENGINE?: string;
  /**
   * Real Phase1/2 本番経路。未設定は ON。
   * `"0"` / `"false"` / `"off"` で旧 RMS + 4エイトに戻す。
   */
  readonly VITE_MUSIC_ENGINE_PHASE12?: string;
  /**
   * Fly.io song analyzer（末尾スラッシュなし）。
   * 例: https://choreocore-song-analyzer.fly.dev
   * Edge Function 経由が失敗したときの direct フォールバックに使う。
   */
  readonly VITE_ANALYZER_API_URL?: string;
}
