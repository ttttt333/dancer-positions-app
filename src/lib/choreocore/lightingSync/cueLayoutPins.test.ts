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
  it("parses サビはV字 as chorus pin", () => {
    const pins = parseCueLayoutPins("最初と最後はピラミッド、サビはV字");
    expect(pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "first", layoutId: "pyramid" }),
        expect.objectContaining({ slot: "last", layoutId: "pyramid" }),
        expect.objectContaining({ slot: "chorus", layoutId: "vee" }),
      ])
    );
    expect(formatCueLayoutPins(pins)).toContain("サビ=V字");
  });

  it("resolves chorus pin by section label / reason codes", () => {
    const pins = parseCueLayoutPins("サビはV字");
    expect(
      resolvePinnedLayoutForCue({
        pins,
        cueIndex: 2,
        cueCount: 6,
        sectionLabel: "CHORUS",
      })
    ).toBe("vee");
    expect(
      resolvePinnedLayoutForCue({
        pins,
        cueIndex: 2,
        cueCount: 6,
        reasonCodes: ["CHORUS_START", "PROMOTED_SECTION_CHANGE"],
      })
    ).toBe("vee");
    expect(
      resolvePinnedLayoutForCue({
        pins,
        cueIndex: 1,
        cueCount: 6,
        sectionLabel: "A_MELO",
      })
    ).toBeNull();
  });

  it("locks chorus cues to vee when creator note says サビはV字", () => {
    setMusicEnginePhase12EnabledForTests(false);
    let k = createEmptySuggestKnowledge();
    k = accumulateSuggestKnowledge(k, {
      isResuggest: false,
      creatorNote: "最初はピラミッド、サビはV字、最後は千鳥",
    });
    expect(k.cueLayoutPins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: "first", layoutId: "pyramid" }),
        expect.objectContaining({ slot: "chorus", layoutId: "vee" }),
        expect.objectContaining({ slot: "last", layoutId: "stagger" }),
      ])
    );
    const tasteBias = applyKnowledgeToTaste(
      resolveSuggestTaste({
        note: "最初はピラミッド、サビはV字、最後は千鳥",
      }),
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
      peaks: Array.from({ length: 128 }, (_, i) => (i % 8 === 0 ? 0.9 : 0.2)),
      durationSec: 96,
      bpm: 120,
      structureV2: {
        bpm: 120,
        duration: 96,
        source: "test",
        sections: [
          {
            label: "INTRO",
            start_eight: 0,
            end_eight: 2,
            start_time: 0,
            end_time: 8,
            cluster_id: 0,
            mean_energy: 0.3,
            energy_trend: 0,
            repeat_count: 1,
            confidence: 0.8,
          },
          {
            label: "A_MELO",
            start_eight: 2,
            end_eight: 4,
            start_time: 8,
            end_time: 16,
            cluster_id: 1,
            mean_energy: 0.4,
            energy_trend: 0.01,
            repeat_count: 1,
            confidence: 0.8,
          },
          {
            label: "B_MELO",
            start_eight: 4,
            end_eight: 6,
            start_time: 16,
            end_time: 24,
            cluster_id: 2,
            mean_energy: 0.55,
            energy_trend: 0.05,
            repeat_count: 1,
            confidence: 0.85,
          },
          {
            label: "CHORUS",
            start_eight: 6,
            end_eight: 10,
            start_time: 24,
            end_time: 40,
            cluster_id: 3,
            mean_energy: 0.9,
            energy_trend: 0,
            repeat_count: 2,
            confidence: 0.95,
          },
          {
            label: "A_MELO",
            start_eight: 10,
            end_eight: 14,
            start_time: 40,
            end_time: 56,
            cluster_id: 1,
            mean_energy: 0.4,
            energy_trend: 0,
            repeat_count: 2,
            confidence: 0.8,
          },
          {
            label: "CHORUS",
            start_eight: 14,
            end_eight: 18,
            start_time: 56,
            end_time: 72,
            cluster_id: 3,
            mean_energy: 0.92,
            energy_trend: 0,
            repeat_count: 2,
            confidence: 0.95,
          },
          {
            label: "OUTRO",
            start_eight: 18,
            end_eight: 24,
            start_time: 72,
            end_time: 96,
            cluster_id: 4,
            mean_energy: 0.35,
            energy_trend: -0.02,
            repeat_count: 1,
            confidence: 0.8,
          },
        ],
        change_points: [],
      },
      seedDancers: seeds,
      profile: CLASS_ADVANCED_MON7,
      tasteBias,
      targetCueCount: 7,
    });
    expect(result).not.toBeNull();
    const forms = result!.lightingSyncPayload.formations;
    const cues = [...result!.cues].sort((a, b) => a.tStartSec - b.tStartSec);
    expect(forms[0]?.layoutPresetId).toBe("pyramid");
    expect(forms[forms.length - 1]?.layoutPresetId).toBe("stagger");
    const chorusLayouts = forms.filter((_, i) => {
      const t = cues[i]?.tStartSec ?? forms[i]?.timestamp ?? -1;
      return (t >= 24 && t < 40) || (t >= 56 && t < 72);
    });
    expect(chorusLayouts.length).toBeGreaterThan(0);
    for (const f of chorusLayouts) {
      expect(f.layoutPresetId).toBe("vee");
    }
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
