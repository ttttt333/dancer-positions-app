import type { ChoreographyProjectJson } from "../types/choreography";
import { safeVideoBaseName } from "./shareVideoFile";

/** 書き出し名として使わない汎用ラベル */
const GENERIC_EXPORT_LABELS = new Set([
  "無題の作品",
  "Untitled project",
  "제목 없는 작품",
  "未命名作品",
  "formation",
  "choreogrid",
  "stage",
  "work",
]);

function isGenericExportLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (GENERIC_EXPORT_LABELS.has(t)) return true;
  if (/^無題/.test(t)) return true;
  if (/^untitled\b/i.test(t)) return true;
  return false;
}

export function videoExportDateStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * 動画の保存・共有用ベース名（拡張子なし）。
 * 作品名 → クラウド作品名 → 日付付き ChoreoCore 名の順で決める。
 */
export function resolveVideoExportFileName(
  project: ChoreographyProjectJson,
  projectName?: string | null
): string {
  const candidates = [
    project.pieceTitle?.trim(),
    projectName?.trim(),
  ].filter((x): x is string => Boolean(x && !isGenericExportLabel(x)));

  const title = candidates[0];
  if (title) {
    return `${safeVideoBaseName(title)}-choreo`;
  }
  return `ChoreoCore-choreo-${videoExportDateStamp()}`;
}

/** 共有シートのタイトル用（ファイル名ベース名から表示用に） */
export function videoExportDisplayTitle(baseName: string): string {
  const stripped = baseName.replace(/-choreo$/i, "").replace(/_/g, " ").trim();
  return stripped || "ステージ動画";
}
