import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      /** 開発サーバーでは SW を登録しない（古いキャッシュ UI の防止） */
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ChoreoGrid",
        short_name: "ChoreoGrid",
        description: "楽曲タイムラインと立ち位置の同期、協会向け会員制ツール（β）",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#4f46e5",
        lang: "ja",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        /** 大きめのチャンク（FFmpeg.wasm コア 等）もプリキャッシュ対象に含める */
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        /**
         * FFmpeg コアは CDN（unpkg）から fetch するので、起動後 HTTP キャッシュに載せる。
         * 2 回目以降はネットワーク無しでも動く。
         */
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/@ffmpeg\/core@.*\/dist\/umd\/.*$/,
            handler: "CacheFirst",
            options: {
              cacheName: "ffmpeg-core",
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    /** 127.0.0.1 以外からも開ける（ポート転送・同一 LAN） */
    host: true,
    /** Vite の既定どおり 5173（以前の作業 URL と揃える） */
    port: 5173,
    strictPort: true,
    /** ブラウザが dev の HTML/JS を強キャッシュしないようにする */
    headers: {
      "Cache-Control": "no-store",
    },
    open: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
