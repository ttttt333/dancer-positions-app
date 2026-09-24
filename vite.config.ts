import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const repoRoot = join(dirname(fileURLToPath(import.meta.url)));

function syncFfmpegCoreAssets(): void {
  const marker = join(repoRoot, "public/ffmpeg-core/const.js");
  if (existsSync(marker)) return;
  execFileSync("node", ["scripts/sync-ffmpeg-core.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

/** dev / build 前に FFmpeg コアを public へ同期（COEP 下の CDN ブロック回避） */
function ffmpegCoreStaticPlugin(): Plugin {
  return {
    name: "ffmpeg-core-static",
    buildStart() {
      syncFfmpegCoreAssets();
    },
    configureServer() {
      syncFfmpegCoreAssets();
    },
  };
}

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
  define: {
    /** 設定画面などでデプロイ差分を確認できるようにする */
    "import.meta.env.VITE_APP_BUILD": JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || "")
        .slice(0, 7) || new Date().toISOString().slice(0, 10)
    ),
  },
  plugins: [
    react(),
    ffmpegCoreStaticPlugin(),
    devOpenBrowserPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      /** main.tsx で registerSW するため自動注入はオフ（二重登録防止） */
      injectRegister: false,
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
        /** Safari / Mac で古い SW が残りやすいので即時切り替え */
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,wasm}"],
        /** 大きめのチャンク（FFmpeg.wasm コア 等）もプリキャッシュ対象に含める */
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        /** SPA ルート直アクセス時も index.html を返す */
        navigateFallback: "/index.html",
        /** API はフォールバック対象外 */
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            /** ナビ（HTML）は常にネットワーク優先で最新シェルを取る */
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "choreocore-html-v4",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /** デプロイ後の古い SW が存在しない JS チャンクを参照するのを防ぐ */
            urlPattern: /\/assets\/.*\.js$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "choreocore-assets-js-v4",
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 8,
            },
          },
          {
            urlPattern: /\/ffmpeg-core\/ffmpeg-core\.(js|wasm)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "ffmpeg-core-local",
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.includes("supabase.co") &&
              url.pathname.includes("/storage/v1/object/") &&
              url.pathname.includes("choreocore-audio"),
            handler: "CacheFirst",
            options: {
              cacheName: "choreocore-share-audio-v1",
              expiration: {
                maxEntries: 48,
                maxAgeSeconds: 60 * 60 * 24 * 30,
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
    /** SharedArrayBuffer（FFmpeg.wasm）+ クロスオリジン API 両立 */
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
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
  preview: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
