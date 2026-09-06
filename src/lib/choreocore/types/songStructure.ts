/**
 * song_structure_v2.py (Fly.io / chroma-SSM) の解析結果型。
 * Python `StructureResult` / `Section` / `ChangePointV2` とフィールド対応。
 */

export type SectionLabelV2 =
  | "INTRO"
  | "A_MELO"
  | "B_MELO"
  | "CHORUS"
  | "BREAKDOWN"
  | "OUTRO";

export type SongSectionV2 = {
  label: SectionLabelV2;
  start_eight: number;
  end_eight: number;
  start_time: number;
  end_time: number;
  cluster_id: number;
  mean_energy: number;
  energy_trend: number;
  repeat_count: number;
  confidence: number;
};

export type ChangePointV2 = {
  time: number;
  eight_index: number;
  type: string;
  is_major: boolean;
  confidence: number;
  note?: string;
};

export type StructureResultV2 = {
  bpm: number;
  duration: number;
  eight_times: number[];
  sections: SongSectionV2[];
  change_points: ChangePointV2[];
  source?: string;
};

/**
 * 時刻 t が属する v2 セクションを返す（半開区間 [start, end)）。
 */
export function findSongSectionV2AtTime(
  sections: SongSectionV2[] | undefined,
  timeSec: number
): SongSectionV2 | undefined {
  if (!sections?.length) return undefined;
  for (const s of sections) {
    if (timeSec >= s.start_time && timeSec < s.end_time) return s;
  }
  // 末尾ちょうど
  const last = sections[sections.length - 1]!;
  if (Math.abs(timeSec - last.end_time) < 1e-6) return last;
  return undefined;
}

/** レガシー MusicSection.type / ChangePoint.section_type → v2 ラベル */
export function mapLegacyTypeToSectionLabelV2(
  type: string | undefined
): SectionLabelV2 {
  const t = (type ?? "").toUpperCase();
  if (t === "INTRO") return "INTRO";
  if (t === "OUTRO") return "OUTRO";
  if (t === "BREAK" || t === "BREAKDOWN") return "BREAKDOWN";
  if (t === "PRE_CHORUS" || t === "BRIDGE" || t === "B_MELO") return "B_MELO";
  if (
    t === "CHORUS" ||
    t === "CHORUS_START" ||
    t === "FINAL_CHORUS" ||
    t === "DROP"
  ) {
    return "CHORUS";
  }
  if (t === "VERSE" || t === "A_MELO") return "A_MELO";
  return "A_MELO";
}

/**
 * 同一ラベルは同じ疑似クラスタに寄せる（v2 未接続時のモチーフ一貫性フォールバック）。
 * 本番の chroma-SSM cluster_id があるときは使わない。
 */
const PSEUDO_CLUSTER: Record<SectionLabelV2, number> = {
  INTRO: 10,
  A_MELO: 20,
  B_MELO: 30,
  CHORUS: 40,
  BREAKDOWN: 50,
  OUTRO: 60,
};

export type LegacySectionLike = {
  type?: string;
  startTime: number;
  endTime: number;
  energyMean?: number;
  energyDelta?: number;
  confidence?: number;
};

/**
 * 既存 MusicSection から SongSectionV2 を近似生成する。
 * Fly v2 が来るまでのブリッジ。cluster_id はラベル単位の疑似 ID。
 */
export function approximateSongSectionV2FromLegacy(
  section: LegacySectionLike | undefined | null
): SongSectionV2 | undefined {
  if (!section) return undefined;
  const label = mapLegacyTypeToSectionLabelV2(section.type);
  const mean = section.energyMean ?? 0.5;
  const trend = section.energyDelta ?? 0;
  return {
    label,
    start_eight: 0,
    end_eight: 0,
    start_time: section.startTime,
    end_time: section.endTime,
    cluster_id: PSEUDO_CLUSTER[label],
    mean_energy: mean,
    energy_trend: trend,
    repeat_count: 1,
    confidence: section.confidence ?? 0.5,
  };
}

/**
 * v2 があれば優先。無ければレガシー MusicSection から近似。
 */
export function resolveSongSectionV2(opts: {
  timeSec: number;
  structureV2?: StructureResultV2 | null;
  legacySection?: LegacySectionLike | null;
}): SongSectionV2 | undefined {
  const fromV2 = findSongSectionV2AtTime(
    opts.structureV2?.sections,
    opts.timeSec
  );
  if (fromV2) return fromV2;
  return approximateSongSectionV2FromLegacy(opts.legacySection);
}
