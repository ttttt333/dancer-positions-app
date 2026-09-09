#!/usr/bin/env node
/**
 * Open per-song Human-first annotation workbench (local static server).
 * Usage:
 *   npm run fly:annotate
 *   npm run fly:annotate -- 003
 *   npm run fly:annotate -- song-005
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";

const ROOT = join(homedir(), "ChoreoCoreDatasets", "fly-real-song");
const WB = join(ROOT, "workbench");
const PORT = 4747;

const arg = process.argv[2] || "001";
const id = arg.replace(/^song-/, "").padStart(3, "0");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".md": "text/markdown; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

if (!existsSync(join(WB, "index.html"))) {
  console.error("Workbench not found:", join(WB, "index.html"));
  process.exit(1);
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/workbench/index.html";
    // Allow /workbench/* and /* under ROOT (catalog, analysis, annotations)
    const path = normalize(join(ROOT, rel.replace(/^\//, "")));
    if (!path.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    if (!existsSync(path) || statSync(path).isDirectory()) {
      res.writeHead(404);
      res.end("not found: " + rel);
      return;
    }
    const data = readFileSync(path);
    res.writeHead(200, {
      "Content-Type": MIME[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}/workbench/index.html?id=${id}`;
  console.log(`FLY annotate workbench: ${url}`);
  console.log(`Audio root: ${ROOT}`);
  console.log("Human-first: no analyzer overlays. Ctrl+C to stop.");
  const open =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(open);
});
