import { describe, expect, it } from "vitest";
import {
  appendCuesWithoutOverlap,
  applyAiSuggestToProject,
  filterAcceptedSuggestion,
  pairSuggestionCues,
} from "./applyAiSuggestResult";
import { createEmptyProject } from "./projectDefaults";
import type { Cue, Formation } from "../types/choreography";

function formation(id: string, name: string): Formation {
  return {
    id,
    name,
    dancers: [
      { id: "d1", label: "1", xPct: 40, yPct: 50, colorIndex: 0 },
      { id: "d2", label: "2", xPct: 60, yPct: 50, colorIndex: 1 },
    ],
  };
}

function cue(
  id: string,
  formationId: string,
  tStartSec: number,
  tEndSec: number
): Cue {
  return { id, formationId, tStartSec, tEndSec, name: id };
}

describe("filterAcceptedSuggestion", () => {
  it("keeps only accepted cues and the formations they point at", () => {
    const formations = [formation("f-a", "A"), formation("f-b", "B")];
    const cues = [cue("c-a", "f-a", 0, 4), cue("c-b", "f-b", 4, 8)];
    const next = filterAcceptedSuggestion(formations, cues, new Set(["c-b"]));
    expect(next.cues.map((c) => c.id)).toEqual(["c-b"]);
    expect(next.formations.map((f) => f.id)).toEqual(["f-b"]);
  });
});

describe("pairSuggestionCues", () => {
  it("pairs by formationId, not array index", () => {
    const formations = [formation("f-b", "B"), formation("f-a", "A")];
    const cues = [cue("c-a", "f-a", 0, 4), cue("c-b", "f-b", 4, 8)];
    const paired = pairSuggestionCues(formations, cues);
    expect(paired.map((p) => p.cue.id)).toEqual(["c-a", "c-b"]);
    expect(paired.map((p) => p.formation.name)).toEqual(["A", "B"]);
  });
});

describe("applyAiSuggestToProject", () => {
  it("replace overwrites cues and keeps unrelated formations", () => {
    const base = createEmptyProject();
    const keepId = base.activeFormationId;
    const prev = {
      ...base,
      formations: [
        { ...base.formations[0]!, id: keepId, name: "既存" },
        formation("old-ai", "古いAI"),
      ],
      cues: [cue("old-cue", keepId, 0, 8)],
    };
    const accepted = {
      formations: [formation("ai-f", "サビ")],
      cues: [cue("ai-c", "ai-f", 12, 20)],
    };
    const next = applyAiSuggestToProject(prev, accepted, "replace");
    expect(next.cues.map((c) => c.id)).toEqual(["ai-c"]);
    expect(next.formations.map((f) => f.id)).toEqual([keepId, "old-ai", "ai-f"]);
    expect(next.activeFormationId).toBe("ai-f");
    expect(
      next.formations.find((f) => f.id === "ai-f")?.dancers.map((d) => d.id)
    ).toEqual(["d1", "d2"]);
  });

  it("append keeps existing cues and adds accepted ones in a free gap", () => {
    const base = createEmptyProject();
    const keepId = base.activeFormationId;
    const prev = {
      ...base,
      formations: [{ ...base.formations[0]!, id: keepId, name: "既存" }],
      cues: [cue("old-cue", keepId, 0, 10)],
      trimStartSec: 0,
      trimEndSec: 60,
    };
    const accepted = {
      formations: [formation("ai-f", "サビ")],
      cues: [cue("ai-c", "ai-f", 2, 8)],
    };
    const next = applyAiSuggestToProject(prev, accepted, "append", {
      durationSec: 60,
    });
    expect(next.cues.map((c) => c.id)).toEqual(["old-cue", "ai-c"]);
    const added = next.cues.find((c) => c.id === "ai-c")!;
    expect(added.tStartSec).toBeGreaterThanOrEqual(10);
    expect(added.tEndSec).toBeGreaterThan(added.tStartSec);
    expect(next.formations.map((f) => f.id)).toContain(keepId);
    expect(next.formations.map((f) => f.id)).toContain("ai-f");
  });

  it("does nothing when nothing is accepted", () => {
    const prev = createEmptyProject();
    expect(
      applyAiSuggestToProject(prev, { formations: [], cues: [] }, "replace")
    ).toBe(prev);
  });
});

describe("appendCuesWithoutOverlap", () => {
  it("does not shrink existing cues", () => {
    const existing = [cue("old", "f-old", 0, 10)];
    const incoming = [cue("new", "f-new", 4, 12)];
    const merged = appendCuesWithoutOverlap(existing, incoming, 0, 60);
    expect(merged.find((c) => c.id === "old")).toMatchObject({
      tStartSec: 0,
      tEndSec: 10,
    });
    expect(merged.find((c) => c.id === "new")!.tStartSec).toBeGreaterThanOrEqual(
      10
    );
  });
});
