import { describe, expect, it } from "vitest";
import { pickCueAfterDelete } from "./cueSelectionAfterDelete";
import type { Cue } from "../types/choreography";

function cue(id: string, tStartSec: number, formationId = "f"): Cue {
  return {
    id,
    tStartSec,
    tEndSec: tStartSec + 1,
    formationId,
  };
}

describe("pickCueAfterDelete", () => {
  const cues = [cue("a", 0), cue("b", 2), cue("c", 4)];

  it("selects the previous cue when deleting a middle one", () => {
    expect(pickCueAfterDelete(cues, new Set(["b"]))?.id).toBe("a");
  });

  it("selects the next remaining cue when deleting the first", () => {
    expect(pickCueAfterDelete(cues, new Set(["a"]))?.id).toBe("b");
  });

  it("selects the cue before the earliest deleted when deleting multiple", () => {
    expect(pickCueAfterDelete(cues, new Set(["b", "c"]))?.id).toBe("a");
  });

  it("returns null when all cues are deleted", () => {
    expect(pickCueAfterDelete(cues, new Set(["a", "b", "c"]))).toBeNull();
  });

  it("returns null for an empty delete set", () => {
    expect(pickCueAfterDelete(cues, new Set())).toBeNull();
  });
});
