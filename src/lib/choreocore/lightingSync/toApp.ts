/**
 * LightingSync 出力 JSON → アプリ Formation / Cue 変換
 */

import type {
  Cue,
  DancerSpot,
  Formation as AppFormation,
} from "../../types/choreography";
import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "../types";
import type {
  LightingSyncSuggestPayload,
  MemberPosition,
  PoseLevel,
} from "./types";

function metersToPct(x: number, y: number): { xPct: number; yPct: number } {
  const xPct = ((x + STAGE_WIDTH_M / 2) / STAGE_WIDTH_M) * 100;
  const yPct = ((y + STAGE_DEPTH_M / 2) / STAGE_DEPTH_M) * 100;
  return {
    xPct: Math.min(95, Math.max(5, xPct)),
    yPct: Math.min(92, Math.max(8, yPct)),
  };
}

function poseNote(pose: PoseLevel): string {
  if (pose === "crouch") return "pose:crouch";
  if (pose === "sit") return "pose:sit";
  return "pose:stand";
}

function mapPosition(
  p: MemberPosition,
  seedById: Map<string, DancerSpot>,
  index: number
): DancerSpot {
  const seed = seedById.get(p.memberId);
  const { xPct, yPct } = metersToPct(p.x, p.y);
  const poseTag = poseNote(p.poseLevel);
  const prevNote = seed?.note?.replace(/\s*pose:(stand|crouch|sit)/g, "").trim();
  return {
    id: p.memberId,
    label: seed?.label ?? String(index + 1),
    xPct,
    yPct,
    colorIndex: seed?.colorIndex ?? index % 12,
    crewMemberId: seed?.crewMemberId,
    markerBadge: seed?.markerBadge,
    markerBadgeSource: seed?.markerBadgeSource,
    sizePx: seed?.sizePx,
    heightCm: seed?.heightCm,
    note: [prevNote, poseTag].filter(Boolean).join(" "),
    poseLevel: p.poseLevel,
  };
}

export type AppLightingSyncResult = {
  formations: AppFormation[];
  cues: Cue[];
  reasoning: string[];
  payload: LightingSyncSuggestPayload;
};

export function lightingSyncPayloadToApp(
  payload: LightingSyncSuggestPayload,
  seedDancers: DancerSpot[]
): AppLightingSyncResult {
  const seedById = new Map(seedDancers.map((d) => [d.id, d] as const));
  // seed の id 順を保つため、positions の memberId が seed と一致している前提
  const formations: AppFormation[] = [];
  const cues: Cue[] = [];
  const reasoning: string[] = [
    `照明連動エンジン / class=${payload.classId} / BPM ${payload.audioAnalysis.bpm} / 総カウント ${payload.audioAnalysis.totalCounts}`,
  ];
  const corpusHits = payload.formations.filter((f) => f.lightingNote).length;
  if (corpusHits > 0) {
    reasoning.push(
      `実演会照明プラン参照: ${corpusHits}/${payload.formations.length} 枠（第19回発表会ほか蓄積コーパス）`
    );
  }

  const sorted = [...payload.formations].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  for (let i = 0; i < sorted.length; i++) {
    const frame = sorted[i]!;
    const next = sorted[i + 1];
    const id =
      crypto.randomUUID?.() ??
      `ls-${frame.fcpId}-${Math.random().toString(36).slice(2, 8)}`;

    const dancers = frame.positions.map((p, idx) =>
      mapPosition(p, seedById, idx)
    );

    const name = frame.presetName;
    const noteParts = [
      frame.lightingNote ? `照明: ${frame.lightingNote}` : null,
      frame.referenceShowTitle ? `参照: ${frame.referenceShowTitle}` : null,
    ].filter(Boolean);
    formations.push({
      id,
      name,
      setPieces: [],
      dancers,
      note: noteParts.length ? noteParts.join(" / ") : undefined,
    });

    cues.push({
      id: crypto.randomUUID?.() ?? `cue-${id}`,
      formationId: id,
      tStartSec: frame.timestamp,
      tEndSec: next
        ? Math.max(frame.timestamp + 0.5, next.timestamp)
        : frame.timestamp + 8,
      name: `${frame.fcpId} ${frame.presetName}`,
    });

    const warnTxt = frame.warnings?.map((w) => w.message).join("; ");
    const noteShort = frame.lightingNote
      ? ` ← ${frame.lightingNote.slice(0, 40)}${frame.lightingNote.length > 40 ? "…" : ""}`
      : "";
    const ref = frame.referenceShowTitle
      ? ` [${frame.referenceShowTitle}]`
      : "";
    reasoning.push(
      `${Math.floor(frame.timestamp / 60)}:${String(Math.floor(frame.timestamp % 60)).padStart(2, "0")} ${frame.fcpId} count${frame.count} → ${frame.presetName} / ${frame.lightingPreset}${ref}${noteShort}${warnTxt ? ` ⚠ ${warnTxt}` : ""}`
    );
  }

  // キュー終端の重なり補正
  cues.sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i]!.tEndSec > cues[i + 1]!.tStartSec) {
      cues[i]!.tEndSec = Math.max(
        cues[i]!.tStartSec + 0.5,
        cues[i + 1]!.tStartSec
      );
    }
  }

  return { formations, cues, reasoning, payload };
}
