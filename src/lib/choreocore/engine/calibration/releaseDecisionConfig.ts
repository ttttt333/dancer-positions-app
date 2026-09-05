/**
 * Stage 15 Evidence Review / Release Decision — 観測した証拠を人が判断する枠。
 * 総合点は作らない。Hard blocker は他指標で相殺できない。
 * 閾値は Stage 14 の運用ヒューリスティックを再利用する。科学的証明ではない。
 */

import { EVIDENCE_QUALITY_HEURISTICS } from "./realWorldEvidenceConfig";

export const RELEASE_DECISION_VERSION = "15.0.0-evidence-review";
export const RELEASE_DECISION_STORAGE_KEY = "choreocore.releaseDecision.v1";

export const RELEASE_DECISION_DATA_SOURCES = ["REAL", "FIXTURE"] as const;

/** Stage 14 evidence 閾値を Release 判定の hard requirement として使う */
export const RELEASE_DECISION_HEURISTICS = {
  sampleMin: EVIDENCE_QUALITY_HEURISTICS.evidenceSampleMin,
  projectMin: EVIDENCE_QUALITY_HEURISTICS.evidenceProjectsMin,
  sessionMin: EVIDENCE_QUALITY_HEURISTICS.evidenceSessionsMin,
  userMin: EVIDENCE_QUALITY_HEURISTICS.evidenceUsersMin,
  songMin: EVIDENCE_QUALITY_HEURISTICS.evidenceSongsMin,
} as const;

export const RELEASE_CHECKLIST_KEYS = [
  "HUMAN_EVALUATION",
  "REAL_WORLD_SAMPLE",
  "PROJECT_DIVERSITY",
  "SESSION_DIVERSITY",
  "USER_DIVERSITY",
  "SONG_DIVERSITY",
  "SHADOW_EVIDENCE",
  "VERSION_INTEGRITY",
  "REGRESSION_SAFETY",
  "STAGE_11_APPROVAL",
  "STAGE_13_RELEASE_PACKAGE",
] as const;
