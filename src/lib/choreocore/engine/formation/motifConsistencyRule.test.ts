import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateMotifAndDynamicsScore,
  motifRegistry,
} from "./motifConsistencyRule";
import type { SongSectionV2 } from "../../types/songStructure";
import { scorePresetAgainstGoldenRules } from "./goldenFormationFilter";

describe("motifConsistencyRule", () => {
  beforeEach(() => {
    motifRegistry.clear();
  });

  const dummyChorusSection: SongSectionV2 = {
    label: "CHORUS",
    start_eight: 8,
    end_eight: 16,
    start_time: 32.0,
    end_time: 64.0,
    cluster_id: 1,
    mean_energy: 0.8,
    energy_trend: 0.001,
    repeat_count: 2,
    confidence: 0.9,
  };

  it("同一クラスタの初回選出カテゴリに一貫性ボーナスが付与されること", () => {
    motifRegistry.register(1, "V_SHAPE");

    const scoreMatch = evaluateMotifAndDynamicsScore({
      section: dummyChorusSection,
      presetCategory: "V_SHAPE",
      presetRadiusOrWidth: 3.0,
    });

    const scoreMismatch = evaluateMotifAndDynamicsScore({
      section: dummyChorusSection,
      presetCategory: "CIRCULAR",
      presetRadiusOrWidth: 3.0,
    });

    expect(scoreMatch).toBeGreaterThan(scoreMismatch);
    expect(scoreMatch).toBe(0.25);
    expect(scoreMismatch).toBe(-0.15);
  });

  it("BREAKDOWN セクションでコンパクトな隊形が優遇されること", () => {
    const breakdownSection: SongSectionV2 = {
      ...dummyChorusSection,
      label: "BREAKDOWN",
      mean_energy: 0.15,
    };

    const scoreCompact = evaluateMotifAndDynamicsScore({
      section: breakdownSection,
      presetCategory: "GRID",
      presetRadiusOrWidth: 1.5,
    });

    expect(scoreCompact).toBeGreaterThan(0);
  });

  it("B_MELO / energy_trend 上昇で広い隊形にボーナスが付くこと", () => {
    const buildSection: SongSectionV2 = {
      ...dummyChorusSection,
      label: "B_MELO",
      cluster_id: 2,
      mean_energy: 0.55,
      energy_trend: 0.02,
    };
    const wide = evaluateMotifAndDynamicsScore({
      section: buildSection,
      presetCategory: "WING_SPREAD",
      presetRadiusOrWidth: 4.0,
    });
    const narrow = evaluateMotifAndDynamicsScore({
      section: buildSection,
      presetCategory: "TIGHT_CLUSTER",
      presetRadiusOrWidth: 1.2,
    });
    expect(wide).toBeGreaterThan(narrow);
    expect(wide).toBe(0.1);
  });

  it("golden filter 経由でもモチーフ補正が加算されること", () => {
    motifRegistry.register(1, "V_SHAPE");
    const match = scorePresetAgainstGoldenRules(
      { id: "vee" },
      undefined,
      undefined,
      { section: dummyChorusSection }
    );
    const miss = scorePresetAgainstGoldenRules(
      { id: "cluster_tight" },
      undefined,
      undefined,
      { section: dummyChorusSection }
    );
    expect(match.scoreAdjustment).toBeGreaterThan(miss.scoreAdjustment);
  });
});
