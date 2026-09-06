import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { StructureResultV2 } from "../types/songStructure";
import { resolveStructureV2ForSuggest } from "./suggestPipeline";

const sample: StructureResultV2 = {
  bpm: 128,
  duration: 64,
  eight_times: [0, 3.75],
  sections: [
    {
      label: "B_MELO",
      start_eight: 4,
      end_eight: 6,
      start_time: 15,
      end_time: 22.5,
      cluster_id: 2,
      mean_energy: 0.55,
      energy_trend: 0.02,
      repeat_count: 1,
      confidence: 0.8,
    },
  ],
  change_points: [],
  source: "fly_song_structure_v2",
};

describe("suggestPipeline", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers cachedStructureV2 without network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const resolved = await resolveStructureV2ForSuggest({
      cachedStructureV2: sample,
      audioUrl: "https://example.com/a.mp3",
    });
    expect(resolved).toEqual(sample);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null when neither cache nor audio is provided", async () => {
    await expect(resolveStructureV2ForSuggest({})).resolves.toBeNull();
  });
});
