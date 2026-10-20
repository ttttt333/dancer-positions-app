import { describe, expect, it } from "vitest";
import { cueSelectionExtentSec } from "./cueSelectionExtent";

describe("cueSelectionExtentSec", () => {
  const cues = [
    { id: "a", tStartSec: 0, tEndSec: 4 },
    { id: "b", tStartSec: 7, tEndSec: 10 },
    { id: "c", tStartSec: 10, tEndSec: 14 },
  ];

  it("includes the gap until the next cue", () => {
    const e = cueSelectionExtentSec(cues[0]!, cues);
    expect(e.startSec).toBe(0);
    expect(e.holdEndSec).toBe(4);
    expect(e.endSec).toBe(7);
  });

  it("stops at hold end when cues abut", () => {
    const e = cueSelectionExtentSec(cues[1]!, cues);
    expect(e.startSec).toBe(7);
    expect(e.holdEndSec).toBe(10);
    expect(e.endSec).toBe(10);
  });

  it("uses hold end for the last cue", () => {
    const e = cueSelectionExtentSec(cues[2]!, cues);
    expect(e.endSec).toBe(14);
  });
});
