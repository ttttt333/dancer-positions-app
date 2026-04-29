import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin, ViteDevServer } from "vite";

/**
 * 立ち位置アプリ（ChoreoCore）をブラウザで確認しやすくする:
 * 開発サーバー起動後に URL をターミナルへ表示し、可能なら既定ブラウザで開く。
 * `npm run dev` で concurrently 経由でも Vite 内で動く。
 * 自動オープンを止める: NO_OPEN=1 npm run dev
 */
function devOpenBrowserPlugin(): Plugin {
  return {
    name: "dev-open-browser",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.httpServer?.once("listening", () => {
        const run = () => {
          const port =
            typeof server.config.server.port === "number"
              ? server.config.server.port
              : 5173;
          const primary =
            server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${port}/`;
          const network = server.resolvedUrls?.network?.[0];
          const bar = "\n" + "━".repeat(62);
          console.log(bar);
          console.log(`  ChoreoCore（立ち位置）を開く →  ${primary}`);
          console.log(`     手動: 別ターミナルで npm run open:app でも開けます`);
          if (network) {
            console.log(`     （同一 LAN の別端末: ${network}）`);
          }
          console.log(bar + "\n");
          if (process.env.NO_OPEN === "1") return;
          try {
            if (process.platform === "win32") {
              execFileSync("cmd", ["/c", "start", "", primary], {
                stdio: "ignore",
                windowsHide: true,
              });
            } else if (process.platform === "darwin") {
              execFileSync("open", [primary], { stdio: "ignore" });
            } else {
              execFileSync("xdg-open", [primary], { stdio: "ignore" });
            }
          } catch {
            console.warn(
              "[vite] ブラウザを自動で開けませんでした。上の URL をコピーするか npm run open:app を実行してください。"
            );
          }
        };
        /** resolvedUrls が遅い環境向けに少し待つ */
        setTimeout(run, 450);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devOpenBrowserPlugin(),
    VitePWA({
      registerType: "prompt",
      /** 開発サーバーでは SW を登録しない（古いキャッシュ UI の防止） */
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ChoreoCore",
        short_name: "ChoreoCore",
        description: "楽曲タイムラインと立ち位置の同期、協会向け会員制ツール（β）",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#4f46e5",
        lang: "ja",
        icons: [
          {
            src: "/brand-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        /** 大きめのチャンク（FFmpeg.wasm コア 等）もプリキャッシュ対象に含める */
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        /** SPA ルート直アクセス時も index.html を返す */
        navigateFallback: "/index.html",
        /** API はフォールバック対象外 */
        navigateFallbackDenylist: [/^\/api/],
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
    /** open は devOpenBrowserPlugin が担当（concurrently でも確実に開く） */
    open: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
