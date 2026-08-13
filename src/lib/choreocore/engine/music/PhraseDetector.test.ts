/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { resolveMusicStructureConfig } from "./structureConfig";
import { detectSections } from "./SectionDetector";
import { detectPhrases } from "./PhraseDetector";
import { patternFourBarPhrases, patternEightBar } from "./syntheticPhase1";

const config = resolveMusicStructureConfig();

describe("PhraseDetector", () => {
  it("TEST 04: 4-bar energy steps yield phrase boundary candidates", () => {
    const phase1 = patternFourBarPhrases();
    const sections = detectSections(phase1, config);
    const phrases = detectPhrases(phase1, sections, config);
    expect(phrases.length).toBeGreaterThanOrEqual(2);
    expect(phrases.some((p) => p.barCount === 4 || Math.abs(p.endTime - p.startTime - 8) < 1.2)).toBe(
      true
    );
  });

  it("TEST 05: an 8-bar structure yields an 8-bar phrase", () => {
    const phase1 = patternEightBar();
    const sections = detectSections(phase1, config);
    const phrases = detectPhrases(phase1, sections, config);
    expect(phrases.some((p) => p.barCount >= 7 && p.barCount <= 9)).toBe(true);
  });

  it("TEST 06: a front/back energy-spectrum change is a phrase boundary", () => {
    const phase1 = patternEightBar();
    const sections = detectSections(phase1, config);
    const phrases = detectPhrases(phase1, sections, config);
    expect(phrases.length).toBeGreaterThanOrEqual(2);
    const cut = phrases[1]!.startTime;
    expect(cut).toBeGreaterThan(12);
    expect(cut).toBeLessThan(20);
  });
});
