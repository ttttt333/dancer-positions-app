/**
 * AI 解析セクション頭 → フォーメーション切替キュー（キーフレーム）生成。
 */

import type {
  ChoreographyProjectJson,
  Cue,
  Formation,
} from "../../types/choreography";
import type { MusicSection } from "../../types/audioAnalysis";
import { cloneFormationForNewCue, MIN_CUE_DURATION_SEC } from "../cueInterval";
import { formatMmSs } from "../timeFormat";

export type AutoKeyframeSlice = {
  formations: Formation[];
  cues: Cue[];
};

export type GenerateAutoKeyframesInput = {
  sections: MusicSection[];
  seedFormation: Formation;
  durationSec: number;
  /** 互換用（生成には未使用） */
  existingKeyframes?: Cue[];
  trimStartSec?: number;
  trimEndSec?: number | null;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * セクション配列からキュー＋フォーメーションを生成する純粋関数。
 * - 先頭 0s にセクションが無ければ intro 相当の開始キューを足す
 * - 各セクション startTime → 次開始（または endTime / duration）まで
 */
export function generateAutoKeyframes(
  input: GenerateAutoKeyframesInput
): AutoKeyframeSlice {
  const duration = Math.max(0, input.durationSec);
  const trimLo = Number.isFinite(input.trimStartSec)
    ? Math.max(0, input.trimStartSec!)
    : 0;
  const trimHi =
    input.trimEndSec != null && Number.isFinite(input.trimEndSec)
      ? Math.min(duration || input.trimEndSec, input.trimEndSec)
      : duration > 0
        ? duration
        : Math.max(trimLo + MIN_CUE_DURATION_SEC, 60);

  const sorted = [...input.sections]
    .filter(
      (s) =>
        Number.isFinite(s.startTime) &&
        Number.isFinite(s.endTime) &&
        s.endTime > s.startTime
    )
    .sort((a, b) => a.startTime - b.startTime);

  type Span = { start: number; end: number; label: string };
  const spans: Span[] = [];

  if (sorted.length === 0) {
    spans.push({
      start: trimLo,
      end: Math.max(trimLo + MIN_CUE_DURATION_SEC, trimHi),
      label: "開始",
    });
  } else {
    const first = sorted[0]!;
    if (first.startTime > trimLo + 0.35) {
      spans.push({
        start: trimLo,
        end: Math.min(trimHi, first.startTime),
        label: "開始",
      });
    }
    for (let i = 0; i < sorted.length; i += 1) {
      const s = sorted[i]!;
      const next = sorted[i + 1];
      const start = Math.max(trimLo, s.startTime);
      const end = Math.min(
        trimHi,
        next ? next.startTime : Math.max(s.endTime, start + MIN_CUE_DURATION_SEC)
      );
      if (end - start < MIN_CUE_DURATION_SEC - 1e-9) continue;
      spans.push({ start, end, label: s.label || "セクション" });
    }
  }

  // 重なり・短尺を掃除
  const cleaned: Span[] = [];
  for (const span of spans) {
    let start = round2(span.start);
    let end = round2(span.end);
    if (cleaned.length > 0) {
      const prev = cleaned[cleaned.length - 1]!;
      if (start < prev.end) start = prev.end;
    }
    if (end <= start + MIN_CUE_DURATION_SEC - 1e-9) {
      end = round2(start + MIN_CUE_DURATION_SEC);
    }
    if (end > trimHi) {
      end = trimHi;
      if (end - start < MIN_CUE_DURATION_SEC - 1e-9) continue;
    }
    cleaned.push({ ...span, start, end });
  }

  const formations: Formation[] = [];
  const cues: Cue[] = [];

  for (const span of cleaned.slice(0, 40)) {
    const fm = cloneFormationForNewCue(input.seedFormation);
    fm.name = span.label;
    formations.push(fm);
    cues.push({
      id: newId(),
      tStartSec: span.start,
      tEndSec: span.end,
      formationId: fm.id,
      name: `${span.label} (${formatMmSs(span.start)})`,
      note: "AIセクション頭キーフレーム",
    });
  }

  return { formations, cues };
}

/**
 * 新規・ほぼ空のタイムラインなら自動適用してよい。
 * キューが2本以上ある＝ユーザーが構成を触っている可能性が高い。
 */
export function projectAllowsSilentAutoKeyframes(
  project: ChoreographyProjectJson
): boolean {
  if (project.viewMode === "view") return false;
  return project.cues.length <= 1;
}

/** セクション頭キーフレームをプロジェクトへ反映（既存キューは置換） */
export function applySectionKeyframesToProject(
  prev: ChoreographyProjectJson,
  slice: AutoKeyframeSlice
): ChoreographyProjectJson {
  if (slice.cues.length === 0 || slice.formations.length === 0) return prev;

  const oldCueFormIds = new Set(prev.cues.map((c) => c.formationId));
  const keptFormations = prev.formations.filter(
    (f) => !oldCueFormIds.has(f.id)
  );

  return {
    ...prev,
    formations: [...keptFormations, ...slice.formations],
    cues: slice.cues,
    activeFormationId:
      slice.formations[0]?.id ?? prev.activeFormationId,
  };
}
