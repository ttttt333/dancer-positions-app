/**
 * Choreographic Intent — 空間的「目的」。形・座標・経路は持たない。
 * FormationCueAction の V / LINE / TRIANGLE などは Formation 語彙なので使わない。
 */

import type {
  EnergyDirection,
  EnergyLevel,
  FormationCue,
} from "../types/CueTypes";
import type { EventCluster, MusicSection } from "../types/MusicTypes";

export type ChoreographicIntentType =
  | "HOLD"
  | "EXPAND"
  | "CONTRACT"
  | "SPLIT"
  | "MERGE"
  | "SHIFT_CENTER"
  | "MICRO_SHIFT"
  | "MAJOR_CHANGE"
  | "REVEAL"
  | "HIDE"
  | "HIT"
  | "TRAVEL"
  | "RESET"
  | "ROTATE";

export type ChoreographicIntentCandidate = {
  intent: ChoreographicIntentType;
  /** この文脈で候補としてどれだけ適切か */
  score: number;
  /** 解析根拠の強さ。score とは別 */
  confidence: number;
  /** 意図の強さ。音量ではない */
  intensity: number;
  sourceEventIds: string[];
  reasonCodes: string[];
};

export type ChoreographicIntent = {
  cueId: string;
  primary: ChoreographicIntentCandidate;
  alternatives: ChoreographicIntentCandidate[];
  contrastFromPrevious: number;
  previousIntent: ChoreographicIntentType | null;
};

export type ChoreographicIntentContext = {
  cue: FormationCue;
  event?: EventCluster | null;
  section?: MusicSection | null;
  previousSection?: MusicSection | null;
  energyTrend: EnergyDirection;
  energyLevel: EnergyLevel;
  musicEnergy?: number;
  previousIntent?: ChoreographicIntentType | null;
  timelinePosition: number;
};

export type ChoreographicIntentSequence = {
  intents: ChoreographicIntent[];
  analysisVersion: string;
};
