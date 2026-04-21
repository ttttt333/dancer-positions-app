/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** 例: wss://api.example.com （未設定時は開発では hostname:3001） */
  readonly VITE_COLLAB_WS?: string;
}
