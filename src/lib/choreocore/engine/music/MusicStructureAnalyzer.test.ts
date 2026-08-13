/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { analyzeMusicStructure } from "./MusicStructureAnalyzer";
import { STRUCTURE_ANALYSIS_VERSION } from "./structureConfig";
import { patternA } from "./syntheticPhase1";

describe("MusicStructureAnalyzer", () => {
  it("TEST 18: the same Phase 1 input is deterministic", () => {
    const phase1 = patternA();
    const a = analyzeMusicStructure(phase1);
    const b = analyzeMusicStructure(phase1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.analysisVersion).toBe(STRUCTURE_ANALYSIS_VERSION);
    expect(phase1.analysisVersion).toBe("3.0.0-phase1");
  });

  it("TEST 20: full pipeline yields sections, phrases, and change points", () => {
    const result = analyzeMusicStructure(patternA());
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.phrases.length).toBeGreaterThan(0);
    expect(result.changePoints.length).toBeGreaterThan(0);
    expect(result.eventClusters.length).toBeGreaterThan(0);
    expect(result.hits.length).toBeGreaterThan(0);
  });
});
