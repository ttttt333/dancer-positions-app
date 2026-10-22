import { describe, expect, it } from "vitest";
import {
  parseCueExportImageFileName,
  parseCueExportTimeRangeLabel,
  sortCueExportImageFiles,
} from "./cueExportImageMeta";

describe("parseCueExportImageFileName", () => {
  it("reads zero-padded index and title", () => {
    expect(parseCueExportImageFileName("01-キュー_1.png")).toEqual({
      index: 1,
      title: "キュー 1",
      fileName: "01-キュー_1.png",
    });
    expect(parseCueExportImageFileName("10-Opening.png").index).toBe(10);
  });
});

describe("parseCueExportTimeRangeLabel", () => {
  it("parses m:ss ranges", () => {
    expect(parseCueExportTimeRangeLabel("0:00〜1:45")).toEqual({
      startSec: 0,
      endSec: 105,
    });
    expect(parseCueExportTimeRangeLabel("2:05-3:00")).toEqual({
      startSec: 125,
      endSec: 180,
    });
  });

  it("rejects inverted ranges", () => {
    expect(parseCueExportTimeRangeLabel("3:00〜1:00")).toBeNull();
  });
});

describe("sortCueExportImageFiles", () => {
  it("orders by numeric prefix", () => {
    const sorted = sortCueExportImageFiles([
      { name: "03-c.png" },
      { name: "01-a.png" },
      { name: "02-b.png" },
    ]);
    expect(sorted.map((f) => f.name)).toEqual([
      "01-a.png",
      "02-b.png",
      "03-c.png",
    ]);
  });
});
