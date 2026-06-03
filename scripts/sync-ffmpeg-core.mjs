/**
 * @ffmpeg/core を public/ffmpeg-core にコピーする。
 * COEP 有効時は CDN（unpkg）がブロックされるため同一オリジン配信が必須。
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@ffmpeg/core/dist/esm");
const destDir = join(root, "public/ffmpeg-core");
const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!existsSync(srcDir)) {
  console.error(
    "[sync-ffmpeg-core] @ffmpeg/core が見つかりません。npm install を実行してください。"
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
for (const name of files) {
  const from = join(srcDir, name);
  if (!existsSync(from)) {
    console.error(`[sync-ffmpeg-core] 不足: ${from}`);
    process.exit(1);
  }
  cpSync(from, join(destDir, name));
}
console.log("[sync-ffmpeg-core] public/ffmpeg-core/ にコピーしました");
