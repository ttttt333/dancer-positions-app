/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { makeCluster, makeStructure, section } from "../cue/cueFixtures";
import { toMusicalEvents } from "./musicalEvents";

describe("toMusicalEvents", () => {
  it("maps PRE_CHORUS section starts to SECTION_BOUNDARY", () => {
    const structure = makeStructure(
      [makeCluster(16, ["ENERGY_RISE"], { id: "ec-pre", strength: 55 })],
      {
        sections: [
          section("VERSE", 0, 12),
          section("PRE_CHORUS", 12, 20),
          section("CHORUS", 20, 36),
        ],
      }
    );
    const events = toMusicalEvents({ structure, bpm: 120, durationSec: 36 });
    const pre = events.find(
      (e) => e.sectionType === "PRE_CHORUS" && e.kind === "SECTION_BOUNDARY"
    );
    expect(pre).toBeDefined();
    expect(pre!.time).toBe(12);
    expect(pre!.chorusFamilyId).toBeNull();
    expect(pre!.chorusOccurrence).toBeNull();
    expect(pre!.variation).toBe("none");
    expect(pre!.reasonCodes).toContain("SECTION_PRE_CHORUS");
  });

  it("does not invent formation names or chorus family ids", () => {
    const structure = makeStructure(
      [makeCluster(20, ["SECTION_CHANGE"], { id: "ec-ch", isMajor: true })],
      { sections: [section("CHORUS", 20, 36)] }
    );
    const events = toMusicalEvents({ structure });
    expect(events.every((e) => e.chorusFamilyId === null)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/CLUSTER|V字|wide_spread/);
  });
});
