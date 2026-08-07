/**
 * 照明連動フォーメーション提案パイプライン
 * 実演会照明プラン・コーパスを参照してプリセット／隊形を寄せる
 */

import { pickPattern, ruleForSection } from "./lightingTable";
import { buildPatternPositions } from "./formationFromSection";
import { resolveOverlaps } from "./overlapAvoidance";
import {
  evaluateGapConstraint,
  evaluateMoveConstraints,
} from "./constraintEngine";
import {
  analyzeAudioForLightingSync,
  changePointsToFcpMarkers,
} from "./audioFcp";
import { getClassProfile } from "./classProfiles";
import {
  adviseLightingFromCorpus,
  corpusSummary,
} from "./corpus";
import type { ChangePoint } from "../types";
import type {
  ClassProfile,
  LightingSyncSuggestPayload,
  MemberPosition,
  SuggestedFormationFrame,
} from "./types";

export type LightingSyncGenerateInput = {
  peaks: number[];
  durationSec: number;
  memberIds: string[];
  classProfile?: ClassProfile | string;
  /** Fly 等の変化点があれば優先マージ */
  remoteChangePoints?: ChangePoint[];
  remoteBpm?: number;
  targetMaxFormations?: number;
  /** false でコーパス参照をオフ（テスト用） */
  useLightingCorpus?: boolean;
};

function countsBetween(a: number, b: number): number {
  return Math.max(1, Math.abs(b - a));
}

function colorLabel(mood: string | undefined): string {
  if (!mood || mood === "neutral") return "";
  const map: Record<string, string> = {
    red: "赤系",
    blue: "青系",
    yellow: "黄系",
    purple: "紫系",
    white: "白系",
    green: "緑系",
    mixed: "混色",
    colorful: "カラフル",
    dim: "暗め",
  };
  return map[mood] ?? mood;
}

/**
 * 仕様書の出力 JSON を生成する。
 */
