/**
 * FFmpeg.wasm 用静的ファイルを public/ffmpeg-core にコピーする。
 * COEP 有効時は CDN（unpkg）がブロックされるため同一オリジン配信が必須。
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "public/ffmpeg-core");
const ffmpegPkg = join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const corePkg = join(root, "node_modules/@ffmpeg/core/dist/esm");

const copies = [
  { from: join(corePkg, "ffmpeg-core.js"), to: "ffmpeg-core.js" },
  { from: join(corePkg, "ffmpeg-core.wasm"), to: "ffmpeg-core.wasm" },
  { from: join(ffmpegPkg, "const.js"), to: "const.js" },
  { from: join(ffmpegPkg, "errors.js"), to: "errors.js" },
  { from: join(ffmpegPkg, "worker.js"), to: "ffmpeg-class-worker.js" },
];

for (const { from } of copies) {
  if (!existsSync(from)) {
    console.error(`[sync-ffmpeg-core] 不足: ${from}`);
    process.exit(1);
  }
}

mkdirSync(destDir, { recursive: true });
for (const { from, to } of copies) {
  cpSync(from, join(destDir, to));
}
console.log("[sync-ffmpeg-core] public/ffmpeg-core/ にコピーしました");
