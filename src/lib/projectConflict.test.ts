import { describe, expect, it } from "vitest";
import {
  isServerNewerThanKnown,
  projectJsonDiffers,
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

  it("detects json differences", () => {
    expect(projectJsonDiffers({ a: 1 }, { a: 1 })).toBe(false);
    expect(projectJsonDiffers({ a: 1 }, { a: 2 })).toBe(true);
  });
});
