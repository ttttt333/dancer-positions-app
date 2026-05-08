#!/usr/bin/env node
/**
 * 既定ブラウザでアプリ URL を開く。
 * - 開発（Vite）: npm run open:app  → http://127.0.0.1:5173/
 * - 本番ビルド後（Express が dist を配信）: npm run open:prod → http://127.0.0.1:3001/
 * 上書き: OPEN_URL=… npm run open:app（本番は npm run open:prod）
 */
import { execFileSync } from "node:child_process";

const url =
  process.env.OPEN_URL ??
  process.env.DEV_URL ??
  "http://127.0.0.1:5173/";

try {
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "start", "", url], {
      stdio: "inherit",
      windowsHide: true,
    });
  } else if (process.platform === "darwin") {
    execFileSync("open", [url], { stdio: "inherit" });
  } else {
    execFileSync("xdg-open", [url], { stdio: "inherit" });
  }
} catch (e) {
  console.error("ブラウザを開けませんでした。次を手で開いてください:\n  ", url);
  process.exitCode = 1;
}
