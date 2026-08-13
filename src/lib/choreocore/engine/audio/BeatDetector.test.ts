/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { HOP_SIZE } from "../constants";
import { analyzeAudio } from "./AudioAnalyzer";
import { detectBeats, estimateTempo } from "./BeatDetector";
import { generateClickTrack } from "./testBuffers";

describe("BeatDetector", () => {
  it("TEST 12: synthetic 120 BPM click track is within ±2 BPM", async () => {
    const buffer = generateClickTrack({ bpm: 120, duration: 8 });
    const result = await analyzeAudio(buffer);
    const envelope = result.frames.map((f) => f.onsetStrength);
    const tempo = estimateTempo(envelope, buffer.sampleRate, HOP_SIZE);
    expect(tempo.bpm).toBeGreaterThanOrEqual(118);
    expect(tempo.bpm).toBeLessThanOrEqual(122);
    expect(tempo.confidence).toBeGreaterThan(0);
  });

  it("TEST 13: beat interval matches the known tempo", async () => {
    const buffer = generateClickTrack({ bpm: 120, duration: 6 });
    const result = await analyzeAudio(buffer);
    const envelope = result.frames.map((f) => f.onsetStrength);
    const hopSec = HOP_SIZE / buffer.sampleRate;
    const beats = detectBeats(
      envelope,
      result.tempo,
      result.duration,
      hopSec
    );
    expect(beats.length).toBeGreaterThan(4);
    const expected = 60 / result.tempo.bpm;
    const interval = beats[4]!.time - beats[3]!.time;
    expect(Math.abs(interval - expected)).toBeLessThan(0.08);
  });

  it("TEST 14: beatInBar repeats 0,1,2,3", async () => {
    const buffer = generateClickTrack({ bpm: 120, duration: 8 });
    const result = await analyzeAudio(buffer);
    expect(result.beats.length).toBeGreaterThanOrEqual(16);
    const sixteen = result.beats.slice(0, 16);
    expect(sixteen.map((b) => b.beatInBar)).toEqual(
      Array.from({ length: 16 }, (_, i) => i % 4)
    );
    expect(sixteen[0]!.barIndex).toBe(0);
    expect(sixteen[4]!.barIndex).toBe(1);
  });
});
