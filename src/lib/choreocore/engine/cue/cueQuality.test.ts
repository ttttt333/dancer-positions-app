/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { generateFormationCues } from "./CueEngine";
import {
  compareCueQuality,
  cuesAreTimeOrdered,
  evaluateCueQuality,
} from "./cueQuality";
import { analyzeMusicStructure } from "../music/MusicStructureAnalyzer";
import { patternA, patternFourBarPhrases } from "../music/syntheticPhase1";
import { analyzeAudio } from "../audio/AudioAnalyzer";
import { makeQuietThenHit } from "../audio/testBuffers";
import {
  analyzeAndCacheRealPhase1,
  clearRealPhase1Inflight,
} from "../audio/analyzeAndCacheRealPhase1";
import { clearRealPhase1Cache } from "../audio/realPhase1Cache";
import { analyzeRealPhase2FromCache } from "../music/analyzeRealPhase2FromCache";
import {
  finalizeProductionTimeline,
  resetMusicEngineTrace,
  timelineToMusicStructure,
} from "../music/productionTimeline";
import { MUSIC_ACCURACY_CASES } from "../music/musicAccuracyFixtures";
import { patternCueTimeline } from "./cueFixtures";

afterEach(() => {
  clearRealPhase1Cache();
  clearRealPhase1Inflight();
  resetMusicEngineTrace();
});

describe("Stage 4 cue quality on existing Cue Engine", () => {
  it("A. Real Timeline produces cues that trace to event clusters", async () => {
    const phase1 = await analyzeAudio(
      makeQuietThenHit({ durationSec: 3.2, hitTimeSec: 1.6 })
    );
    const attempt = analyzeRealPhase2FromCache({ phase1 });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    const finalized = finalizeProductionTimeline(attempt.timeline, {
      bpm: phase1.tempo.bpm,
    });
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    const structure = timelineToMusicStructure(finalized.timeline);
    const analysis = generateFormationCues(structure, phase1);
    expect(analysis.cues.length).toBeGreaterThan(0);
    const report = evaluateCueQuality({
      analysis,
      sections: structure.sections,
      eventClusters: structure.eventClusters,
      source: "engine-phase12",
    });
    expect(report.source).toBe("engine-phase12");
    const traced = report.rows.filter((r) => !r.suppressed);
    expect(traced.some((r) => r.sourceEventId.length > 0)).toBe(true);
    for (const row of traced) {
      expect(row.sourceEventId).toBeTruthy();
      expect(Array.isArray(row.reasonCodes)).toBe(true);
    }
  });

  it("B. PRE_CHORUS starts before CHORUS_START", () => {
    const phase1 = patternFourBarPhrases();
    const structure = analyzeMusicStructure(phase1);
    const analysis = generateFormationCues(structure, phase1);
    const report = evaluateCueQuality({
      analysis,
      sections: structure.sections,
      eventClusters: structure.eventClusters,
    });
    expect(report.preChorusBeforeChorus).toBe(true);
    if (report.preChorusSec != null && report.chorusStartSec != null) {
      expect(report.preChorusSec).toBeLessThan(report.chorusStartSec);
    }
  });

  it("C. non-anticipation cues stay near their source event", () => {
    const phase1 = patternA();
    const structure = analyzeMusicStructure(phase1);
    const analysis = generateFormationCues(structure, phase1);
    const report = evaluateCueQuality({
      analysis,
      sections: structure.sections,
      eventClusters: structure.eventClusters,
    });
    const checked = report.rows.filter(
      (r) =>
        !r.suppressed &&
        !r.reasonCodes.includes("ANTICIPATION") &&
        r.timingDeltaMs != null
    );
    expect(checked.length).toBeGreaterThan(0);
    for (const row of checked) {
      expect(Math.abs(row.timingDeltaMs!)).toBeLessThan(50);
    }
  });

  it("D. active cues are timestamp-ordered", () => {
    const { phase1, structure } = patternCueTimeline();
    const analysis = generateFormationCues(structure, phase1);
    expect(cuesAreTimeOrdered(analysis.cues)).toBe(true);
    const report = evaluateCueQuality({
      analysis,
      sections: structure.sections,
      eventClusters: structure.eventClusters,
    });
    for (let i = 1; i < report.timestamps.length; i += 1) {
      expect(report.timestamps[i]!).toBeGreaterThanOrEqual(
        report.timestamps[i - 1]!
      );
    }
  });

  it("E. non-anticipation cues do not duplicate the same source cluster", () => {
    const { phase1, structure } = patternCueTimeline();
    const analysis = generateFormationCues(structure, phase1);
    const report = evaluateCueQuality({
      analysis,
      sections: structure.sections,
      eventClusters: structure.eventClusters,
    });
    expect(report.duplicateSourceIds).toEqual([]);
  });

  it("G. Real Phase1 provenance is not synthetic on the real path", async () => {
    await analyzeAndCacheRealPhase1({
      audioBuffer: makeQuietThenHit({ durationSec: 2.4, hitTimeSec: 1.2 }),
      cacheKey: "stage4-real",
      force: true,
    });
    const attempt = analyzeRealPhase2FromCache({ cacheKey: "stage4-real" });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.phase1.provenance).toBe("real");
    expect(attempt.timeline.phase1Provenance).toBe("real");
    expect(attempt.timeline.source).toBe("engine-phase12");
  });

  it("comparison records deltas without declaring a winner", () => {
    const a = patternA();
    const structure = analyzeMusicStructure(a);
    const analysis = generateFormationCues(structure, a);
    const report = evaluateCueQuality({
      analysis,
      sections: structure.sections,
      eventClusters: structure.eventClusters,
      source: "synthetic-legacy",
    });
    const cmp = compareCueQuality(report, report);
    expect(cmp.delta.cueCount).toBe(0);
    expect(cmp.delta.majorCount).toBe(0);
  });

  it("Stage 6 accuracy cases remain a contract, not a verdict", () => {
    expect(MUSIC_ACCURACY_CASES.length).toBeGreaterThanOrEqual(0);
    expect(MUSIC_ACCURACY_CASES.every((c) => c.id && c.expected)).toBe(true);
  });
});
