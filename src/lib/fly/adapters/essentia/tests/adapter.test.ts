import { afterEach, describe, expect, it } from "vitest";
import {
  createEssentiaAdapter,
  createMockEssentiaRuntime,
  createUnavailableEssentiaRuntime,
  ESSENTIA_ADAPTER_ID,
  ESSENTIA_ADAPTER_VERSION,
  ESSENTIA_CAPABILITIES_BASE,
  mapEssentiaRawToFlyAnalyzerResult,
} from "../index";
import { setFlyEssentiaEnabledForTests } from "../../../featureFlags";
import type { FlyAudioInput } from "../../types";

function makeAudio(seconds = 4, sampleRate = 44100, bpm = 120): FlyAudioInput {
  const n = Math.floor(seconds * sampleRate);
  const samples = new Float32Array(n);
  const period = Math.floor((60 / bpm) * sampleRate);
  for (let i = 0; i < n; i += period) samples[i] = 1;
  return {
    samples,
    sampleRate,
    channels: 1,
    durationSeconds: seconds,
    audioHash: "test-hash",
    format: "pcm_f32",
  };
}

afterEach(() => {
  setFlyEssentiaEnabledForTests(null);
});

describe("Essentia adapter", () => {
  it("initializes and reports capabilities", async () => {
    setFlyEssentiaEnabledForTests(true);
    const adapter = createEssentiaAdapter({
      runtime: createMockEssentiaRuntime({ bpm: 128 }),
      ignoreFeatureFlag: true,
    });
    expect(adapter.id).toBe(ESSENTIA_ADAPTER_ID);
    expect(adapter.version).toBe(ESSENTIA_ADAPTER_VERSION);
    const runtime = await adapter.ensureRuntime();
    expect(runtime.available).toBe(true);
    expect(ESSENTIA_CAPABILITIES_BASE).toContain("tempo");
    expect(ESSENTIA_CAPABILITIES_BASE).toContain("beat");
  });

  it("maps raw Essentia result to FLY without inventing half/double time", () => {
    const mapped = mapEssentiaRawToFlyAnalyzerResult({
      bpm: 128,
      bpmConfidence: 0.94,
      beats: [0, 0.469, 0.938],
      beatConfidences: [0.9, 0.9, 0.9],
      downbeats: null,
      onsets: [{ time: 0, strength: 0.8 }],
      runtimeId: "mock",
      runtimeVersion: "essentia-mock-v0.1.0",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.tempo?.estimatedBpm).toBe(128);
    expect(mapped.tempo?.halfTimeProbability).toBeUndefined();
    expect(mapped.tempo?.doubleTimeProbability).toBeUndefined();
    expect(mapped.tempo?.stability).toBeUndefined();
    expect(mapped.beat?.source).toBe("essentia");
    expect(mapped.beat?.beats).toEqual([0, 0.469, 0.938]);
    expect(mapped.downbeats).toBeNull();
    expect(mapped.onsets?.length).toBe(1);
    expect(mapped.meta.source).toBe("essentia");
    expect(mapped.meta.capabilities).not.toContain("downbeat");
    expect(mapped.provenance?.some((p) => p.metric === "tempo")).toBe(true);
  });

  it("includes downbeat capability only when present", () => {
    const mapped = mapEssentiaRawToFlyAnalyzerResult({
      bpm: 100,
      beats: [0, 0.6],
      downbeats: [0],
      downbeatConfidences: [0.7],
      runtimeId: "mock",
      runtimeVersion: "v",
    });
    expect(mapped.meta.capabilities).toContain("downbeat");
    expect(mapped.downbeats?.[0]?.confidence).toBe(0.7);
  });

  it("handles unsupported audio", async () => {
    const adapter = createEssentiaAdapter({
      runtime: createMockEssentiaRuntime(),
      ignoreFeatureFlag: true,
    });
    const bad = await adapter.analyze({
      samples: new Float32Array(0),
      sampleRate: 44100,
      channels: 1,
      durationSeconds: 0,
    });
    expect(bad.ok).toBe(false);
    expect(bad.errorCode).toBe("essentia_unsupported_audio");
  });

  it("handles runtime unavailable", async () => {
    const adapter = createEssentiaAdapter({
      runtime: createUnavailableEssentiaRuntime("no wasm"),
      ignoreFeatureFlag: true,
    });
    const r = await adapter.analyze(makeAudio());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("essentia_unavailable");
  });

  it("respects feature flag off", async () => {
    setFlyEssentiaEnabledForTests(false);
    const adapter = createEssentiaAdapter({
      runtime: createMockEssentiaRuntime(),
    });
    const r = await adapter.analyze(makeAudio());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("essentia_disabled");
  });

  it("produces deterministic mock beats for same audio", async () => {
    setFlyEssentiaEnabledForTests(true);
    const adapter = createEssentiaAdapter({
      runtime: createMockEssentiaRuntime({ bpm: 120 }),
      ignoreFeatureFlag: true,
    });
    const a = await adapter.analyze(makeAudio(4));
    const b = await adapter.analyze(makeAudio(4));
    expect(a.ok && b.ok).toBe(true);
    expect(a.beat?.beats).toEqual(b.beat?.beats);
    expect(a.tempo?.estimatedBpm).toBe(120);
  });
});
