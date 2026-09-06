import { describe, expect, it } from "vitest";
import {
  formatCueLayoutPins,
  parseCueLayoutPins,
  resolvePinnedLayoutForCue,
} from "./cueLayoutPins";
import {
  accumulateSuggestKnowledge,
  applyKnowledgeToTaste,
  createEmptySuggestKnowledge,
} from "./suggestKnowledge";
import { resolveSuggestTaste } from "./suggestTaste";
import { runEngineAppSuggest } from "./engineSuggestPipeline";
import { CLASS_ADVANCED_MON7 } from "./classProfiles";
import { setMusicEnginePhase12EnabledForTests } from "./musicEngineFlag";

describe("cueLayoutPins", () => {
  it("parses 最初と最後はピラミッド", () => {
    const pins = parseCueLayoutPins("最初と最後はピラミッドにしてほしい");
    expect(pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "first", layoutId: "pyramid" }),
        expect.objectContaining({ slot: "last", layoutId: "pyramid" }),
      ])
    );
    expect(formatCueLayoutPins(pins)).toContain("最初=ピラミッド");
    expect(formatCueLayoutPins(pins)).toContain("最後=ピラミッド");
  });

  it("parses separate first/last layouts", () => {
    const pins = parseCueLayoutPins("最初は千鳥。最後はV字。");
    expect(pins.find((p) => p.slot === "first")?.layoutId).toBe("stagger");
    expect(pins.find((p) => p.slot === "last")?.layoutId).toBe("vee");
  });

  it("resolves pin to first and last cue indices", () => {
    const pins = parseCueLayoutPins("最初と最後はピラミッド");
    expect(
      resolvePinnedLayoutForCue({
        pins,
        cueIndex: 0,
        cueCount: 5,
      })
    ).toBe("pyramid");
    expect(
      resolvePinnedLayoutForCue({
        pins,
        cueIndex: 2,
        cueCount: 5,
      })
    ).toBeNull();
    expect(
      resolvePinnedLayoutForCue({
        pins,
        cueIndex: 4,
        cueCount: 5,
      })
    ).toBe("pyramid");
  });

  it("flows into tasteBias and locks first/last layouts in engine", () => {
    setMusicEnginePhase12EnabledForTests(false);
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: true,
      feedback: { note: "最初と最後はピラミッド" },
    });
    expect(k.cueLayoutPins).toHaveLength(2);
    const tasteBias = applyKnowledgeToTaste(resolveSuggestTaste(undefined), k);
    expect(tasteBias.cueLayoutPins?.map((p) => p.layoutId)).toEqual([
      "pyramid",
      "pyramid",
    ]);

    const seeds = Array.from({ length: 8 }, (_, i) => ({
      id: `d${i}`,
      label: String(i + 1),
      xPct: 20 + i * 8,
      yPct: 40,
      colorIndex: i,
    }));
    const result = runEngineAppSuggest({
      peaks: Array.from({ length: 64 }, (_, i) => (i % 8 === 0 ? 0.9 : 0.2)),
      durationSec: 64,
      bpm: 120,
      remoteChangePoints: Array.from({ length: 8 }, (_, i) => ({
        eight_index: i * 2,
        time: i * 8,
        score: 0.8,
        tier: "major" as const,
      })),
      seedDancers: seeds,
      profile: CLASS_ADVANCED_MON7,
      tasteBias,
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    const layouts = result!.lightingSyncPayload.formations.map(
      (f) => f.layoutPresetId
    );
    expect(layouts[0]).toBe("pyramid");
    expect(layouts[layouts.length - 1]).toBe("pyramid");
  });

  it("applies creatorNote pins on first suggest (isResuggest=false)", () => {
    setMusicEnginePhase12EnabledForTests(false);
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: false,
      creatorNote: "最初と最後はピラミッドにしてほしい",
    });
    expect(k.attempt).toBe(0);
    expect(k.cueLayoutPins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "first", layoutId: "pyramid" }),
        expect.objectContaining({ slot: "last", layoutId: "pyramid" }),
      ])
    );
    expect(k.summary).toContain("初回指示");

    const tasteBias = applyKnowledgeToTaste(
      resolveSuggestTaste({ note: "最初と最後はピラミッドにしてほしい" }),
      k
    );
    const seeds = Array.from({ length: 8 }, (_, i) => ({
      id: `d${i}`,
      label: String(i + 1),
      xPct: 20 + i * 8,
      yPct: 40,
      colorIndex: i,
    }));
    const result = runEngineAppSuggest({
      peaks: Array.from({ length: 64 }, (_, i) => (i % 8 === 0 ? 0.9 : 0.2)),
      durationSec: 64,
      bpm: 120,
      remoteChangePoints: Array.from({ length: 8 }, (_, i) => ({
        eight_index: i * 2,
        time: i * 8,
        score: 0.8,
        tier: "major" as const,
      })),
      seedDancers: seeds,
      profile: CLASS_ADVANCED_MON7,
      tasteBias,
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    const layouts = result!.lightingSyncPayload.formations.map(
      (f) => f.layoutPresetId
    );
    expect(layouts[0]).toBe("pyramid");
    expect(layouts[layouts.length - 1]).toBe("pyramid");
  });

  it("keeps initial creator pins when feedback adds another pin", () => {
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: false,
      creatorNote: "最初は千鳥",
    });
    k = accumulateSuggestKnowledge(k, {
      isResuggest: true,
      creatorNote: "最初は千鳥",
      feedback: { note: "最後はV字" },
    });
    expect(k.cueLayoutPins.find((p) => p.slot === "first")?.layoutId).toBe(
      "stagger"
    );
    expect(k.cueLayoutPins.find((p) => p.slot === "last")?.layoutId).toBe(
      "vee"
    );
  });
});
