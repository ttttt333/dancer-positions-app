import type { EventMetricsBundle, EventTypeMetrics, FlyGtEvent } from "../types";
import { evidenceConfidenceFromSampleCount } from "../versions";
import {
  DEFAULT_ONSET_THRESHOLDS_MS,
  scoreTimingDetection,
} from "./beat";

const EVENT_THRESHOLDS = DEFAULT_ONSET_THRESHOLDS_MS;

export function scoreEvents(
  ref: FlyGtEvent[] | null | undefined,
  hyp: Array<{ timestamp: number; type: string }> | null | undefined
): EventMetricsBundle {
  if (!ref?.length) {
    return {
      status: "NOT_AVAILABLE",
      byType: [],
      sampleCount: 0,
      evidenceConfidence: "NONE",
    };
  }

  const types = [...new Set(ref.map((e) => e.type))];
  const byType: EventTypeMetrics[] = [];
  let totalSamples = 0;

  for (const type of types) {
    const rTimes = ref.filter((e) => e.type === type).map((e) => e.timestamp);
    const hTimes = (hyp ?? [])
      .filter((e) => e.type === type)
      .map((e) => e.timestamp);
    const base = scoreTimingDetection(rTimes, hTimes, EVENT_THRESHOLDS);
    totalSamples += rTimes.length;
    byType.push({ ...base, eventType: type });
  }

  return {
    status: "OK",
    byType,
    sampleCount: totalSamples,
    evidenceConfidence: evidenceConfidenceFromSampleCount(totalSamples),
  };
}
