/**
 * 照明プランだけの保存。
 * 作品 JSON とは別に、名前付きの控えと JSON ファイルとして持つ。
 * 呼び出したときに変えるのは照明表と照明文だけで、立ち位置の時刻や隊形は触らない。
 */

import type { ChoreographyProjectJson, LightingPlan } from "../types/choreography";
import { sortCuesByStart } from "./cueInterval";
import { compactLightingPlan } from "./lightingPlan";
import { normalizeLightingTextMarks, type LightingTextMark } from "./lightingText";

export const LIGHTING_PLAN_FILE_FORMAT = "choreocore-lighting-plan-v1" as const;
export const LIGHTING_PLAN_FILES_STORAGE_KEY = "choreogrid_lighting_plan_files_v1";

const MAX_NAME = 120;
const MAX_ITEMS = 40;
const TEXT_MAX = 2000;

export type LightingPlanFileCue = {
  id: string;
  /** 保存したときの立ち位置キューの開始。照合の補助で、読み込み時には書き戻さない */
  tStartSec: number;
  lightingRequest?: string;
  lightingRequestMarks?: LightingTextMark[];
};

export type LightingPlanFile = {
  format: typeof LIGHTING_PLAN_FILE_FORMAT;
  name: string;
  savedAt: string;
  plan: LightingPlan;
  cues: LightingPlanFileCue[];
};

export type LightingPlanLibraryItem = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  file: LightingPlanFile;
};

export type LightingPlanApplyResult = {
  project: ChoreographyProjectJson;
  matchedById: number;
  matchedByOrder: number;
  unmatchedCurrent: number;
  unmatchedSaved: number;
};

export type LightingPlanLibrarySaveResult =
  | { ok: true; item: LightingPlanLibraryItem }
  | { ok: false; message: string };

function clipName(name: string): string {
  const text = name.trim().slice(0, MAX_NAME);
  return text || "照明プラン";
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function captureLightingPlanFile(
  project: ChoreographyProjectJson,
  name: string
): LightingPlanFile {
  const cues = sortCuesByStart(project.cues).map((cue) => {
    const lightingRequest = cue.lightingRequest?.slice(0, TEXT_MAX);
    const marks = normalizeLightingTextMarks(cue.lightingRequestMarks, lightingRequest?.length ?? 0);
    return {
      id: cue.id,
      tStartSec: cue.tStartSec,
      ...(lightingRequest ? { lightingRequest } : {}),
      ...(marks ? { lightingRequestMarks: marks } : {}),
    };
  });
  return {
    format: LIGHTING_PLAN_FILE_FORMAT,
    name: clipName(name),
    savedAt: new Date().toISOString(),
    plan: compactLightingPlan(project.lightingPlan) ?? {},
    cues,
  };
}

function parseCue(raw: unknown): LightingPlanFileCue | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim().slice(0, 80) : "";
  if (!id) return null;
  const tStartSec =
    typeof row.tStartSec === "number" && Number.isFinite(row.tStartSec) ? row.tStartSec : 0;
  const lightingRequest =
    typeof row.lightingRequest === "string" ? row.lightingRequest.slice(0, TEXT_MAX) : undefined;
  const marks = normalizeLightingTextMarks(row.lightingRequestMarks, lightingRequest?.length ?? 0);
  return {
    id,
    tStartSec,
    ...(lightingRequest?.trim() ? { lightingRequest } : {}),
    ...(marks ? { lightingRequestMarks: marks } : {}),
  };
}

export function parseLightingPlanFile(raw: unknown): LightingPlanFile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.format !== LIGHTING_PLAN_FILE_FORMAT) return null;
  const cues = Array.isArray(row.cues)
    ? row.cues.map(parseCue).filter((cue): cue is LightingPlanFileCue => cue != null).slice(0, 200)
    : [];
  const plan = compactLightingPlan(
    row.plan && typeof row.plan === "object" ? (row.plan as Partial<LightingPlan>) : undefined
  );
  return {
    format: LIGHTING_PLAN_FILE_FORMAT,
    name: clipName(typeof row.name === "string" ? row.name : ""),
    savedAt: typeof row.savedAt === "string" ? row.savedAt.slice(0, 40) : "",
    plan: plan ?? {},
    cues,
  };
}

