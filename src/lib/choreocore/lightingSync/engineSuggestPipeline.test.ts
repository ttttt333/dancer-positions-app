import { describe, expect, it } from "vitest";
import { CLASS_ADVANCED_MON7 } from "./classProfiles";
import { resolveSuggestTaste } from "./suggestTaste";
import { phase1FromPeaks, runEngineAppSuggest } from "./engineSuggestPipeline";
import type { DancerSpot } from "../../types/choreography";

function peaksWithChorus(duration = 80, bpm = 120): number[] {
  const n = 400;
  const out: number[] = [];
  const bps = bpm / 60;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * duration;
    const beat = Math.abs(Math.sin(Math.PI * 2 * bps * t));
    const chorus = t > 24 && t < 48 ? 0.85 : 0.22;
    const drop = t > 48 && t < 56 ? 0.95 : 0;
    out.push(0.25 * beat + chorus + drop);
  }
  return out;
}

function seeds(n = 6): DancerSpot[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `dancer-${i + 1}`,
    label: String(i + 1),
    xPct: 20 + (i % 3) * 20,
    yPct: 30 + Math.floor(i / 3) * 20,
    colorIndex: i % 12,
  }));
}

describe("engineSuggestPipeline", () => {
  it("builds phase1 whose duration matches the song", () => {
    const phase1 = phase1FromPeaks(peaksWithChorus(64), 64, 128);
    expect(phase1.duration).toBeGreaterThan(60);
    expect(phase1.tempo.bpm).toBe(128);
    expect(phase1.beats.length).toBeGreaterThan(10);
  });

  it("returns formations keyed by seed dancer ids", () => {
    const people = seeds(6);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 0, time: 0, score: 0.4, tier: "minor" },
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 16, time: 32, score: 0.8, tier: "major", section_type: "CHORUS" },
        { eight_index: 24, time: 48, score: 0.7, tier: "medium" },
      ],
      seedDancers: people,
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic", vibes: ["energetic"] }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    expect(result!.formations.length).toBeGreaterThan(1);
    const ids = people.map((p) => p.id).sort();
    for (const f of result!.formations) {
      expect(f.dancers.map((d) => d.id).sort()).toEqual(ids);
    }
    expect(result!.cues.length).toBe(result!.formations.length);
    expect(result!.reasoning.some((l) => l.includes("曲理解エンジン"))).toBe(true);
  });

  it("respects target cue count as an upper bound", () => {
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(90),
      durationSec: 90,
      bpm: 128,
      remoteChangePoints: Array.from({ length: 20 }, (_, i) => ({
        eight_index: i * 2,
        time: i * 4,
        score: 0.6 + (i % 3) * 0.1,
        tier: i % 4 === 0 ? ("major" as const) : ("medium" as const),
      })),
      seedDancers: seeds(8),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({}),
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.formations.length).toBeLessThanOrEqual(6);
    expect(result!.evaluation.cues.length).toBeGreaterThan(0);
    expect(result!.evaluation.formationRankings.length).toBe(result!.formations.length);
  });
});
