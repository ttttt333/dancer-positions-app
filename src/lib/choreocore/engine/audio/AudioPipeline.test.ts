/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  ANALYSIS_VERSION,
  analyzeAudio,
  AudioAnalysisError,
  decodeAudio,
  summarizeAnalysis,
} from "../index";
import {
  generateAmplitudeEnvelope,
  generateClickTrack,
  generateSineWave,
  makeQuietThenHit,
} from "./testBuffers";

describe("AudioPipeline", () => {
  it("uses analysisVersion 3.0.0-phase1", () => {
    expect(ANALYSIS_VERSION).toBe("3.0.0-phase1");
  });

  it("throws a typed error for an empty buffer", async () => {
    await expect(
      analyzeAudio({
        sampleRate: 22050,
        length: 0,
        numberOfChannels: 1,
        duration: 0,
        getChannelData: () => new Float32Array(0),
      })
    ).rejects.toMatchObject({ code: "EMPTY_BUFFER" });
  });

  it("decodeAudio throws on empty bytes without needing Web Audio", async () => {
    await expect(decodeAudio(new ArrayBuffer(0))).rejects.toBeInstanceOf(
      AudioAnalysisError
    );
  });

  it("energy rises when amplitude ramps up", async () => {
    const buffer = generateAmplitudeEnvelope({
      frequency: 220,
      duration: 1.2,
      startAmp: 0.05,
      endAmp: 0.9,
    });
    const result = await analyzeAudio(buffer);
    const curve = result.energyCurve;
    const early = curve.points[Math.floor(curve.points.length * 0.1)]!;
    const late = curve.points[Math.floor(curve.points.length * 0.9)]!;
    expect(late.value).toBeGreaterThan(early.value + 15);
  });

  it("detects a sudden hit in a quiet signal", async () => {
    const buffer = makeQuietThenHit({ durationSec: 1.5, hitTimeSec: 0.8 });
    const result = await analyzeAudio(buffer);
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => Math.abs(h.time - 0.8) < 0.2)).toBe(true);
  });

  it("TEST 16: the same input is deterministic", async () => {
    const buffer = generateSineWave({
      frequency: 330,
      duration: 0.8,
      amplitude: 0.4,
    });
    const a = await analyzeAudio(buffer);
    const b = await analyzeAudio(buffer);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("TEST 17: full pipeline returns a valid Phase 1 result", async () => {
    const buffer = generateClickTrack({ bpm: 120, duration: 4 });
    const result = await analyzeAudio(buffer);
    expect(result.analysisVersion).toBe("3.0.0-phase1");
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.energyCurve.points.length).toBe(result.frames.length);
    expect(result.tempo.bpm).toBeGreaterThan(0);
    expect(result.beats.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(3.5);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    const summary = summarizeAnalysis(result);
    expect(summary.frameCount).toBe(result.frames.length);
    expect(summary.beatCount).toBe(result.beats.length);
  });

  it("integration: 10s synthetic click audio", async () => {
    const buffer = generateClickTrack({ bpm: 120, duration: 10 });
    const result = await analyzeAudio(buffer);
    expect(result.duration).toBeGreaterThan(9.9);
    expect(result.duration).toBeLessThan(10.1);
    expect(result.tempo.bpm).toBeGreaterThanOrEqual(118);
    expect(result.tempo.bpm).toBeLessThanOrEqual(122);
    expect(result.beats.length).toBeGreaterThan(0);
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.energyCurve.points.length).toBeGreaterThan(0);
  });
});
