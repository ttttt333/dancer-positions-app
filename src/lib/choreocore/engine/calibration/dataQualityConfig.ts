/**
 * Real-World Data Quality Monitor — 観測データの品質監視だけ。
 * 知能・学習・Release・Canary はしない。閾値は Stage 14 を再利用する。
 */

import { EVIDENCE_QUALITY_HEURISTICS } from "./realWorldEvidenceConfig";
import { HUMAN_FEEDBACK_LIMITS } from "./humanFeedbackConfig";

export const DATA_QUALITY_VERSION = "16.1.0-data-quality-monitor";

export const DATA_QUALITY_HEURISTICS = EVIDENCE_QUALITY_HEURISTICS;

export const DATA_QUALITY_BUFFER_CAPACITY = HUMAN_FEEDBACK_LIMITS.maxEvents;

export const UNKNOWN_SONG_SENTINEL = "unknown-song";
