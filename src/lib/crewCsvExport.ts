/**
 * 名簿（Crew）をスプレッドシート（CSV / XLSX）へ書き出す。
 * 列見出しは `crewCsvImport` が認識するキーに合わせ、スキル等のアプリ内編集を再編集できる。
 */
import type { Crew, CrewMember } from "../types/choreography";
import { downloadBlob } from "./downloadBlob";
import { downloadTextFile } from "./shareProjectLinks";

/** 取り込み側が認識する見出し（日本語）。再インポートでスキル・性別・メモも復元できる */
export const ROSTER_EXPORT_HEADERS = [
  "名簿",
  "名前",
  "色",
  "身長",
  "学年",
  "性別",
  "スキルランク",
  "メモ",
] as const;

export type RosterExportRow = string[];

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function safeFileBase(name: string): string {
  const t = (name || "roster").trim() || "roster";
  return (
    t
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 48) || "roster"
  );
}

function memberToCells(crewName: string, m: CrewMember): RosterExportRow {
  return [
    crewName,
    (m.label ?? "").trim(),
    String(Math.floor(m.colorIndex ?? 0)),
    typeof m.heightCm === "number" && Number.isFinite(m.heightCm)
      ? String(m.heightCm)
      : "",
    (m.gradeLabel ?? "").trim(),
    (m.genderLabel ?? "").trim(),
    (m.skillRankLabel ?? "").trim(),
    (m.note ?? "").trim(),
  ];
}

/** 1 名簿 → 見出しなしのデータ行 */
export function crewToExportDataRows(crew: Crew): RosterExportRow[] {
  const crewName = (crew.name || "名簿").trim() || "名簿";
  return crew.members.map((m) => memberToCells(crewName, m));
}

/** 複数名簿 → 見出し付きの全行（空名簿はスキップ） */
export function crewsToExportRows(crews: Crew[]): RosterExportRow[] {
  const data: RosterExportRow[] = [];
  for (const crew of crews) {
    if (!crew.members.length) continue;
    data.push(...crewToExportDataRows(crew));
  }
  return [[...ROSTER_EXPORT_HEADERS], ...data];
}

export function countExportableRosterMembers(crews: Crew[]): number {
  return crews.reduce((n, c) => n + (c.members?.length ?? 0), 0);
}

/** UTF-8 CSV 本文（BOM なし。ダウンロード時に付与） */
export function buildRosterCsv(crews: Crew[]): string {
  const rows = crewsToExportRows(crews);
  return rows.map((r) => r.map((c) => csvCell(c)).join(",")).join("\r\n") + "\r\n";
}

export function downloadRosterCsv(
  crews: Crew[],
  opts?: { pieceTitle?: string; crewName?: string }
): void {
  const base = safeFileBase(
    opts?.crewName || opts?.pieceTitle || "名簿"
  );
  downloadTextFile(
    `${base}-roster.csv`,
    `\uFEFF${buildRosterCsv(crews)}`,
    "text/csv;charset=utf-8"
  );
}

/** Excel / Google スプレッドシート向け XLSX（動的 import） */
export async function downloadRosterXlsx(
  crews: Crew[],
  opts?: { pieceTitle?: string; crewName?: string }
): Promise<void> {
  const rows = crewsToExportRows(crews);
  if (rows.length <= 1) {
    throw new Error("書き出す名簿メンバーがありません");
  }
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "名簿");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  const base = safeFileBase(
    opts?.crewName || opts?.pieceTitle || "名簿"
  );
  downloadBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${base}-roster.xlsx`
  );
}