export function generateLightingSyncSuggestion(
  input: LightingSyncGenerateInput
): LightingSyncSuggestPayload {
  const profile =
    typeof input.classProfile === "string" || input.classProfile == null
      ? getClassProfile(
          typeof input.classProfile === "string"
            ? input.classProfile
            : "mon_07pm"
        )
      : input.classProfile;

  const memberIds =
    input.memberIds.length > 0
      ? input.memberIds
      : Array.from({ length: 6 }, (_, i) => `m${i + 1}`);

  const useCorpus = input.useLightingCorpus !== false;
  const duration = Math.max(0.1, input.durationSec);

  let analysis = analyzeAudioForLightingSync(
    input.peaks,
    input.durationSec,
    profile.minCountsBetweenChanges
  );

  if (input.remoteChangePoints?.length && input.remoteBpm) {
    const remoteFcp = changePointsToFcpMarkers(
      input.remoteChangePoints,
      input.remoteBpm,
      input.durationSec,
      profile.minCountsBetweenChanges
    );
    const intro = analysis.fcpMarkers.find((f) => f.sectionType === "intro");
    analysis = {
      bpm: input.remoteBpm,
      duration: input.durationSec,
      totalCounts: Math.max(
        analysis.totalCounts,
        Math.floor((input.durationSec * input.remoteBpm) / 60)
      ),
      fcpMarkers: intro
        ? [intro, ...remoteFcp.filter((f) => f.timestamp > 0.5)]
        : remoteFcp,
    };
  }

  let markers = [...analysis.fcpMarkers].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const maxF = input.targetMaxFormations ?? 12;
  if (markers.length > maxF) {
    const intro = markers.filter((m) => m.sectionType === "intro").slice(0, 1);
    const rest = markers.filter((m) => m.sectionType !== "intro");
    const need = maxF - intro.length;
    rest.sort((a, b) => {
      const wa =
        (a.sectionType === "chorus" || a.sectionType === "drop" ? 2 : 0) +
        a.energyLevel;
      const wb =
        (b.sectionType === "chorus" || b.sectionType === "drop" ? 2 : 0) +
        b.energyLevel;
      return wb - wa;
    });
    markers = [...intro, ...rest.slice(0, need)].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  const formations: SuggestedFormationFrame[] = [];
  let prevPos: MemberPosition[] | null = null;
  let prevCount = 1;
  let prevLighting: SuggestedFormationFrame["lightingPreset"] | undefined;

  const sectionJa: Record<string, string> = {
    intro: "導入",
    verse: "A/Bメロ",
    chorus: "サビ",
    drop: "ドロップ",
    se_trigger: "SE/ソロ",
    outro: "締め",
  };

  for (let i = 0; i < markers.length; i++) {
    const fcp = markers[i]!;
    const rule = ruleForSection(fcp.sectionType);
    const progress = Math.min(1, Math.max(0, fcp.timestamp / duration));

    const advice = useCorpus
      ? adviseLightingFromCorpus({
          progress,
          sectionType: fcp.sectionType,
          energyLevel: fcp.energyLevel,
          dancerCount: memberIds.length,
          ageGroup: profile.targetAgeGroup,
          avoidPreset: prevLighting,
          fallbackPreset: rule.lightingPreset,
        })
      : null;

    const corpusTags = advice?.matches[0]?.cue.tags;
    const pattern = pickPattern(
      fcp.sectionType,
      i + Math.round(fcp.energyLevel * 10),
      profile.allowCrossMovement,
      corpusTags
    );

    let positions = buildPatternPositions(
      pattern,
      memberIds,
      profile,
      i
    );
    positions = resolveOverlaps(positions, profile);

    const gapWarn = evaluateGapConstraint(prevCount, fcp.countNumber, profile);
    const availableCounts =
      i === 0 ? 8 : countsBetween(prevCount, fcp.countNumber);

    let warnings = gapWarn ? [gapWarn] : [];
    if (prevPos) {
      const { warnings: moveWarns, corrected } = evaluateMoveConstraints(
        prevPos,
        positions,
        profile,
        availableCounts
      );
      positions = corrected;
      warnings = [...warnings, ...moveWarns];
    }

    if (
      warnings.some((w) => w.code === "CROSS_FORBIDDEN") &&
      !profile.allowCrossMovement
    ) {
      positions = buildPatternPositions("silhouette_line", memberIds, profile, i);
      positions = resolveOverlaps(positions, profile);
      if (prevPos) {
        const again = evaluateMoveConstraints(
          prevPos,
          positions,
          profile,
          availableCounts
        );
        positions = again.corrected;
        warnings = warnings.filter((w) => w.code !== "CROSS_FORBIDDEN");
        warnings.push(...again.warnings);
      }
    }

    const lightingPreset = advice?.preferCorpus
      ? advice.lightingPreset
      : rule.lightingPreset;
    const color = colorLabel(advice?.colorMood);
    const secLabel = sectionJa[fcp.sectionType] ?? fcp.sectionType;
    const presetName = [
      secLabel,
      rule.presetName,
      color ? color : null,
    ]
      .filter(Boolean)
      .join(" · ");

    formations.push({
      fcpId: fcp.fcpId,
      timestamp: fcp.timestamp,
      count: fcp.countNumber,
      presetName,
      lightingPreset,
      colorMood: advice?.colorMood,
      lightingNote: advice?.preferCorpus ? advice.referenceNote : undefined,
      referenceShowTitle: advice?.preferCorpus
        ? advice.referenceShowTitle
        : undefined,
      positions,
      warnings: warnings.length ? warnings : undefined,
    });

    prevPos = positions;
    prevCount = fcp.countNumber;
    prevLighting = lightingPreset;
  }

  return {
    classId: profile.classId,
    audioAnalysis: {
      bpm: analysis.bpm,
      totalCounts: analysis.totalCounts,
    },
    formations,
  };
}

export { corpusSummary };
