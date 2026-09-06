import { describe, expect, it } from "vitest";
import { normalizeStructureResultV2 } from "./songAnalyzeClient";

describe("normalizeStructureResultV2", () => {
  it("parses StructureResultV2-shaped JSON", () => {
    const parsed = normalizeStructureResultV2({
      bpm: 128,
      duration: 64,
      eight_times: [0, 3.75, 7.5],
      sections: [
        {
          label: "CHORUS",
          start_eight: 2,
          end_eight: 4,
          start_time: 7.5,
          end_time: 15,
          cluster_id: 3,
          mean_energy: 0.82,
          energy_trend: 0.01,
          repeat_count: 2,
          confidence: 0.9,
        },
      ],
      change_points: [
        {
          time: 7.5,
          eight_index: 2,
          type: "CHORUS_START",
          is_major: true,
          confidence: 0.9,
          note: "",
        },
      ],
      source: "chroma-ssm-v2",
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.sections[0]!.cluster_id).toBe(3);
    expect(parsed!.sections[0]!.label).toBe("CHORUS");
    expect(parsed!.change_points[0]!.is_major).toBe(true);
  });

  it("rejects empty or invalid payloads", () => {
    expect(normalizeStructureResultV2(null)).toBeNull();
    expect(
      normalizeStructureResultV2({ bpm: 120, duration: 10, sections: [] })
    ).toBeNull();
  });
});
