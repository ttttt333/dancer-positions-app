/**
 * Fly SSM 未実装時の受け入れモック。
 * 1回目と2回目のサビが同じ familyId を持つ。
 */

import type { SectionFamily } from "./sectionFamilies";

export const MOCK_CALLBACK_CHORUS_FAMILIES: SectionFamily[] = [
  {
    familyId: "chorus-A",
    type: "CHORUS",
    occurrences: [
      { timeStart: 20, timeEnd: 36, variation: "first" },
      { timeStart: 52, timeEnd: 68, variation: "repeat" },
      { timeStart: 84, timeEnd: 100, variation: "final" },
    ],
  },
  {
    familyId: "verse-1",
    type: "VERSE",
    occurrences: [
      { timeStart: 4, timeEnd: 20, variation: "first" },
      { timeStart: 36, timeEnd: 52, variation: "repeat" },
    ],
  },
];

/** fetchRemoteSongAnalysis が受け取る JSON 形 */
export const MOCK_REMOTE_ANALYSIS_WITH_FAMILIES = {
  bpm: 120,
  duration: 104,
  eight_grid: [
    { index: 0, start_time: 0 },
    { index: 10, start_time: 20 },
    { index: 26, start_time: 52 },
    { index: 42, start_time: 84 },
  ],
  change_points: [
    {
      eight_index: 2,
      time: 4,
      score: 0.4,
      tier: "minor" as const,
      section_type: "VERSE",
    },
    {
      eight_index: 10,
      time: 20,
      score: 0.95,
      tier: "major" as const,
      section_type: "CHORUS_START",
    },
    {
      eight_index: 26,
      time: 52,
      score: 0.92,
      tier: "major" as const,
      section_type: "CHORUS_START",
    },
    {
      eight_index: 42,
      time: 84,
      score: 0.97,
      tier: "major" as const,
      section_type: "CHORUS",
    },
  ],
  song_dynamism: 0.62,
  analyzer_version: "algo-v1.3.0",
  section_families: MOCK_CALLBACK_CHORUS_FAMILIES,
};
