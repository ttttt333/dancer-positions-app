import { describe, expect, it } from "vitest";
import {
  isServerNewerThanKnown,
  projectJsonDiffers,
  shouldPreferLocalDraft,
} from "./projectConflict";

describe("projectConflict", () => {
  it("detects newer server updated_at", () => {
    expect(
      isServerNewerThanKnown(
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBe(true);
    expect(
      isServerNewerThanKnown(
        "2026-01-01T00:01:00.000Z",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBe(false);
  });

  it("does not treat unknown baseline as conflict", () => {
    expect(
      isServerNewerThanKnown(null, "2026-01-01T00:01:00.000Z")
    ).toBe(false);
    expect(
      isServerNewerThanKnown(undefined, "2026-01-01T00:01:00.000Z")
    ).toBe(false);
  });

  it("detects json differences", () => {
    expect(projectJsonDiffers({ a: 1 }, { a: 1 })).toBe(false);
    expect(projectJsonDiffers({ a: 1 }, { a: 2 })).toBe(true);
  });

  it("prefers newer local draft over cloud", () => {
    expect(
      shouldPreferLocalDraft(
        "2026-01-01T00:02:00.000Z",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBe(true);
    expect(
      shouldPreferLocalDraft(
        "2026-01-01T00:01:00.000Z",
        "2026-01-01T00:02:00.000Z"
      )
    ).toBe(false);
    expect(
      shouldPreferLocalDraft(
        "2026-01-01T00:01:00.000Z",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBe(false);
  });
});
