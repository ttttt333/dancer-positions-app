import { describe, expect, it } from "vitest";
import { analyzeSongStructureFromPeaks } from "./songStructureAnalysis";
import {
  changeTierPresetPool,
  generateFormationsFromStructure,
} from "./aiFormationFromStructure";
import type { DancerSpot } from "../types/choreography";

function makePeaks(durationSec: number, bpm: number): number[] {
  const n = 2048;
  const peaks: number[] = [];
  const beatsPerSec = bpm / 60;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * durationSec;
    // ビート + サビ風のエネルギー山（中盤）
    const beat = Math.abs(Math.sin(Math.PI * 2 * beatsPerSec * t));
    const chorus =
      t > durationSec * 0.4 && t < durationSec * 0.7 ? 0.8 : 0.2;
    peaks.push(0.3 * beat + chorus);
  }
  return peaks;
}

function seedDancers(n: number): DancerSpot[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `d${i}`,
    label: String(i + 1),
    xPct: 20 + i * 8,
    yPct: 50,
    colorIndex: i % 12,
  }));
}

describe("analyzeSongStructureFromPeaks", () => {
  it("builds 4-eight change points with RMS-style chorus tags", () => {
    const duration = 120;
    const bpm = 120;
    const analysis = analyzeSongStructureFromPeaks(
      makePeaks(duration, bpm),
      duration
    );
    expect(analysis.bpm).toBeGreaterThanOrEqual(60);
    expect(analysis.bpm).toBeLessThanOrEqual(200);
    expect(analysis.eight_grid.length).toBeGreaterThan(5);
    expect(analysis.change_points.length).toBeGreaterThan(0);
    for (const cp of analysis.change_points) {
      const eight = analysis.eight_grid.find((e) => e.index === cp.eight_index);
      expect(eight).toBeTruthy();
      expect(cp.time).toBe(eight!.start_time);
      expect(cp.eight_index % 4).toBe(0);
      expect(["major", "medium", "minor"]).toContain(cp.tier);
      expect(["CHORUS_START", "CHORUS", "VERSE"]).toContain(cp.section_type);
    }
    expect(analysis.change_points.some((c) => c.section_type === "CHORUS_START")).toBe(
      true
    );
    expect(analysis.song_dynamism).toBeGreaterThanOrEqual(0);
    expect(analysis.song_dynamism).toBeLessThanOrEqual(1);
  });
});

describe("generateFormationsFromStructure", () => {
  it("creates formations and cues on change points", () => {
    const duration = 90;
    const structure = analyzeSongStructureFromPeaks(
      makePeaks(duration, 128),
      duration
    );
    const result = generateFormationsFromStructure({
      analysis: structure,
      seedDancers: seedDancers(6),
      stageWidthMm: 12_000,
      stageDepthMm: 8_000,
    });
    expect(result.formations.length).toBeGreaterThan(0);
    expect(result.cues.length).toBe(result.formations.length);
    expect(result.reasoning.length).toBeGreaterThan(0);
    for (const c of result.cues) {
      expect(c.tEndSec).toBeGreaterThanOrEqual(c.tStartSec);
      expect(result.formations.some((f) => f.id === c.formationId)).toBe(true);
    }
  });

  it("exposes non-empty preset pools per tier", () => {
    expect(changeTierPresetPool("major").length).toBeGreaterThan(3);
    expect(changeTierPresetPool("medium").length).toBeGreaterThan(3);
    expect(changeTierPresetPool("minor").length).toBeGreaterThan(2);
  });
});
