/**
 * @ffmpeg/core と FFmpeg worker を public/ffmpeg-core にコピーする。
 * COEP 有効時は CDN（unpkg）がブロックされるため同一オリジン配信が必須。
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "public/ffmpeg-core");

const copies = [
  {
    from: join(root, "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js"),
    to: "ffmpeg-core.js",
  },
  {
    from: join(root, "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm"),
    to: "ffmpeg-core.wasm",
  },
  {
    from: join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js"),
    to: "ffmpeg-worker.js",
  },
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
