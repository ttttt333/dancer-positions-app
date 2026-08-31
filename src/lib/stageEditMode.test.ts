import { describe, expect, it } from "vitest";
import {
  isFormationEditSelection,
  resolveStageEditMode,
  retainDancerIdsInFormation,
} from "./stageEditMode";

describe("isFormationEditSelection", () => {
  it("is true only when every formation id is selected", () => {
    expect(isFormationEditSelection(["a", "b", "c"], ["a", "b", "c"])).toBe(
      true
    );
    expect(isFormationEditSelection(["c", "a", "b"], ["a", "b", "c"])).toBe(
      true
    );
  });

  it("is false when counts match but ids differ", () => {
    expect(isFormationEditSelection(["a", "b", "c"], ["a", "b", "d"])).toBe(
      false
    );
  });

  it("is false when one formation member is missing", () => {
    expect(isFormationEditSelection(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("is false for a one-person formation", () => {
    expect(isFormationEditSelection(["a"], ["a"])).toBe(false);
  });

  it("still true if extra stale ids are also selected", () => {
    expect(
      isFormationEditSelection(["a", "b", "c", "stale"], ["a", "b", "c"])
    ).toBe(true);
  });
});

describe("resolveStageEditMode", () => {
  const formation = ["a", "b", "c"];

  it("returns dancer for a single selection", () => {
    expect(resolveStageEditMode(["a"], formation)).toBe("dancer");
  });

  it("returns group when some but not all members are selected", () => {
    expect(resolveStageEditMode(["a", "b"], formation)).toBe("group");
  });

  it("returns formation when every member is selected", () => {
    expect(resolveStageEditMode(["a", "b", "c"], formation)).toBe("formation");
  });

  it("returns none when nothing is selected", () => {
    expect(resolveStageEditMode([], formation)).toBe("none");
  });
});

describe("retainDancerIdsInFormation", () => {
  it("keeps a full formation selection when dancer ids are cloned", () => {
    const kept = retainDancerIdsInFormation(["a", "b", "c"], ["a", "b", "c"]);
    expect(kept).toEqual(["a", "b", "c"]);
    expect(resolveStageEditMode(kept, ["a", "b", "c"])).toBe("formation");
  });

  it("drops ids that are not in the next formation", () => {
    expect(retainDancerIdsInFormation(["a", "b", "stale"], ["a", "b", "c"])).toEqual(
      ["a", "b"]
    );
  });

  it("clears selection when no selected dancer exists in the next formation", () => {
    expect(retainDancerIdsInFormation(["x", "y"], ["a", "b", "c"])).toEqual([]);
  });
});
