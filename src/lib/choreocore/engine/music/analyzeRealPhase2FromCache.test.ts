/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { ANALYSIS_VERSION, analyzeAudio } from "../index";
import { createSyntheticPhase1Analysis } from "./syntheticPhase1";
import { makeQuietThenHit } from "../audio/testBuffers";
import {
  analyzeAndCacheRealPhase1,
  clearRealPhase1Inflight,
} from "../audio/analyzeAndCacheRealPhase1";
import { clearRealPhase1Cache } from "../audio/realPhase1Cache";
import {
  analyzeRealPhase2FromCache,
} from "./analyzeRealPhase2FromCache";
import {
  getLastMusicEngineTrace,
  resetMusicEngineTrace,
} from "./productionTimeline";
import { MUSIC_ACCURACY_CASES } from "./musicAccuracyFixtures";

afterEach(() => {
  clearRealPhase1Cache();
  clearRealPhase1Inflight();
  resetMusicEngineTrace();
});

describe("Stage 2: Real Phase1 → Real Phase2", () => {
  it("A. Real PCM Phase1 drives MusicStructureAnalyzer (not synthetic)", async () => {
    const phase1 = await analyzeAudio(
      makeQuietThenHit({ durationSec: 3.2, hitTimeSec: 1.6 })
    );
    expect(phase1.provenance).toBe("real");
    const result = analyzeRealPhase2FromCache({ phase1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.phase1.provenance).toBe("real");
    expect(result.phase2.sections.length).toBeGreaterThan(0);
    expect(result.phase2.phrases.length).toBeGreaterThan(0);
    expect(Array.isArray(result.phase2.changePoints)).toBe(true);
    expect(Array.isArray(result.phase2.eventClusters)).toBe(true);
    expect(result.timeline.phase1Provenance).toBe("real");
    expect(result.timeline.source).toBe("engine-phase12");
    expect(result.timeline.phrases.length).toBe(result.phase2.phrases.length);
    expect(getLastMusicEngineTrace()?.phase2Executed).toBe(true);
  });

  it("B. synthetic Phase1 is not treated as Real Phase2", () => {
    const syn = createSyntheticPhase1Analysis({
      segments: [
        { duration: 8, energy: 22, bass: 0.08, onset: 0.12, high: 0.08 },
        { duration: 8, energy: 82, bass: 0.55, onset: 0.7, high: 0.2 },
      ],
    });
    const result = analyzeRealPhase2FromCache({ phase1: syn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fallbackReason).toBe("wrong-provenance");
    expect(getLastMusicEngineTrace()?.phase2Executed).toBe(false);
    expect(getLastMusicEngineTrace()?.phase2FallbackReason).toBe(
      "wrong-provenance"
    );
  });

  it("C. Real Phase1 cache hit feeds Real Phase2 without regenerating Phase1", async () => {
    await analyzeAndCacheRealPhase1({
      audioBuffer: makeQuietThenHit({ durationSec: 2.8, hitTimeSec: 1.4 }),
      cacheKey: "stage2-track",
      force: true,
    });
    const result = analyzeRealPhase2FromCache({ cacheKey: "stage2-track" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.phase1CacheHit).toBe(true);
    expect(result.phase1.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(result.phase2.sections.length).toBeGreaterThan(0);
    expect(getLastMusicEngineTrace()?.phase1CacheHit).toBe(true);
    expect(getLastMusicEngineTrace()?.phase1Provenance).toBe("real");
  });

  it("D. cache miss is an explicit legacy fallback, not silent synthetic Phase2", () => {
    const missing = analyzeRealPhase2FromCache({ cacheKey: "no-such-track" });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.fallbackReason).toBe("cache-miss");

    const noKey = analyzeRealPhase2FromCache({});
    expect(noKey.ok).toBe(false);
    if (noKey.ok) return;
    expect(noKey.fallbackReason).toBe("missing-cache-key");
  });

  it("E. Phase2 throw falls back instead of using synthetic input", async () => {
    const phase1 = await analyzeAudio(
      makeQuietThenHit({ durationSec: 2.0, hitTimeSec: 1.0 })
    );
    const result = analyzeRealPhase2FromCache({
      phase1,
      analyzePhase2: () => {
        throw new Error("phase2-boom");
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fallbackReason).toBe("phase2-error");
    expect(getLastMusicEngineTrace()?.phase2FallbackReason).toBe("phase2-error");
  });

  it("does not treat accuracy fixtures as intelligence success", () => {
    expect(MUSIC_ACCURACY_CASES.every((c) => Boolean(c.id && c.expected))).toBe(
      true
    );
  });
});
