#!/usr/bin/env node
/**
 * 照明プラン CSV → コーパス shows.ts 取り込み
 *
 * Usage:
 *   node scripts/ingest-lighting-plans.mjs [csv-dir]
 *
 * Default csv-dir: ~/Downloads
 * Matches: *19回発表会照明*.csv
 * Also re-parses data/lighting-plans/2023-mini-recital-am12-birthday-TIME.csv if present.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DATA = path.join(root, "data/lighting-plans");
const OUT_TS = path.join(
  root,
  "src/lib/choreocore/lightingSync/corpus/shows.ts"
);

const csvDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.env.HOME || "", "Downloads");

function nf(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTime(t) {
  const s = nf(t);
  if (!s || s === "~") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function slug(s) {
  return (
    nf(s)
      .replace(/[^\w\u3040-\u30ff\u4e00-\u9fff]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "show"
  );
}

function inferFromNote(note, progress, isFirst, isLast) {
  const n = nf(note).toLowerCase();
  const tags = [];
  let colorMood = "neutral";
  let lightingPreset = "guide_mono";
  let inferredSection = "verse";

  if (/ピン|pin/.test(n)) tags.push("pin_spot");
  if (/サス/.test(n)) tags.push("sus");
  if (/\bss\b|ｓｓ|ss/.test(n) || /SS/.test(note)) tags.push("ss");
  if (/ソロ|solo/.test(n)) tags.push("solo");
  if (/センター|真ん中|ヘソ|へそ/.test(n)) tags.push("center");
  if (/グループ/.test(n)) tags.push("group");
  if (/ムービング|点滅|ストロボ/.test(n)) tags.push("motion");
  if (/バックライト/.test(n)) tags.push("backlight");
  if (/おまかせ|自由/.test(n)) tags.push("free");
  if (/暗|落と|余韻|フェード|緞帳/.test(n)) tags.push("dim");
  if (/明る|賑やか|カラフル|元気|盛り上が/.test(n)) tags.push("bright");
  if (/選抜|フィーチャー|紹介/.test(n)) tags.push("feature");
  if (/間奏/.test(n)) tags.push("interlude");
  if (/ビルド|だんだん盛り上が|勢い/.test(n)) tags.push("buildup");
  if (/エンディング|ラスト|終わり|ポーズ/.test(n)) tags.push("ending");

  if (/赤/.test(n)) {
    colorMood = "red";
    tags.push("red");
  } else if (/青|ブルー/.test(n)) {
    colorMood = "blue";
    tags.push("blue");
  } else if (/黄|オレンジ/.test(n)) {
    colorMood = "yellow";
    tags.push("yellow");
  } else if (/紫|ピンク/.test(n)) {
    colorMood = "purple";
    tags.push("purple");
  } else if (/緑/.test(n)) {
    colorMood = "green";
    tags.push("green");
  } else if (/白|素明/.test(n)) {
    colorMood = "white";
    tags.push("white");
  } else if (/カラフル|混ぜ|混色|赤、黄|青、緑|黄と赤|黄と紫/.test(n)) {
    colorMood = "colorful";
    tags.push("colorful");
  } else if (/暗/.test(n)) {
    colorMood = "dim";
  }

  if (isFirst || /イントロ|スタート|始まり/.test(n)) {
    inferredSection = "intro";
    tags.push("intro");
  } else if (
    isLast ||
    /ラスト|エンディング|終わり|余韻|緞帳|キャノン|ジャンプ/.test(n)
  ) {
    inferredSection = "outro";
    tags.push("outro");
  } else if (/サビ/.test(n)) {
    inferredSection = "chorus";
    tags.push("chorus");
  } else if (/ドロップ|盛り上が|点滅|ストロボ|激しく/.test(n)) {
    inferredSection = "drop";
  } else if (/ソロ|ピンスポ|選抜|紹介|グループダンス|サス.*エイト/.test(n)) {
    inferredSection = "se_trigger";
  } else if (
    /間奏|Aメロ|Bメロ|２番|2番|２曲目イントロ|2曲目イントロ/.test(n)
  ) {
    inferredSection = "verse";
  } else if (progress > 0.88) {
    inferredSection = "outro";
  } else if (progress < 0.1) {
    inferredSection = "intro";
  }

  if (
    tags.includes("pin_spot") ||
    (tags.includes("ss") && inferredSection === "intro")
  ) {
    lightingPreset = "pin_spot_dark";
  } else if (
    inferredSection === "chorus" ||
    (tags.includes("bright") && colorMood === "colorful")
  ) {
    lightingPreset = "full_bright_warm";
  } else if (
    inferredSection === "drop" ||
    tags.includes("motion") ||
    tags.includes("buildup")
  ) {
    lightingPreset = "strobe_flash";
  } else if (inferredSection === "se_trigger" || tags.includes("feature")) {
    lightingPreset = tags.includes("pin_spot")
      ? "pin_spot_dark"
      : "color_switch";
  } else if (
    inferredSection === "outro" ||
    tags.includes("dim") ||
    tags.includes("ending")
  ) {
    lightingPreset = /明る|カラフル|賑やか/.test(n)
      ? "full_bright_warm"
      : "fade_spot";
  } else if (colorMood === "colorful" || colorMood === "mixed") {
    lightingPreset = "color_switch";
  } else {
    lightingPreset = "guide_mono";
  }

  if (/暗くする|映像のため暗/.test(n)) {
    lightingPreset = "pin_spot_dark";
    colorMood = "dim";
    tags.push("dim");
  }

  return {
    inferredSection,
    lightingPreset,
    colorMood,
    tags: [...new Set(tags)],
  };
}

function parseCsvFile(filePath, basename, opts = {}) {
  const raw = fs.readFileSync(filePath, "utf8");
  const flat = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i];
    if (ch === '"') {
      inQ = !inQ;
      buf += ch;
      continue;
    }
    if (ch === "\n" && !inQ) {
      lines.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf) lines.push(buf);

  const rows = lines.map((l) =>
    l.split(",").map((c) => nf(c.replace(/^"|"$/g, "").replace(/\n/g, " ")))
  );

  let className = "";
  let trackTitle = "";
  let atmosphere = "";
  let points = "";
  let durationSec = 180;
  let dancerCount = 0;
  let pinSpot = false;
  const event = opts.event || "第19回 S.O.P発表会";

  const joined = rows.map((r) => r.join("|")).join("\n");
  if (/ピンスポ\s*あり/.test(joined)) pinSpot = true;
  if (/ピンスポ\s*なし/.test(joined)) pinSpot = false;

  for (const r of rows) {
    const a0 = r[0] || "";
    const a1 = r[1] || "";
    if (/クラス|ｸﾗｽ|名/.test(a0) && a1) className = a1;
    if (/TIME/.test(r.join(","))) {
      for (let i = 0; i < r.length; i++) {
        const pt = parseTime(r[i]);
        if (pt != null && pt > 30 && pt < 3600) {
          durationSec = pt;
          break;
        }
      }
      const nIdx = r.findIndex((c) => c === "人数" || /人数/.test(c));
      if (nIdx >= 0) {
        const num = nf(r[nIdx + 1] || r[nIdx]).replace(/[^\d]/g, "");
        if (num) dancerCount = Number(num);
      }
      const people = r.join(" ").match(/人数\s*[：:]?\s*(\d+)/);
      if (people) dancerCount = Number(people[1]);
    }
    if (/使用曲/.test(a0) && a1) trackTitle = a1;
    if (/全体の雰囲気|雰囲気/.test(a0) && a1 && !atmosphere) atmosphere = a1;
    if (/ポイント/.test(a0) && a1) points = a1;
  }

  if (!className) {
    const m = basename.match(/照明プラン - (.+)\.csv$/);
    className = m ? m[1] : basename;
  }
  if (!trackTitle) trackTitle = className;

  const cuesRaw = [];
  for (const r of rows) {
    const no = nf(r[0]).replace(/[^\d]/g, "");
    if (!no || Number(no) < 1 || Number(no) > 40) continue;
    if (/番号/.test(r.join(","))) continue;
    const start = parseTime(r[1]);
    let end = parseTime(r[3]);
    if (end == null) end = parseTime(r[2]);
    let note = r[5] || r[4] || r[6] || "";
    if (/フォーメーション|照明/.test(note) && note.length < 20) note = r[5] || "";
    note = nf(note);
    if (!note) continue;
    cuesRaw.push({
      cueNo: Number(no),
      startSec: start ?? null,
      endSec: end ?? null,
      note,
    });
  }

  let maxT = durationSec;
  for (const c of cuesRaw) {
    if (c.endSec != null) maxT = Math.max(maxT, c.endSec);
    if (c.startSec != null) maxT = Math.max(maxT, c.startSec);
  }
  durationSec = Math.max(durationSec, maxT);

  let lastEnd = 0;
  const cues = [];
  for (let i = 0; i < cuesRaw.length; i++) {
    const c = cuesRaw[i];
    let start = c.startSec;
    if (start == null) start = lastEnd;
    let end = c.endSec;
    if (end == null) {
      const next = cuesRaw[i + 1];
      end = next?.startSec ?? Math.min(durationSec, start + 15);
    }
    if (end < start) end = start + 5;
    lastEnd = end;
    const progressStart = start / durationSec;
    const progressEnd = Math.min(1, end / durationSec);
    const mid = (progressStart + progressEnd) / 2;
    const inferred = inferFromNote(
      c.note,
      mid,
      i === 0,
      i === cuesRaw.length - 1
    );
    cues.push({
      cueNo: c.cueNo,
      startSec: Math.round(start * 10) / 10,
      endSec: Math.round(end * 10) / 10,
      progressStart: Math.round(progressStart * 10000) / 10000,
      progressEnd: Math.round(progressEnd * 10000) / 10000,
      note: c.note,
      ...inferred,
    });
  }

  const idBase = opts.id || `2025_19th_${slug(className)}`.toLowerCase();
  const destName = opts.destName || `2025-19th-${slug(className)}.csv`;
  fs.mkdirSync(OUT_DATA, { recursive: true });
  if (!opts.skipCopy) {
    fs.copyFileSync(filePath, path.join(OUT_DATA, destName));
  }

  return {
    id: idBase,
    title: opts.title || className,
    event,
    className: opts.className || className,
    trackTitle: opts.trackTitle || trackTitle,
    durationSec: Math.round(durationSec),
    dancerCount: dancerCount || cues.length,
    atmosphere,
    points,
    pinSpot,
    sourceFile: `data/lighting-plans/${destName}`,
    cues,
  };
}

const files = fs
  .readdirSync(csvDir)
  .filter((f) => f.includes("19回発表会照明") && f.endsWith(".csv"))
  .sort();

if (files.length === 0) {
  console.error("No lighting plan CSVs found in", csvDir);
  process.exit(1);
}

const shows = files.map((f) => parseCsvFile(path.join(csvDir, f), f));

const miniPath = path.join(
  OUT_DATA,
  "2023-mini-recital-am12-birthday-TIME.csv"
);
if (fs.existsSync(miniPath)) {
  const tmp = path.join(OUT_DATA, "_mini_norm.csv");
  const lines = fs
    .readFileSync(miniPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/^,/, ""));
  fs.writeFileSync(tmp, lines.join("\n"));
  const m = parseCsvFile(tmp, "ミニ発表会 - am12.csv", {
    skipCopy: true,
    destName: "2023-mini-recital-am12-birthday-TIME.csv",
    id: "2023_mini_am12_birthday_time",
    title: "月曜8時HIPHOPマスター birthday & TIME",
    event: "2023年 第1回 S.O.Pミニ発表会",
    className: "月曜8時ＨＩＰＨＯＰマスタークラス",
    trackTitle: "birthday & TIME",
  });
  shows.push(m);
  fs.unlinkSync(tmp);
}

const ts = `/**
 * 実演会照明プラン蓄積データ（自動生成）
 * 生成: node scripts/ingest-lighting-plans.mjs
 * 元CSV: data/lighting-plans/
 */

import type { LightingPlanShow } from "./types";

export const LIGHTING_PLAN_SHOWS: LightingPlanShow[] = ${JSON.stringify(
  shows,
  null,
  2
)};
`;

fs.writeFileSync(OUT_TS, ts);
console.log("Wrote", OUT_TS);
console.log(
  shows
    .map((s) => `${s.id}: ${s.cues.length} cues / ${s.durationSec}s / ${s.trackTitle}`)
    .join("\n")
);
console.log(
  "Total shows:",
  shows.length,
  "cues:",
  shows.reduce((a, s) => a + s.cues.length, 0)
);
