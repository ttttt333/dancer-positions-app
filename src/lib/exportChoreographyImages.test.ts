import { describe, expect, it } from "vitest";
import {
  cueImageFileName,
  parseCueImageExportFormat,
  resolveExportPageIndexes,
} from "./exportChoreographyPdf";

describe("cueImageFileName", () => {
  it("prefixes a zero-padded page index", () => {
    expect(cueImageFileName(0, "Opening")).toBe("01-Opening.png");
    expect(cueImageFileName(9, "Chorus")).toBe("10-Chorus.png");
  });

  it("sanitizes unsafe characters in the title", () => {
    expect(cueImageFileName(0, 'a/b:c*"')).toBe("01-a_b_c_.png");
  });

  it("uses the chosen extension", () => {
    expect(cueImageFileName(0, "Opening", "jpg")).toBe("01-Opening.jpg");
    expect(cueImageFileName(1, "Bridge", "webp")).toBe("02-Bridge.webp");
  });
});

describe("parseCueImageExportFormat", () => {
  it("normalizes jpeg aliases and falls back to png", () => {
    expect(parseCueImageExportFormat("jpg")).toBe("jpg");
    expect(parseCueImageExportFormat("jpeg")).toBe("jpg");
    expect(parseCueImageExportFormat("webp")).toBe("webp");
    expect(parseCueImageExportFormat("png")).toBe("png");
    expect(parseCueImageExportFormat("gif")).toBe("png");
  });
});

describe("resolveExportPageIndexes", () => {
  it("returns all indexes when selection is omitted or empty", () => {
    expect(resolveExportPageIndexes(3)).toEqual([0, 1, 2]);
    expect(resolveExportPageIndexes(3, [])).toEqual([0, 1, 2]);
  });

  it("keeps unique in-range indexes sorted", () => {
    expect(resolveExportPageIndexes(5, [3, 0, 3, 1, -1, 9])).toEqual([0, 1, 3]);
  });
});
