import { describe, expect, it } from "vitest";
import { cueImageFileName } from "./exportChoreographyPdf";

describe("cueImageFileName", () => {
  it("prefixes a zero-padded page index", () => {
    expect(cueImageFileName(0, "Opening")).toBe("01-Opening.png");
    expect(cueImageFileName(9, "Chorus")).toBe("10-Chorus.png");
  });

  it("sanitizes unsafe characters in the title", () => {
    expect(cueImageFileName(0, 'a/b:c*"')).toBe("01-a_b_c_.png");
  });
});
