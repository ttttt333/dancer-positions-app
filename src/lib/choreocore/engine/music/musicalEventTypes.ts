/**
 * 既存 Phase2 構造の解釈ビュー。解析結果そのものではない。
 * 隊形名・座標は持たない。
 */

import type { MusicSectionType } from "../types/MusicTypes";

export type MusicalEventKind =
  | "SECTION_BOUNDARY"
  | "PHRASE_BOUNDARY"
  | "HIT"
  | "BREAK"
  | "BUILD"
  | "SILENCE"
  | "REPETITION";

export type MusicalEventVariation = "first" | "repeat" | "final" | "none";

export type MusicalEvent = {
  id: string;
  time: number;
  beatTime: number | null;
  barTime: number | null;
  kind: MusicalEventKind;
  sectionType: MusicSectionType;
  structuralImportance: number;
  instantaneousImpact: number;
  confidence: number;
  energyBefore: number;
  energyAfter: number;
  sourceEventIds: string[];
  reasonCodes: string[];
  chorusFamilyId: string | null;
  chorusOccurrence: number | null;
  variation: MusicalEventVariation;
  flags: {
    isDownbeatAligned: boolean;
    isQuietChorus: boolean;
    isLastChorus: boolean;
  };
};
