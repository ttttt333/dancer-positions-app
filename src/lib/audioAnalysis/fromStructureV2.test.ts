/**
 * StructureResultV2 → AudioAnalysisResult 変換の単体テスト。
 */

import { describe, expect, it } from "vitest";
import type { StructureResultV2 } from "../choreocore/types/songStructure";
import {
  audioAnalysisFromStructureV2,
  beatsFromEightTimes,
} from "./fromStructureV2";

describe("beatsFromEightTimes", () => {
  it("builds an even BPM grid from irregular eight starts", () => {
    // わずかにゆらいだ eight_times
    const beats = beatsFromEightTimes([0, 2.05, 3.9, 6.1], 8, 8);
    expect(beats.filter((b) => b.isDownbeat).length).toBeGreaterThanOrEqual(2);
    const gaps: number[] = [];
    for (let i = 1; i < Math.min(16, beats.length); i += 1) {
      gaps.push(beats[i]!.timestamp - beats[i - 1]!.timestamp);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const g of gaps) {
      expect(Math.abs(g - mean)).toBeLessThan(0.05);
    }
  });
});

describe("audioAnalysisFromStructureV2", () => {
  it("maps labels, cleanses short fragments, and uses even beat spacing", () => {
    const v2: StructureResultV2 = {
      bpm: 120,
      duration: 32,
      eight_times: [0, 2.1, 3.8, 6.2, 8, 10.05, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      sections: [
        {
          label: "CHORUS",
          start_eight: 0,
          end_eight: 1,
          start_time: 0,
          end_time: 2,
          cluster_id: 1,
          mean_energy: 0.8,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
        {
          label: "CHORUS",
          start_eight: 1,
          end_eight: 2,
          start_time: 2,
          end_time: 4,
          cluster_id: 1,
          mean_energy: 0.8,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
        {
          label: "CHORUS",
          start_eight: 2,
          end_eight: 3,
          start_time: 4,
          end_time: 6,
          cluster_id: 1,
          mean_energy: 0.85,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
        {
          label: "CHORUS",
          start_eight: 3,
          end_eight: 4,
          start_time: 6,
          end_time: 10,
          cluster_id: 1,
          mean_energy: 0.9,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
        {
          label: "A_MELO",
          start_eight: 4,
          end_eight: 8,
          start_time: 10,
          end_time: 24,
          cluster_id: 2,
          mean_energy: 0.4,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
        {
          label: "OUTRO",
          start_eight: 8,
          end_eight: 10,
          start_time: 24,
          end_time: 32,
          cluster_id: 3,
          mean_energy: 0.3,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
      ],
      change_points: [],
      source: "test",
    };
    const result = audioAnalysisFromStructureV2(v2);
    // 細切れサビは1本にマージされる
    const choruses = result.sections.filter((s) => s.type === "chorus");
    expect(choruses.length).toBeLessThanOrEqual(1);
    expect(result.sections.length).toBeLessThanOrEqual(4);
    // ビート間隔が均等
    const gap = result.beats[1]!.timestamp - result.beats[0]!.timestamp;
    expect(gap).toBeCloseTo(0.5, 4);
  });
});
