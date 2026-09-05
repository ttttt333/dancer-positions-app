/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { makeCluster, makeStructure, section } from "../cue/cueFixtures";
import {
  generateChoreographicIntentSequence,
} from "../intent/ChoreographicIntentEngine";
import type { FormationCue } from "../types/CueTypes";
import { toMusicalEvents } from "./musicalEvents";
import { parseSectionFamilies, sectionFamilyAt } from "./sectionFamilies";
import {
  MOCK_CALLBACK_CHORUS_FAMILIES,
  MOCK_REMOTE_ANALYSIS_WITH_FAMILIES,
} from "./sectionFamilyFixtures";
import { normalizeRemoteSongAnalysis } from "../../../songAnalyzeClient";

function cue(partial: Partial<FormationCue> & { id: string; rawTime: number }): FormationCue {
  return {
    beatTime: partial.rawTime,
    barTime: partial.rawTime,
    action: "MAJOR_CHANGE",
    magnitude: "LARGE",
    priority: 88,
    confidence: 0.9,
    reasonCodes: ["SECTION_CHANGE"],
    sourceEventClusterId: `ec-${Math.round(partial.rawTime * 1000)}`,
    sourceChangePointIds: [],
    energyBefore: 40,
    energyAfter: 80,
    deltaEnergy: 40,
    isMajor: true,
    isLocked: false,
    suppressed: false,
    ...partial,
  };
}

describe("section_families intake", () => {
  it("parses Fly JSON and keeps old payloads working without families", () => {
    const withFamilies = normalizeRemoteSongAnalysis(
      { ...MOCK_REMOTE_ANALYSIS_WITH_FAMILIES },
      "fresh"
    );
    expect(withFamilies).not.toBeNull();
    expect(withFamilies!.section_families?.map((f) => f.familyId)).toEqual([
      "chorus-A",
      "verse-1",
    ]);
    expect(withFamilies!.change_points.length).toBeGreaterThan(0);

    const { section_families: _ignored, ...legacy } =
      MOCK_REMOTE_ANALYSIS_WITH_FAMILIES;
    const without = normalizeRemoteSongAnalysis({ ...legacy }, "cache");
    expect(without).not.toBeNull();
    expect(without!.section_families).toBeUndefined();
  });

  it("drops broken family rows instead of failing the parse", () => {
    const parsed = parseSectionFamilies([
      { familyId: "", type: "CHORUS", occurrences: [{ timeStart: 0, timeEnd: 8, variation: "first" }] },
      { familyId: "ok", type: "NOPE", occurrences: [{ timeStart: 0, timeEnd: 8, variation: "first" }] },
      {
        familyId: "chorus-A",
        type: "CHORUS_START",
        occurrences: [
          { timeStart: 20, timeEnd: 36, variation: "first" },
          { timeStart: 36, timeEnd: 20, variation: "repeat" },
        ],
      },
    ]);
    expect(parsed).toEqual([
      {
        familyId: "chorus-A",
        type: "CHORUS",
        occurrences: [{ timeStart: 20, timeEnd: 36, variation: "first" }],
      },
    ]);
  });

  it("maps the same chorusFamilyId onto first and repeat chorus events", () => {
    const structure = makeStructure(
      [
        makeCluster(20, ["SECTION_CHANGE", "ENERGY_RISE"], {
          id: "ec-c1",
          isMajor: true,
        }),
        makeCluster(52, ["SECTION_CHANGE", "ENERGY_RISE"], {
          id: "ec-c2",
          isMajor: true,
        }),
      ],
      {
        sections: [
          section("VERSE", 4, 20),
          section("CHORUS", 20, 36),
          section("VERSE", 36, 52),
          section("CHORUS", 52, 68),
          section("CHORUS", 84, 100),
        ],
      }
    );
    const events = toMusicalEvents({
      structure,
      sectionFamilies: MOCK_CALLBACK_CHORUS_FAMILIES,
    });
    const first = events.find(
      (e) => e.kind === "SECTION_BOUNDARY" && Math.abs(e.time - 20) < 1e-6
    );
    const second = events.find(
      (e) => e.kind === "SECTION_BOUNDARY" && Math.abs(e.time - 52) < 1e-6
    );
    const last = events.find(
      (e) => e.kind === "SECTION_BOUNDARY" && Math.abs(e.time - 84) < 1e-6
    );
    expect(first?.chorusFamilyId).toBe("chorus-A");
    expect(second?.chorusFamilyId).toBe("chorus-A");
    expect(last?.chorusFamilyId).toBe("chorus-A");
    expect(first?.variation).toBe("first");
    expect(second?.variation).toBe("repeat");
    expect(last?.variation).toBe("final");
    expect(first?.chorusOccurrence).toBe(1);
    expect(second?.chorusOccurrence).toBe(2);
    expect(last?.flags.isLastChorus).toBe(true);
    expect(sectionFamilyAt(MOCK_CALLBACK_CHORUS_FAMILIES, 8)?.family.familyId).toBe(
      "verse-1"
    );
  });

  it("relays chorusFamilyId from mock families through Intent", () => {
    const structure = makeStructure(
      [
        makeCluster(20, ["SECTION_CHANGE", "ENERGY_RISE"], {
          id: "ec-20000",
          isMajor: true,
        }),
        makeCluster(52, ["SECTION_CHANGE", "ENERGY_RISE"], {
          id: "ec-52000",
          isMajor: true,
        }),
      ],
      {
        sections: [
          section("CHORUS", 20, 36),
          section("CHORUS", 52, 68),
        ],
      }
    );
    const musicalEvents = toMusicalEvents({
      structure,
      sectionFamilies: MOCK_CALLBACK_CHORUS_FAMILIES,
    });
    const seq = generateChoreographicIntentSequence({
      analysis: {
        cues: [
          cue({
            id: "c-first",
            rawTime: 20,
            sourceEventClusterId: "ec-20000",
          }),
          cue({
            id: "c-repeat",
            rawTime: 52,
            sourceEventClusterId: "ec-52000",
          }),
        ],
      },
      eventClusters: structure.eventClusters,
      sections: structure.sections,
      durationSec: 104,
      musicalEvents,
    });
    expect(seq.intents).toHaveLength(2);
    expect(seq.intents[0]!.chorusFamilyId).toBe("chorus-A");
    expect(seq.intents[1]!.chorusFamilyId).toBe("chorus-A");
    expect(seq.intents[0]!.chorusFamilyId).toBe(seq.intents[1]!.chorusFamilyId);
    expect(seq.intents[0]!.variation).toBe("first");
    expect(seq.intents[1]!.variation).toBe("repeat");
  });
});
