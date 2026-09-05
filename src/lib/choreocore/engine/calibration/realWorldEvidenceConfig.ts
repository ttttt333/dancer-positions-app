/**
 * Stage 14 Real-World Evidence — 運用ヒューリスティック。
 * 科学的な十分性の証明ではない。実データで後から見直す。
 */

import { CALIBRATION_SAMPLE } from "./humanEvaluationConfig";
import { DISCREPANCY_MIN_SAMPLE } from "./discrepancyConfig";

export const REAL_WORLD_EVIDENCE_VERSION = "14.0.0-real-world-evidence";

/** 運用ヒューリスティック。権威ある統計閾値ではない。 */
export const EVIDENCE_QUALITY_HEURISTICS = {
  observationSampleMin: DISCREPANCY_MIN_SAMPLE,
  evidenceSampleMin: CALIBRATION_SAMPLE.usableMin,
  observationProjectsMin: 3,
  evidenceProjectsMin: 6,
  observationSongsMin: 3,
  evidenceSongsMin: 8,
  observationUsersMin: 2,
  evidenceUsersMin: 4,
  observationSessionsMin: 3,
  evidenceSessionsMin: 8,
  observationActionsMin: 2,
  evidenceActionsMin: 3,
  concentratedSampleMin: 16,
  lowProjectWarn: 2,
  lowUserWarn: 2,
  lowSongWarn: 2,
  lowSessionWarn: 2,
  lowActionWarn: 2,
} as const;
