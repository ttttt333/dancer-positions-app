/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { resolveMusicStructureConfig } from "./structureConfig";
import { detectSections } from "./SectionDetector";
import {
  patternA,
  patternNoise,
  createSyntheticPhase1Analysis,
  patternWeak,
} from "./syntheticPhase1";

const config = resolveMusicStructureConfig();

describe("SectionDetector", () => {
  it("TEST 01: a large energy rise creates a section boundary", () => {
    const sections = detectSections(patternA(), config);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    const boundary = sections[1]!.startTime;
    expect(boundary).toBeGreaterThan(6);
    expect(boundary).toBeLessThan(10);
  });

  it("TEST 02: small energy noise does not spawn many sections", () => {
    const sections = detectSections(patternNoise(), config);
    expect(sections.length).toBeLessThanOrEqual(2);
  });

  it("TEST 03: a 2-bar candidate is rejected or merged", () => {
    const phase1 = createSyntheticPhase1Analysis({
      segments: [
        { duration: 4, energy: 18, bass: 0.08, onset: 0.1, high: 0.08 },
        { duration: 12, energy: 80, bass: 0.5, onset: 0.7, high: 0.2 },
      ],
    });
    const sections = detectSections(phase1, config);
    expect(sections.every((s) => s.barCount >= 4 || s.endTime - s.startTime >= 7.5)).toBe(
      true
    );
  });

  it("TEST 19: a weak undifferentiated section stays UNKNOWN", () => {
    const sections = detectSections(patternWeak(), config);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0]!.type).toBe("UNKNOWN");
    expect(sections[0]!.confidence).toBeLessThan(0.6);
  });
});
