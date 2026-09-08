/**
 * セクション種別 → 隊形プリセットの一括適用。
 * AI キーフレーム後に「サビは V字、Aメロは 2列」などをワンクリックで載せる。
 */

import type {
  ChoreographyProjectJson,
  Cue,
  Formation,
} from "../../types/choreography";
import type { MusicSection, SectionType } from "../../types/audioAnalysis";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByNearestPosition,
  type LayoutPresetId,
  type LayoutPresetOptions,
  LAYOUT_PRESET_LABELS,
} from "../formationLayouts";

/** ダンサー向けおすすめデフォルト */
export const DEFAULT_SECTION_FORMATION_PATTERNS: Record<
  SectionType,
  LayoutPresetId
> = {
  intro: "line",
  verse: "two_rows",
  pre_chorus: "stagger",
  chorus: "vee",
  bridge: "circle",
  outro: "line",
  unknown: "grid",
};

/** ダイアログ用の候補（よく使う隊形だけ） */
export const SECTION_PATTERN_PICKER_OPTIONS: {
  id: LayoutPresetId;
  label: string;
}[] = [
  { id: "line", label: LAYOUT_PRESET_LABELS.line ?? "横一列" },
  { id: "two_rows", label: LAYOUT_PRESET_LABELS.two_rows ?? "2列" },
  { id: "stagger", label: LAYOUT_PRESET_LABELS.stagger ?? "千鳥" },
  { id: "vee", label: LAYOUT_PRESET_LABELS.vee ?? "V字" },
  { id: "inverse_vee", label: LAYOUT_PRESET_LABELS.inverse_vee ?? "逆V字" },
  { id: "pyramid", label: LAYOUT_PRESET_LABELS.pyramid ?? "ピラミッド" },
  { id: "circle", label: LAYOUT_PRESET_LABELS.circle ?? "円" },
  { id: "arc", label: LAYOUT_PRESET_LABELS.arc ?? "弧" },
  { id: "grid", label: LAYOUT_PRESET_LABELS.grid ?? "グリッド" },
  {
    id: "diamond",
    label: LAYOUT_PRESET_LABELS.diamond ?? "ダイヤ",
  },
];

export const SECTION_TYPE_JP: Record<SectionType, string> = {
  intro: "イントロ",
  verse: "Aメロ",
  pre_chorus: "Bメロ",
  chorus: "サビ",
  bridge: "ブレイク / Cメロ",
  outro: "アウトロ",
  unknown: "その他",
};

export type SectionPatternMap = Partial<Record<SectionType, LayoutPresetId>>;

function cueMatchesSection(cue: Cue, section: MusicSection): boolean {
  if (Math.abs(cue.tStartSec - section.startTime) <= 0.4) return true;
  return (
    cue.tStartSec >= section.startTime - 1e-6 &&
    cue.tStartSec < section.endTime - 1e-6
  );
}

function findSectionForCue(
  cue: Cue,
  sections: MusicSection[]
): MusicSection | null {
  let best: MusicSection | null = null;
  let bestD = Infinity;
  for (const s of sections) {
    if (!cueMatchesSection(cue, s)) continue;
    const d = Math.abs(cue.tStartSec - s.startTime);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export type ApplySectionFormationPatternsResult = {
  project: ChoreographyProjectJson;
  /** 更新したフォーメーション数 */
  updatedFormationCount: number;
  /** スキップしたキュー数 */
  skippedCueCount: number;
};

/**
 * 各キューが属するセクションの隊形を、対応フォーメーションへ適用する。
 * 同一 formationId は一度だけ書き換える。
 */
export function applySectionFormationPatterns(
  project: ChoreographyProjectJson,
  sections: MusicSection[],
  patternMap: SectionPatternMap = DEFAULT_SECTION_FORMATION_PATTERNS,
  layoutOpts?: LayoutPresetOptions
): ApplySectionFormationPatternsResult {
  if (!sections.length || project.cues.length === 0) {
    return {
      project,
      updatedFormationCount: 0,
      skippedCueCount: project.cues.length,
    };
  }

  const mergedMap: Record<SectionType, LayoutPresetId> = {
    ...DEFAULT_SECTION_FORMATION_PATTERNS,
    ...patternMap,
  };

  const formationById = new Map(
    project.formations.map((f) => [f.id, f] as const)
  );
  const updates = new Map<string, Formation>();
  let skipped = 0;

  for (const cue of project.cues) {
    const section = findSectionForCue(cue, sections);
    if (!section) {
      skipped += 1;
      continue;
    }
    const preset = mergedMap[section.type] ?? mergedMap.unknown;
    if (!preset) {
      skipped += 1;
      continue;
    }
    if (updates.has(cue.formationId)) continue;

    const fm = formationById.get(cue.formationId);
    if (!fm || fm.dancers.length === 0) {
      skipped += 1;
      continue;
    }

    const raw = dancersForLayoutPreset(fm.dancers.length, preset, layoutOpts);
    const dancers = transferDancerIdentitiesByNearestPosition(raw, fm.dancers);
    updates.set(cue.formationId, {
      ...fm,
      dancers,
      confirmedDancerCount: dancers.length,
      name: fm.name?.trim() ? fm.name : section.label,
    });
  }

  if (updates.size === 0) {
    return { project, updatedFormationCount: 0, skippedCueCount: skipped };
  }

  const formations = project.formations.map(
    (f) => updates.get(f.id) ?? f
  );

  return {
    project: { ...project, formations },
    updatedFormationCount: updates.size,
    skippedCueCount: skipped,
  };
}

/** 解析に出てくるセクション種別だけを列挙（UI 用） */
export function sectionTypesPresent(
  sections: MusicSection[]
): SectionType[] {
  const seen = new Set<SectionType>();
  const order: SectionType[] = [
    "intro",
    "verse",
    "pre_chorus",
    "chorus",
    "bridge",
    "outro",
    "unknown",
  ];
  for (const s of sections) seen.add(s.type);
  return order.filter((t) => seen.has(t));
}
