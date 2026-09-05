/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { ANALYSIS_VERSION, analyzeAudio } from "../index";
import { createSyntheticPhase1Analysis } from "../music/syntheticPhase1";
import { makeSineBuffer, makeQuietThenHit } from "./testBuffers";
import {
  analyzeAndCacheRealPhase1,
  clearRealPhase1Inflight,
} from "./analyzeAndCacheRealPhase1";
import {
  clearRealPhase1Cache,
  getRealPhase1Cached,
  setRealPhase1Cached,
} from "./realPhase1Cache";
import { isMusicEnginePhase12Enabled } from "./musicEngineFlag";
import {
  getLastMusicEngineTrace,
  isRealPhase1Provenance,
  resetMusicEngineTrace,
} from "../music/productionTimeline";
import { MUSIC_ACCURACY_CASES } from "../music/musicAccuracyFixtures";

afterEach(() => {
  clearRealPhase1Cache();
  clearRealPhase1Inflight();
  resetMusicEngineTrace();
});

describe("Stage 0 contracts: real vs synthetic Phase1", () => {
  it("analyzeAudio on real PCM is provenance real", async () => {
    const buffer = makeSineBuffer({
      frequency: 220,
      durationSec: 0.6,
      amplitude: 0.4,
    });
    const phase1 = await analyzeAudio(buffer);
    expect(phase1.provenance).toBe("real");
    expect(isRealPhase1Provenance(phase1.provenance)).toBe(true);
    expect(phase1.frames.length).toBeGreaterThan(0);
    expect(phase1.analysisVersion).toBe(ANALYSIS_VERSION);
  });

  it("createSyntheticPhase1Analysis is provenance synthetic, not real Phase1", () => {
    const syn = createSyntheticPhase1Analysis({
      segments: [{ duration: 2, energy: 40, bass: 0.2, onset: 0.2, high: 0.2 }],
    });
    expect(syn.provenance).toBe("synthetic");
    expect(isRealPhase1Provenance(syn.provenance)).toBe(false);
  });
});

describe("Stage 1: Real PCM → cache", () => {
  it("feature flag defaults to OFF", () => {
    expect(isMusicEnginePhase12Enabled()).toBe(false);
  });

  it("caches real Phase1 and hits on the same key+version", async () => {
    const buffer = makeQuietThenHit({ durationSec: 1.2, hitTimeSec: 0.6 });
    const phase1 = await analyzeAndCacheRealPhase1({
      audioBuffer: buffer,
      cacheKey: "track-a",
      force: true,
    });
    expect(phase1?.provenance).toBe("real");
    const hit = getRealPhase1Cached("track-a", ANALYSIS_VERSION);
    expect(hit).not.toBeNull();
    expect(hit!.phase1.frames.length).toBe(phase1!.frames.length);
    const hit2 = getRealPhase1Cached("track-a", ANALYSIS_VERSION);
    expect(hit2?.phase1).toBe(hit!.phase1);
  });

  it("version mismatch is a cache miss", async () => {
    const buffer = makeSineBuffer({
      frequency: 330,
      durationSec: 0.5,
      amplitude: 0.3,
    });
    await analyzeAndCacheRealPhase1({
      audioBuffer: buffer,
      cacheKey: "track-b",
      force: true,
    });
    expect(getRealPhase1Cached("track-b", "9.9.9-not-this-version")).toBeNull();
    expect(getRealPhase1Cached("track-b", ANALYSIS_VERSION)).not.toBeNull();
  });

  it("refuses to store synthetic Phase1 in the real cache", () => {
    const syn = createSyntheticPhase1Analysis({
      segments: [{ duration: 1, energy: 50, bass: 0.3, onset: 0.3, high: 0.2 }],
    });
    expect(setRealPhase1Cached("track-c", syn)).toBeNull();
    expect(getRealPhase1Cached("track-c")).toBeNull();
  });

  it("does not run Phase1 when flag is OFF and force is false", async () => {
    const buffer = makeSineBuffer({
      frequency: 110,
      durationSec: 0.4,
      amplitude: 0.2,
    });
    const result = await analyzeAndCacheRealPhase1({
      audioBuffer: buffer,
      cacheKey: "track-d",
      force: false,
    });
    expect(result).toBeNull();
    expect(getRealPhase1Cached("track-d")).toBeNull();
  });

  it("same audio + same analysis version is a cache hit (Analyze Once)", async () => {
    const buffer = makeQuietThenHit({ durationSec: 1.0, hitTimeSec: 0.5 });
    const first = await analyzeAndCacheRealPhase1({
      audioBuffer: buffer,
      cacheKey: "track-e",
      force: true,
    });
    expect(getLastMusicEngineTrace()?.cacheMiss).toBe(true);
    const second = await analyzeAndCacheRealPhase1({
      audioBuffer: buffer,
      cacheKey: "track-e",
      force: true,
    });
    expect(second).toBe(first);
    expect(getLastMusicEngineTrace()?.cacheHit).toBe(true);
  });

  it("concurrent analyzes of the same key share one Phase1 run", async () => {
    const buffer = makeSineBuffer({
      frequency: 196,
      durationSec: 0.5,
      amplitude: 0.25,
    });
    const [a, b] = await Promise.all([
      analyzeAndCacheRealPhase1({
        audioBuffer: buffer,
        cacheKey: "track-f",
        force: true,
      }),
      analyzeAndCacheRealPhase1({
        audioBuffer: buffer,
        cacheKey: "track-f",
        force: true,
      }),
    ]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});

describe("Stage 0: accuracy evaluation is not implied by cache tests", () => {
  it("golden cases are a separate Stage 6 contract", () => {
    expect(Array.isArray(MUSIC_ACCURACY_CASES)).toBe(true);
  });
});