function remapRecord<T>(
  record: Record<string, T> | undefined,
  savedToCurrent: Map<string, string>
): Record<string, T> | undefined {
  if (!record) return undefined;
  const out: Record<string, T> = {};
  for (const [savedId, value] of Object.entries(record)) {
    const currentId = savedToCurrent.get(savedId);
    if (currentId && out[currentId] == null) out[currentId] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 開いている作品の照明表へ、保存ファイルの中身だけを載せる */
export function applyLightingPlanFile(
  project: ChoreographyProjectJson,
  file: LightingPlanFile
): LightingPlanApplyResult {
  const current = sortCuesByStart(project.cues);
  const saved = file.cues;
  const usedSaved = new Set<number>();
  const savedToCurrent = new Map<string, string>();
  let matchedById = 0;
  let matchedByOrder = 0;

  current.forEach((cue) => {
    const index = saved.findIndex((item, itemIndex) => item.id === cue.id && !usedSaved.has(itemIndex));
    if (index < 0) return;
    usedSaved.add(index);
    savedToCurrent.set(saved[index]!.id, cue.id);
    matchedById += 1;
  });

  const leftoverCurrent = current.filter((cue) => ![...savedToCurrent.values()].includes(cue.id));
  const leftoverSaved = saved.filter((_, index) => !usedSaved.has(index));
  const pairCount = Math.min(leftoverCurrent.length, leftoverSaved.length);
  for (let i = 0; i < pairCount; i++) {
    const savedCue = leftoverSaved[i];
    const currentCue = leftoverCurrent[i];
    if (!savedCue || !currentCue) continue;
    savedToCurrent.set(savedCue.id, currentCue.id);
    matchedByOrder += 1;
  }

  const savedByCurrent = new Map<string, LightingPlanFileCue>();
  for (const [savedId, currentId] of savedToCurrent) {
    const cue = saved.find((item) => item.id === savedId);
    if (cue) savedByCurrent.set(currentId, cue);
  }

  const cues = project.cues.map((cue) => {
    const incoming = savedByCurrent.get(cue.id);
    if (!incoming) return cue;
    const next = { ...cue };
    const text = incoming.lightingRequest?.slice(0, TEXT_MAX);
    const marks = normalizeLightingTextMarks(incoming.lightingRequestMarks, text?.length ?? 0);
    if (text?.trim()) next.lightingRequest = text;
    else delete next.lightingRequest;
    if (marks) next.lightingRequestMarks = marks;
    else delete next.lightingRequestMarks;
    return next;
  });

  const omitted = file.plan.omittedCueIds
    ?.map((id) => savedToCurrent.get(id))
    .filter((id): id is string => Boolean(id));
  const plan = compactLightingPlan({
    ...file.plan,
    cueTimes: remapRecord(file.plan.cueTimes, savedToCurrent),
    omittedCueIds: omitted && omitted.length > 0 ? omitted : undefined,
    rowHeights: remapRecord(file.plan.rowHeights, savedToCurrent),
  });

  return {
    project: { ...project, cues, lightingPlan: plan },
    matchedById,
    matchedByOrder,
    unmatchedCurrent: current.length - matchedById - matchedByOrder,
    unmatchedSaved: saved.length - matchedById - matchedByOrder,
  };
}

export function lightingPlanRecallMessage(name: string, result: LightingPlanApplyResult): string {
  if (result.matchedByOrder === 0 && result.unmatchedSaved === 0 && result.unmatchedCurrent === 0) {
    return `「${name}」を呼び出しました。`;
  }
  if (result.matchedById === 0) {
    return `「${name}」を、キューの並び順で ${result.matchedByOrder} 件合わせました。立ち位置の時刻はそのままです。`;
  }
  return `「${name}」を呼び出しました。同じキュー ${result.matchedById} 件に加え、並び順で ${result.matchedByOrder} 件を合わせました。立ち位置の時刻はそのままです。`;
}

function readLibrary(): LightingPlanLibraryItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIGHTING_PLAN_FILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: LightingPlanLibraryItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const file = parseLightingPlanFile(row.file);
      const id = typeof row.id === "string" ? row.id.trim().slice(0, 80) : "";
      if (!file || !id) continue;
      const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
      const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : createdAt;
      items.push({
        id,
        name: clipName(typeof row.name === "string" ? row.name : file.name),
        createdAt,
        updatedAt,
        file,
      });
      if (items.length >= MAX_ITEMS) break;
    }
    return items;
  } catch {
    return [];
  }
}

function writeLibrary(items: LightingPlanLibraryItem[]): LightingPlanLibrarySaveResult | null {
  if (typeof localStorage === "undefined") {
    return { ok: false, message: "この環境では照明プランを保存できません。" };
  }
  try {
    localStorage.setItem(LIGHTING_PLAN_FILES_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    return null;
  } catch {
    return {
      ok: false,
      message: "保存容量がいっぱいです。古い照明プランを削除して、もう一度保存してください。",
    };
  }
}

export function listLightingPlanLibrary(): LightingPlanLibraryItem[] {
  return readLibrary().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveLightingPlanLibraryItem(
  name: string,
  file: LightingPlanFile
): LightingPlanLibrarySaveResult {
  const items = readLibrary();
  const now = Date.now();
  const item: LightingPlanLibraryItem = {
    id: newId(),
    name: clipName(name),
    createdAt: now,
    updatedAt: now,
    file: { ...file, name: clipName(name), savedAt: new Date(now).toISOString() },
  };
  const error = writeLibrary([item, ...items]);
  if (error) return error;
  return { ok: true, item };
}

export function overwriteLightingPlanLibraryItem(
  id: string,
  file: LightingPlanFile
): LightingPlanLibrarySaveResult {
  const items = readLibrary();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { ok: false, message: "上書きする照明プランが見つかりません。" };
  const current = items[index]!;
  const now = Date.now();
  const next: LightingPlanLibraryItem = {
    ...current,
    name: file.name || current.name,
    updatedAt: now,
    file: { ...file, name: file.name || current.name, savedAt: new Date(now).toISOString() },
  };
  const copy = items.slice();
  copy[index] = next;
  const error = writeLibrary(copy);
  if (error) return error;
  return { ok: true, item: next };
}

export function deleteLightingPlanLibraryItem(id: string): void {
  writeLibrary(readLibrary().filter((item) => item.id !== id));
}

export function lightingPlanFileJson(file: LightingPlanFile): string {
  return JSON.stringify(file, null, 2);
}

export function safeLightingPlanFileName(name: string): string {
  return (
    clipName(name).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 60) ||
    "照明プラン"
  );
}
