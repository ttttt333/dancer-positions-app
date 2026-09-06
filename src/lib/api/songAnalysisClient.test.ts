import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../songAnalyzeClient", async () => {
  const actual = await vi.importActual<typeof import("../songAnalyzeClient")>(
    "../songAnalyzeClient"
  );
  return {
    ...actual,
    fetchRemoteStructureV2: vi.fn(async () => null),
  };
});

import { normalizeStructureResultV2 } from "../songAnalyzeClient";
import { fetchSongStructureV2 } from "./songAnalysisClient";
import { fetchRemoteStructureV2 } from "../songAnalyzeClient";

const sampleV2 = {
  bpm: 120,
  duration: 48,
  eight_times: [0, 4, 8],
  sections: [
    {
      label: "CHORUS",
      start_eight: 2,
      end_eight: 4,
      start_time: 8,
      end_time: 16,
      cluster_id: 7,
      mean_energy: 0.75,
      energy_trend: 0.012,
      repeat_count: 2,
      confidence: 0.88,
    },
  ],
  change_points: [
    {
      time: 8,
      eight_index: 2,
      type: "CHORUS_START",
      is_major: true,
      confidence: 0.88,
    },
  ],
  source: "fly_song_structure_v2",
};

describe("songAnalysisClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("normalizeStructureResultV2 keeps cluster_id and energy_trend for motif pipeline", () => {
    const parsed = normalizeStructureResultV2(sampleV2);
    expect(parsed).not.toBeNull();
    expect(parsed!.sections[0]!.cluster_id).toBe(7);
    expect(parsed!.sections[0]!.energy_trend).toBe(0.012);
  });

  it("fetchSongStructureV2 returns null for empty input", async () => {
    await expect(fetchSongStructureV2("")).resolves.toBeNull();
  });

  it("fetchSongStructureV2 hits Fly /api/v2/analyze-structure when Edge yields null", async () => {
    vi.stubEnv("VITE_ANALYZER_API_URL", "https://choreocore-song-analyzer.fly.dev");
    vi.mocked(fetchRemoteStructureV2).mockResolvedValueOnce(null);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/api/v2/analyze-structure");
      return new Response(JSON.stringify(sampleV2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSongStructureV2("https://example.com/song.mp3");
    expect(result).not.toBeNull();
    expect(result!.sections[0]!.cluster_id).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
