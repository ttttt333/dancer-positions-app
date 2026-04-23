/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Node API のオリジン（末尾スラッシュなし）。未設定時は相対パス（Vite 開発時はプロキシの /api）。
   * Vercel 等「静的ホストのみ」のときは必須。例: https://your-api.fly.dev
   */
  readonly VITE_API_BASE_URL?: string;
  /** 例: wss://api.example.com （未設定時は開発では hostname:3001） */
  readonly VITE_COLLAB_WS?: string;
}
