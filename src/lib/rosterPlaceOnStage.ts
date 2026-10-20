import type {
  ChoreographyProjectJson,
  Crew,
  CrewMember,
  DancerSpot,
  Formation,
} from "../types/choreography";
import {
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  MIN_CUE_DURATION_SEC,
  sortCuesByStart,
} from "../core/timelineController";
import { modDancerColorIndex } from "./dancerColorPalette";
import { dancerMarkerDiameterAfterRosterImport } from "./projectDefaults";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByOrder,
  type LayoutPresetId,
} from "./formationLayouts";

function memberToPlaceholderSpot(m: CrewMember): DancerSpot {
  return {
    id: crypto.randomUUID(),
    label: m.label.trim().slice(0, 120) || "?",
    ...(m.labelPrefix?.trim()
      ? { labelPrefix: m.labelPrefix.trim().slice(0, 8) }
      : {}),
    markerBadge: "",
    xPct: 50,
    yPct: 40,
    colorIndex: modDancerColorIndex(m.colorIndex),
    crewMemberId: m.id,
    ...(typeof m.heightCm === "number" ? { heightCm: m.heightCm } : {}),
    ...(m.gradeLabel?.trim()
      ? { gradeLabel: m.gradeLabel.trim().slice(0, 32) }
      : {}),
    ...(m.skillRankLabel?.trim()
      ? { skillRankLabel: m.skillRankLabel.trim().slice(0, 24) }
      : {}),
  };
}

/**
 * 名簿クルーをプロジェクトに足し、アクティブ（または先頭キュー）のフォーメーションへ
 * 未配置メンバーを雛形で並べる。既存のステージ上メンバーは残す。
 */
export function appendCrewAndPlaceOnStage(
  project: ChoreographyProjectJson,
  crew: Crew,
  presetId: LayoutPresetId
): ChoreographyProjectJson {
  const withCrew: ChoreographyProjectJson = {
    ...project,
    crews: [...project.crews, crew],
  };

  const sortedCues = sortCuesByStart(withCrew.cues);
  const firstCue = sortedCues[0];
  const targetFid = firstCue?.formationId ?? withCrew.activeFormationId;
  const ensuredCues =
    firstCue != null
      ? withCrew.cues.map((c) =>
          c.id === firstCue.id && firstCue.formationId !== targetFid
            ? { ...c, formationId: targetFid }
            : c
        )
      : [
          {
            id: crypto.randomUUID(),
            tStartSec: 0,
            tEndSec: Math.max(
              MIN_CUE_DURATION_SEC,
              DEFAULT_CUE_SPAN_WITH_AUDIO_SEC
            ),
            formationId: targetFid,
          },
        ];

  const f = withCrew.formations.find((x) => x.id === targetFid);
  if (!f) {
    return {
      ...withCrew,
      cues: ensuredCues,
      activeFormationId: targetFid,
      rosterStripCollapsed: false,
      rosterHidesTimeline: false,
      dancerMarkerDiameterPx: dancerMarkerDiameterAfterRosterImport(
        withCrew.dancerMarkerDiameterPx
      ),
    };
  }

  const onStage = new Set(
    f.dancers.map((d) => d.crewMemberId).filter(Boolean) as string[]
  );
  const toAdd = crew.members.filter((m) => !onStage.has(m.id));
  if (toAdd.length === 0) {
    return {
      ...withCrew,
      cues: ensuredCues,
      activeFormationId: targetFid,
      rosterStripCollapsed: false,
      rosterHidesTimeline: false,
      dancerMarkerDiameterPx: dancerMarkerDiameterAfterRosterImport(
        withCrew.dancerMarkerDiameterPx
      ),
    };
  }

  const existing = [...f.dancers];
  const total = existing.length + toAdd.length;
  const opts = {
    dancerSpacingMm: withCrew.dancerSpacingMm,
    stageWidthMm: withCrew.stageWidthMm,
  };
  const placeholders: DancerSpot[] = [
    ...existing,
    ...toAdd.map(memberToPlaceholderSpot),
  ];
  const positioned = dancersForLayoutPreset(total, presetId, opts);
  const merged = transferDancerIdentitiesByOrder(positioned, placeholders);
  const nextFormation: Formation = {
    ...f,
    dancers: merged,
    confirmedDancerCount: merged.length,
  };

  return {
    ...withCrew,
    cues: ensuredCues,
    activeFormationId: targetFid,
    dancerLabelPosition: "below",
    dancerMarkerDiameterPx: dancerMarkerDiameterAfterRosterImport(
      withCrew.dancerMarkerDiameterPx
    ),
    rosterStripCollapsed: false,
    rosterHidesTimeline: false,
    formations: withCrew.formations.map((fm) =>
      fm.id === f.id ? nextFormation : fm
    ),
  };
}
