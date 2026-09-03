/**
 * エディタの作品 JSON を、実曲注釈セッションへ変換する。
 * 人の対応はダンサー id（layout.positions[].id）のまま。
 */

import { sortCuesByStart } from "../../cueInterval";
import { createAnnotationSession } from "../engine/annotation/AnnotationSession";
import type { AnnotationSession } from "../engine/types/AnnotationTypes";
import type {
  HumanCueAnnotation,
  HumanFormationRating,
  HumanSectionAnnotation,
} from "../engine/types/EvaluationTypes";
import type { MusicSectionType } from "../engine/types/MusicTypes";
import type {
  ChoreographyProjectJson,
  Cue,
  DancerSpot,
  Formation,
} from "../../../types/choreography";

const TYPE_FROM_NAME: Array<[string, string]> = [
  ["広いV字", "WIDE_V"],
  ["広いV", "WIDE_V"],
  ["WIDE_V", "WIDE_V"],
  ["二重斜め", "DOUBLE_DIAGONAL"],
  ["DOUBLE_DIAGONAL", "DOUBLE_DIAGONAL"],
  ["中央+ウィング", "CENTER_WINGS"],
  ["中央＋両翼", "CENTER_WINGS"],
  ["CENTER_WINGS", "CENTER_WINGS"],
  ["2列", "DOUBLE_LINE"],
  ["二列", "DOUBLE_LINE"],
  ["DOUBLE_LINE", "DOUBLE_LINE"],
  ["横一列", "LINE"],
  ["一列", "LINE"],
  ["V字", "V"],
  ["ピラミッド", "PYRAMID"],
  ["グリッド", "GRID"],
  ["左右割れ", "SPLIT"],
  ["左右に分ける", "SPLIT"],
  ["ひし形", "DIAMOND"],
  ["ダイヤ", "DIAMOND"],
  ["三角", "TRIANGLE"],
  ["斜め", "DIAGONAL"],
  ["矢印", "ARROW"],
  ["密集", "CLUSTER"],
  ["固まり", "CLUSTER"],
  ["中央", "CENTER"],
  ["弧", "ARC"],
];

export function inferFormationTypeFromName(name: string | undefined): string {
  const text = (name ?? "").trim();
  if (!text) return "CUSTOM";
  const upper = text.toUpperCase();
  for (const [needle, type] of TYPE_FROM_NAME) {
    if (text.includes(needle) || upper.includes(needle.toUpperCase())) return type;
  }
  return "CUSTOM";
}

export function isChoreographyProjectJson(
  raw: unknown
): raw is ChoreographyProjectJson {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.formations) || !Array.isArray(obj.cues)) return false;
  const first = obj.formations[0] as Record<string, unknown> | undefined;
  return Array.isArray(first?.dancers);
}

function songIdFromProject(project: ChoreographyProjectJson): string {
  const title = (project.pieceTitle ?? "").trim() || "untitled";
  const slug = title.replace(/\s+/g, "-").replace(/[^\w\-ぁ-んァ-ン一-龥]/g, "").slice(0, 40);
  return `proj-${slug || "untitled"}`;
}

function durationFromProject(project: ChoreographyProjectJson): number {
  if (typeof project.trimEndSec === "number" && project.trimEndSec > 0) {
    return project.trimEndSec;
  }
  const last = sortCuesByStart(project.cues)[project.cues.length - 1];
  return Math.max(8, last?.tEndSec ?? 32);
}

function sectionTypeFromName(name: string | undefined): MusicSectionType {
  const text = name ?? "";
  if (/サビ|CHORUS|chorus/.test(text)) {
    return /ラスト|FINAL|最終/.test(text) ? "FINAL_CHORUS" : "CHORUS";
  }
  if (/ドロップ|DROP|drop/.test(text)) return "DROP";
  if (/ブレイク|BREAK|break/.test(text)) return "BREAK";
  if (/ブリッジ|BRIDGE/.test(text)) return "BRIDGE";
  if (/イントロ|INTRO/.test(text)) return "INTRO";
  if (/アウトロ|OUTRO/.test(text)) return "OUTRO";
  if (/バース|VERSE|Aメロ/.test(text)) return "VERSE";
  return "VERSE";
}

