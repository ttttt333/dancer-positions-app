import { describe, expect, it } from "vitest";
import {
  accumulateSuggestKnowledge,
  applyKnowledgeToTaste,
  createEmptySuggestKnowledge,
  inferKnowledgeFromNote,
  knowledgeVarietySalt,
  snapshotSuggestKnowledge,
} from "./suggestKnowledge";
import { resolveSuggestTaste } from "./suggestTaste";
import { rankLayoutPresets } from "./layoutPresetBridge";

describe("suggestKnowledge accumulation", () => {
  it("increments attempt and keeps avoid layout ids across resuggests", () => {
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: true,
      feedback: { preferMoreImpact: true },
      rejectedLayoutIds: ["grid", "two_rows"],
    });
    expect(k.attempt).toBe(1);
    expect(k.avoidLayoutIds).toEqual(
      expect.arrayContaining(["grid", "two_rows"])
    );
    expect(k.flags.preferMoreImpact).toBe(true);

    k = accumulateSuggestKnowledge(k, {
      isResuggest: true,
      feedback: { preferMoreImpact: true, note: "まだ四角っぽい" },
      rejectedLayoutIds: ["columns_3"],
    });
    expect(k.attempt).toBe(2);
    expect(k.avoidLayoutIds).toEqual(
      expect.arrayContaining(["grid", "two_rows", "columns_3"])
    );
    expect(k.avoidFlatGrid).toBe(true);
  });

  it("same feedback yields different variety salt by attempt", () => {
    const fb = { preferLessMovement: true as const };
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, { isResuggest: true, feedback: fb });
    const s1 = knowledgeVarietySalt(k, fb);
    k = accumulateSuggestKnowledge(k, { isResuggest: true, feedback: fb });
    const s2 = knowledgeVarietySalt(k, fb);
    expect(s1).not.toBe(s2);
  });

  it("inferKnowledgeFromNote detects outro climax and flat grid complaints", () => {
    const inferred = inferKnowledgeFromNote("ラストが四角でつまらない");
    expect(inferred.outroClimax).toBe(true);
    expect(inferred.avoidFlatGrid).toBe(true);
    expect(inferred.preferPatterns).toEqual(
      expect.arrayContaining(["vee"])
    );
  });

  it("applyKnowledgeToTaste pushes avoidLayoutIds into ranking pool filter", () => {
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: true,
      feedback: { preferMoreImpact: true, note: "グリッドはやめて" },
      rejectedLayoutIds: ["grid"],
    });
    const bias = applyKnowledgeToTaste(resolveSuggestTaste(undefined), k);
    expect(bias.avoidLayoutIds).toContain("grid");
    expect(bias.outroClimax || bias.avoidFlatGrid).toBe(true);

    const ranked = rankLayoutPresets(
      {
        family: "vee",
        sectionType: "outro",
        salt: 3,
        dancerCount: 8,
        allowCross: true,
        taste: bias,
        cueAction: "MAJOR_CHANGE",
        songSection: {
          label: "OUTRO",
          start_eight: 20,
          end_eight: 24,
          start_time: 80,
          end_time: 96,
          cluster_id: 1,
          mean_energy: 0.4,
          energy_trend: -0.01,
          repeat_count: 1,
          confidence: 0.8,
        },
      },
      12
    );
    // 知見で避けた雛形は上位から消える（プール枯渇時を除く）
    expect(ranked[0]).not.toBe("grid");
  });

  it("snapshotSuggestKnowledge exposes attempt and avoid list for UI", () => {
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: true,
      feedback: { preferLessMovement: true },
      rejectedLayoutIds: ["grid", "stagger"],
    });
    const snap = snapshotSuggestKnowledge(k);
    expect(snap.attempt).toBe(1);
    expect(snap.avoidLayoutIds).toEqual(expect.arrayContaining(["grid", "stagger"]));
    expect(snap.flags.preferLessMovement).toBe(true);
  });
});
