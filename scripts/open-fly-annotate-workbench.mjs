#!/usr/bin/env node
/**
 * Open per-song Human-first annotation workbench (local static server).
 *
 * Usage:
 *   npm run fly:annotate
 *   npm run fly:annotate -- 003
 *   npm run fly:annotate -- song-005
 *   npm run fly:annotate:b              # annotator-b blind, double queue 002/005/010/013
 *   npm run fly:annotate:b -- 005
 *
 * Supports HTTP Range (206) so <audio> can seek to any position.
 * Never overlays analyzer results. annotator-b mode does not load annotator-a.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";

const ROOT = join(homedir(), "ChoreoCoreDatasets", "fly-real-song");
const WB = join(ROOT, "workbench");
const PORT = 4747;

const args = process.argv.slice(2);
let annotator = "annotator-a";
let doubleOnly = false;
let id = "001";

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--annotator" || a === "-a") {
    annotator = args[++i] || "annotator-a";
  } else if (a === "--double" || a === "-d") {
    doubleOnly = true;
  } else if (a === "--blind" || a === "-b") {
    annotator = "annotator-b";
    doubleOnly = true;
  } else if (!a.startsWith("-")) {
    id = a.replace(/^song-/, "").padStart(3, "0");
  }
}

if (annotator === "annotator-b") {
  doubleOnly = true;
  if (!["002", "005", "010", "013"].includes(id)) {
    id = "002";
  }
}

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

function sendFile(req, res, path) {
  const st = statSync(path);
  const size = st.size;
  const type = MIME[extname(path)] || "application/octet-stream";
  const range = req.headers.range;

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) {
      res.writeHead(416, {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
      });
      res.end();
      return;
    }
    let start = m[1] === "" ? 0 : Number(m[1]);
    let end = m[2] === "" ? size - 1 : Number(m[2]);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      res.writeHead(416, {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
      });
      res.end();
      return;
    }
    end = Math.min(end, size - 1);
    const chunk = end - start + 1;
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Length": chunk,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    createReadStream(path, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  createReadStream(path).pipe(res);
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/workbench/index.html";
    const path = normalize(join(ROOT, rel.replace(/^\//, "")));
    if (!path.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    // Blind guard: never serve peer annotator JSON into the workbench page flow.
    // (Static annotations/*.json are still on disk for later Agreement — not linked in UI.)
    if (
      annotator === "annotator-b" &&
      /\/annotations\/song-\d+\/annotator-a\.json$/i.test(path)
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("blocked: annotator-b blind mode must not load annotator-a");
      return;
    }
    if (!existsSync(path) || statSync(path).isDirectory()) {
      res.writeHead(404);
      res.end("not found: " + rel);
      return;
    }
    sendFile(req, res, path);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const qs = new URLSearchParams({
    id,
    annotator,
    ...(doubleOnly ? { double: "1" } : {}),
    ...(annotator === "annotator-b" ? { blind: "1" } : {}),
  });
  const url = `http://127.0.0.1:${PORT}/workbench/index.html?${qs}`;
  console.log(`FLY annotate workbench: ${url}`);
  console.log(`Audio root: ${ROOT}`);
  console.log(`Annotator: ${annotator}${doubleOnly ? " · double-queue only" : ""}`);
  if (annotator === "annotator-b") {
    console.log("BLIND: do not open annotator-a JSON. Ear + waveform only.");
  }
  console.log("Human-first: no analyzer overlays. Ctrl+C to stop.");
  const open =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(open);
});