function sectionsFromCues(
  songId: string,
  annotatorId: string,
  cues: Cue[],
  formationById: Map<string, Formation>,
  duration: number
): HumanSectionAnnotation[] {
  const sorted = sortCuesByStart(cues);
  if (sorted.length === 0) {
    return [
      {
        songId,
        annotatorId,
        startTime: 0,
        endTime: duration,
        type: "VERSE",
        confidence: 0.4,
      },
    ];
  }
  const out: HumanSectionAnnotation[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i]!;
    const next = sorted[i + 1];
    const formation = formationById.get(cue.formationId);
    const startTime = i === 0 ? 0 : cue.tStartSec;
    const endTime = next ? next.tStartSec : duration;
    if (endTime <= startTime + 1e-6) continue;
    out.push({
      songId,
      annotatorId,
      startTime,
      endTime,
      type: sectionTypeFromName(cue.name || formation?.name),
      confidence: 0.7,
    });
  }
  return out.length > 0
    ? out
    : [
        {
          songId,
          annotatorId,
          startTime: 0,
          endTime: duration,
          type: "VERSE",
          confidence: 0.4,
        },
      ];
}

export function projectToAnnotationSession(
  project: ChoreographyProjectJson,
  opts?: { annotatorId?: string; songId?: string; now?: Date }
): AnnotationSession {
  const annotatorId = opts?.annotatorId?.trim() || "editor-import";
  const songId = opts?.songId?.trim() || songIdFromProject(project);
  const duration = durationFromProject(project);
  const sorted = sortCuesByStart(project.cues);
  const formationById = new Map(project.formations.map((f) => [f.id, f] as const));
  const session = createAnnotationSession({
    songId,
    annotatorId,
    duration,
    bpm: 120,
    mode: "BLIND",
    id: `ann-${songId}-${annotatorId}`,
    now: opts?.now ?? new Date(),
    notes: "Imported from editor project. Dancer ids preserved in layout.",
  });

  const cues: HumanCueAnnotation[] = sorted.map((cue, i) => {
    const formation = formationById.get(cue.formationId);
    const chorusLike = /サビ|CHORUS|ドロップ|DROP/i.test(
      `${cue.name ?? ""} ${formation?.name ?? ""}`
    );
    return {
      songId,
      annotatorId,
      id: cue.id,
      time: cue.tStartSec,
      holdEnd: cue.tEndSec,
      action: i === 0 ? "HOLD" : chorusLike ? "MAJOR_CHANGE" : "EXPAND",
      magnitude: i === 0 ? "NONE" : chorusLike ? "LARGE" : "MEDIUM",
      importance: chorusLike ? 92 : i === 0 ? 48 : 72,
      confidence: 0.85,
      notes: formation?.name,
    };
  });

  const formations: HumanFormationRating[] = [];
  const typeOrder: string[] = [];
  for (const cue of sorted) {
    const formation = formationById.get(cue.formationId);
    const dancers: DancerSpot[] = formation?.dancers ?? [];
    const formationType = inferFormationTypeFromName(
      `${cue.name ?? ""} ${formation?.name ?? ""}`
    );
    typeOrder.push(formationType);
    formations.push({
      songId,
      cueId: cue.id,
      annotatorId,
      formationType,
      score: 80,
      musicFit: 80,
      visualImpact: 78,
      transitionQuality: 76,
      execution: 82,
      originality: 70,
      overall: 80,
      rank: 1,
      name: formation?.name,
      layout:
        dancers.length > 0
          ? {
              dancerCount: dancers.length,
              positions: dancers.map((d) => ({
                id: d.id,
                xPct: d.xPct,
                yPct: d.yPct,
              })),
            }
          : undefined,
    });
  }

  return {
    ...session,
    completedAt: session.startedAt,
    sections: sectionsFromCues(songId, annotatorId, sorted, formationById, duration),
    cues,
    formations,
    sequence: [
      {
        songId,
        annotatorId,
        formationIds: typeOrder,
        musicStory: 80,
        visualStory: 78,
        execution: 82,
        variety: 70,
        overall: 80,
      },
    ],
  };
}

export function extraSongCardFromProject(project: ChoreographyProjectJson) {
  const songId = songIdFromProject(project);
  return {
    id: songId,
    title: (project.pieceTitle ?? "").trim() || songId,
    bpm: 120,
    duration: durationFromProject(project),
    category: "ENERGY_DRIVEN",
    difficulty: "MEDIUM",
    structure: "エディタ作品から取り込み",
  };
}
