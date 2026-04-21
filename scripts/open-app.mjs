#!/usr/bin/env node
/**
 * 開発中の既定 URL を既定ブラウザで開く（サーバー起動後に手動実行用）。
 * 使い方: npm run open:app
 */
import { execFileSync } from "node:child_process";

const url = process.env.DEV_URL ?? "http://127.0.0.1:5173/";

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
