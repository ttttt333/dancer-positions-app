/**
 * 実演会照明プランの蓄積コーパス型
 */

import type { LightingPresetId, SectionType } from "../types";

export type LightingColorMood =
  | "red"
  | "blue"
  | "yellow"
  | "purple"
  | "white"
  | "green"
  | "mixed"
  | "colorful"
  | "dim"
  | "neutral";

export type LightingPlanCue = {
  cueNo: number;
  startSec: number;
  endSec: number | null;
  /** 相対位置 0〜1（曲長に対する開始） */
  progressStart: number;
  progressEnd: number;
  note: string;
  inferredSection: SectionType;
  lightingPreset: LightingPresetId;
  colorMood: LightingColorMood;
  tags: string[];
};

export type LightingPlanShow = {
  id: string;
  title: string;
  event: string;
  className: string;
  trackTitle: string;
  durationSec: number;
  dancerCount: number;
  atmosphere: string;
  points: string;
  pinSpot: boolean;
  sourceFile: string;
  cues: LightingPlanCue[];
};

export type CorpusLightingMatch = {
  showId: string;
  showTitle: string;
  cue: LightingPlanCue;
  score: number;
  reason: string;
};
