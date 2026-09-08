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
  it("marks every 8-count start as downbeat and fills 1–8", () => {
    const beats = beatsFromEightTimes([0, 2], 4, 8);
    expect(beats.filter((b) => b.isDownbeat).map((b) => b.timestamp)).toEqual([
      0, 2,
    ]);
    expect(beats[0]!.beatNumber).toBe(1);
    expect(beats[7]!.beatNumber).toBe(8);
    expect(beats[8]!.timestamp).toBe(2);
  });
});

describe("audioAnalysisFromStructureV2", () => {
  it("maps labels to Japanese sections and snaps to eight downbeats", () => {
    const v2: StructureResultV2 = {
      bpm: 120,
      duration: 8,
      eight_times: [0, 2, 4, 6],
      sections: [
        {
          label: "A_MELO",
          start_eight: 0,
          end_eight: 1,
          start_time: 0.15,
          end_time: 1.9,
          cluster_id: 1,
          mean_energy: 0.4,
          energy_trend: 0,
          repeat_count: 1,
          confidence: 0.8,
        },
        {
          label: "CHORUS",
          start_eight: 1,
          end_eight: 2,
          start_time: 2.1,
          end_time: 3.85,
          cluster_id: 2,
          mean_energy: 0.8,
          energy_trend: 0.1,
          repeat_count: 1,
          confidence: 0.9,
        },
      ],
      change_points: [],
      source: "test",
    };
    const result = audioAnalysisFromStructureV2(v2);
    expect(result.sections[0]!.label).toBe("Aメロ");
    expect(result.sections[0]!.startTime).toBe(0);
    expect(result.sections[0]!.endTime).toBe(2);
    expect(result.sections[1]!.label).toBe("サビ");
    expect(result.sections[1]!.startTime).toBe(2);
    expect(result.sections[1]!.endTime).toBe(4);
  });
});
