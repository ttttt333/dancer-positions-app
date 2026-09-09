import { afterEach, describe, expect, it } from "vitest";
import type { StructureResultV2 } from "../../../../choreocore/types/songStructure";
import { librosaResultFromStructureV2 } from "../../librosa/adapter";
import {
  createEssentiaAdapter,
  createMockEssentiaRuntime,
  createUnavailableEssentiaRuntime,
} from "../index";
import { fuseAnalyzerResults } from "../../../fusionMulti";
import { fuseWithOptionalEssentia } from "../../../ensemble";
import { setFlyEssentiaEnabledForTests } from "../../../featureFlags";
import { fuseToStructureV2 } from "../../../fusion";

const sampleV2: StructureResultV2 = {
  bpm: 120,
  duration: 16,
  eight_times: [0, 4, 8, 12],
  sections: [
    {
      label: "INTRO",
      start_eight: 0,
      end_eight: 2,
      start_time: 0,
      end_time: 8,
      cluster_id: 0,
      mean_energy: 0.3,
      energy_trend: 0.1,
      repeat_count: 1,
      confidence: 0.8,
    },
  ],
  change_points: [
    {
      time: 8,
      eight_index: 2,
      type: "CHORUS",
      is_major: true,
      confidence: 0.9,
    },
  ],
  source: "chroma-ssm",
  beats: Array.from({ length: 32 }, (_, i) => i * 0.5),
};

afterEach(() => {
  setFlyEssentiaEnabledForTests(null);
});

describe("FLY multi-analyzer fusion Phase 4", () => {
  it("keeps existing librosa result valid", () => {
    const librosa = librosaResultFromStructureV2({
      structureV2: sampleV2,
      audioHash: "h",
    });
    expect(librosa.ok).toBe(true);
    expect(librosa.tempo?.estimatedBpm).toBe(120);
    expect(librosa.beat?.beats?.length).toBe(32);
  });

  it("accepts multiple analyzer results with provenance", async () => {
    const librosa = librosaResultFromStructureV2({
      structureV2: sampleV2,
      audioHash: "h",
    });
    const essentia = await createEssentiaAdapter({
      runtime: createMockEssentiaRuntime({ bpm: 120 }),
      ignoreFeatureFlag: true,
    }).analyze({
      samples: new Float32Array(44100 * 2),
      sampleRate: 44100,
      channels: 1,
      durationSeconds: 2,
    });

    const fused = fuseAnalyzerResults({
      analyzers: [librosa, essentia],
      legacy: { structureV2: sampleV2, audioHash: "h" },
      audioHash: "h",
    });

    expect(fused.structureV2?.bpm).toBe(120);
    expect(fused.fly?.structureV2Compatible).toBe(true);
    expect(fused.provenance.some((p) => p.metric === "tempo")).toBe(true);
    const tempoProv = fused.provenance.find((p) => p.metric === "tempo")!;
    expect(tempoProv.sources.map((s) => s.analyzer).sort()).toEqual([
      "essentia",
      "librosa",
    ]);
    expect(fused.sourceAgreement).toBeGreaterThan(0.5);
    expect(fused.determinism?.fusionVersion).toBeTruthy();
  });

  it("falls back when Essentia unavailable — Formation contract unchanged", async () => {
    setFlyEssentiaEnabledForTests(true);
    const baseline = fuseToStructureV2({ structureV2: sampleV2 });
    await fuseWithOptionalEssentia({
      structureV2: sampleV2,
      audioHash: "h",
      audio: {
        samples: new Float32Array(8000),
        sampleRate: 8000,
        channels: 1,
        durationSeconds: 1,
      },
    });
    const librosa = librosaResultFromStructureV2({ structureV2: sampleV2 });
    const essFail = await createEssentiaAdapter({
      runtime: createUnavailableEssentiaRuntime(),
      ignoreFeatureFlag: true,
    }).analyze({
      samples: new Float32Array(8000),
      sampleRate: 8000,
      channels: 1,
      durationSeconds: 1,
    });
    const withFail = fuseAnalyzerResults({
      analyzers: [librosa, essFail],
      legacy: { structureV2: sampleV2, audioHash: "h" },
    });
    expect(withFail.structureV2?.bpm).toBe(baseline.bpm);
    expect(withFail.structureV2?.sections.length).toBe(baseline.sections.length);
    expect(withFail.degraded).toBe(true);
    expect(withFail.notes.some((n) => n.includes("essentia"))).toBe(true);
  });

  it("Formation Engine receives unchanged compatible contract from fusion", () => {
    const librosa = librosaResultFromStructureV2({ structureV2: sampleV2 });
    const fused = fuseAnalyzerResults({
      analyzers: [librosa],
      legacy: { structureV2: sampleV2, audioHash: "h" },
    });
    expect(fused.structureV2?.bpm).toBe(sampleV2.bpm);
    expect(fused.structureV2?.eight_times).toEqual(sampleV2.eight_times);
    expect(fused.fly?.structureV2Compatible).toBe(true);
  });
});
