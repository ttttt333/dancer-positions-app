/**
 * 名簿（Crew）の CSV / Google スプレッドシート取り込みヘルパー。
 * - ローカル CSV（カンマ・タブ・セミコロン区切り、UTF-8/BOM 可）
 * - Google スプレッドシートの URL（公開ビュー / 共有リンク / 公開公開リンクのいずれか）
 *
 * Google 取り込みは「リンクを知っている人は閲覧可」または「ウェブに公開」されたシートが対象。
 * ブラウザから直接 fetch するため CORS の関係で、共有設定が不足しているとネットワークエラーになる。
 */
import type { Crew, CrewMember } from "../types/choreography";
import { parseCsvToRows } from "./projectExportFormats";

const NAME_HEADER_KEYS = [
  "name",
  "label",
  "member",
  "membername",
  "memberlabel",
  "displayname",
  "名前",
  "氏名",
  "メンバー",
  "メンバー名",
  "ニックネーム",
  "表示名",
];

const COLOR_HEADER_KEYS = [
  "color",
  "colorindex",
  "colour",
  "colourindex",
  "色",
  "カラー",
];

const MEMBER_LABEL_MAX = 8;

function normalizeHeader(s: string): string {
  return s
    .replace(/\uFEFF/g, "")
    .replace(/[\s_\-/.()（）\[\]【】]/g, "")
    .toLowerCase();
}

function smartSplitFallback(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  return lines.map((l) => {
    if (l.includes("\t")) return l.split("\t").map((c) => c.trim());
    if (l.includes(";")) return l.split(";").map((c) => c.trim());
    if (l.includes(",")) return l.split(",").map((c) => c.trim());
    return [l.trim()];
  });
}

function dedupeRowsToMembers(rows: string[][]): CrewMember[] {
  if (rows.length === 0) return [];

  let nameIdx = 0;
  let colorIdx = -1;
  let dataStart = 0;

  const headerNorm = rows[0].map(normalizeHeader);
  const looksLikeHeader = headerNorm.some(
    (h) => NAME_HEADER_KEYS.includes(h) || COLOR_HEADER_KEYS.includes(h)
  );
  if (looksLikeHeader) {
    const ni = headerNorm.findIndex((h) => NAME_HEADER_KEYS.includes(h));
    const ci = headerNorm.findIndex((h) => COLOR_HEADER_KEYS.includes(h));
    if (ni >= 0) nameIdx = ni;
    if (ci >= 0) colorIdx = ci;
    dataStart = 1;
  }

  const out: CrewMember[] = [];
  const seen = new Set<string>();
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const rawName = (row[nameIdx] ?? "").trim();
    if (!rawName) continue;
    const label = rawName.slice(0, MEMBER_LABEL_MAX);
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    let colorIndex = out.length % 9;
    if (colorIdx >= 0) {
      const n = parseInt((row[colorIdx] ?? "").trim(), 10);
      if (Number.isFinite(n)) colorIndex = ((n % 9) + 9) % 9;
    }
    out.push({
      id: crypto.randomUUID(),
      label,
      colorIndex,
    });
  }
  return out;
}

/** CSV / TSV テキストから名簿メンバー配列を作る（ヘッダ自動検出） */
export function parseCrewMembersFromCsv(text: string): CrewMember[] {
  let rows = parseCsvToRows(text);
  if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1)) {
    rows = smartSplitFallback(text);
  }
  return dedupeRowsToMembers(rows);
}

/** 入力された名前と CSV テキストから新しい Crew を作る（id は生成、最大 80 人で打ち切り） */
export function buildCrewFromCsv(name: string, csvText: string): Crew {
  const members = parseCrewMembersFromCsv(csvText).slice(0, 80);
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60) || "新しい名簿",
    members,
  };
}

/**
 * Google スプレッドシートの URL を CSV エクスポート URL に変換する。
 * - 編集 URL: /spreadsheets/d/<id>/edit#gid=<gid> → /export?format=csv&gid=<gid>
 * - 共有 URL: /spreadsheets/d/<id>/...?gid=<gid>  → /export?format=csv&gid=<gid>
 * - 公開 URL: /spreadsheets/d/e/<pubid>/pubhtml?gid=<gid> → /pub?gid=<gid>&single=true&output=csv
 * - 既に export?format=csv のものはそのまま
 * - すでに /pub?...&output=csv のものはそのまま
 */
export function googleSheetsUrlToCsvUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!/(^|\.)google\.com$/.test(u.hostname)) return raw;
  if (!u.pathname.includes("/spreadsheets/")) return raw;

  const params = u.searchParams;
  const gidFromHash = (() => {
    const h = u.hash || "";
    const m = h.match(/gid=([0-9]+)/);
    return m?.[1] ?? null;
  })();
  const gid = params.get("gid") ?? gidFromHash ?? "0";

  const pubMatch = u.pathname.match(/\/spreadsheets\/d\/e\/([^/]+)\//);
  if (pubMatch) {
    if (
      params.get("output") === "csv" &&
      (u.pathname.endsWith("/pub") || u.pathname.includes("/pub"))
    ) {
      return u.toString();
    }
    const pub = new URL(`https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub`);
    pub.searchParams.set("gid", gid);
    pub.searchParams.set("single", "true");
    pub.searchParams.set("output", "csv");
    return pub.toString();
  }

  const editMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (editMatch) {
    if (u.pathname.endsWith("/export") && params.get("format") === "csv") {
      return u.toString();
    }
    const exp = new URL(
      `https://docs.google.com/spreadsheets/d/${editMatch[1]}/export`
    );
    exp.searchParams.set("format", "csv");
    exp.searchParams.set("gid", gid);
    return exp.toString();
  }
  return raw;
}

/**
 * Google スプレッドシートの URL から CSV テキストを取得する。
 * 共有設定が「リンクを知っている人は閲覧可」または「ウェブに公開」になっている必要がある。
 */
export async function fetchCsvFromGoogleSheetsUrl(
  rawUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const url = googleSheetsUrlToCsvUrl(rawUrl);
  if (!url) throw new Error("URL が空です");
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal,
    credentials: "omit",
  });
  if (!res.ok) {
    throw new Error(
      `スプレッドシートを取得できませんでした（HTTP ${res.status}）。` +
        `共有設定で「リンクを知っている人は閲覧可」または「ウェブに公開」になっているかご確認ください。`
    );
  }
  const text = await res.text();
  if (text.trim().toLowerCase().startsWith("<!doctype html") ||
      text.trim().toLowerCase().startsWith("<html")) {
    throw new Error(
      "CSV ではなくログイン画面が返ってきました。スプレッドシートの共有設定をご確認ください。"
    );
  }
  return text;
}
