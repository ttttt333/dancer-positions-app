/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { classifyHits } from "./HitClassifier";
import { createSyntheticPhase1Analysis } from "./syntheticPhase1";

describe("HitClassifier", () => {
  it("TEST 14: a low-frequency onset is a KICK candidate", () => {
    const phase1 = createSyntheticPhase1Analysis({
      segments: [
        {
          duration: 4,
          energy: 40,
          bass: 0.55,
          onset: 0.9,
          high: 0.04,
          mid: 0.06,
        },
      ],
      hits: [{ time: 1.0, strength: 0.9 }],
    });
    const hits = classifyHits(phase1.hits, phase1);
    expect(hits[0]!.type).toBe("KICK");
    expect(hits[0]!.confidence).toBeGreaterThan(0.55);
  });

  it("TEST 15: a strong multi-band onset is IMPACT or MUSICAL_HIT", () => {
    const phase1 = createSyntheticPhase1Analysis({
      segments: [
        {
          duration: 4,
          energy: 70,
          bass: 0.35,
          onset: 0.95,
          high: 0.4,
          mid: 0.35,
        },
      ],
      hits: [{ time: 1.0, strength: 0.95 }],
    });
    const hits = classifyHits(phase1.hits, phase1);
    expect(["IMPACT", "MUSICAL_HIT", "DROP"]).toContain(hits[0]!.type);
  });
});
