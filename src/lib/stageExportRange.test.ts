import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_EXPORT_SEC,
  parseVideoExportRangeInput,
  resolveStageExportRange,
} from "./stageExportRange";

describe("resolveStageExportRange", () => {
  it("uses trim window inside the track", () => {
    expect(resolveStageExportRange(180, 10, 40)).toEqual({
      startSec: 10,
      endSec: 40,
      durationSec: 30,
    });
  });

  it("falls back to full track when end is null", () => {
    expect(resolveStageExportRange(90, 0, null).durationSec).toBe(90);
  });

  it("caps to MAX_VIDEO_EXPORT_SEC", () => {
    const r = resolveStageExportRange(600, 0, 600);
    expect(r.durationSec).toBe(MAX_VIDEO_EXPORT_SEC);
    expect(r.endSec).toBe(MAX_VIDEO_EXPORT_SEC);
  });
});

describe("parseVideoExportRangeInput", () => {
  it("parses m:ss and empty end as track end", () => {
    const r = parseVideoExportRangeInput("0:30", "", 120);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range).toEqual({ startSec: 30, endSec: 120 });
    expect(r.capped).toBe(false);
  });

  it("rejects inverted range", () => {
    const r = parseVideoExportRangeInput("2:00", "1:00", 180);
    expect(r.ok).toBe(false);
  });

  it("marks capped when request exceeds max", () => {
    const r = parseVideoExportRangeInput("0:00", "10:00", 600);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.capped).toBe(true);
    expect(r.range.endSec - r.range.startSec).toBe(MAX_VIDEO_EXPORT_SEC);
  });
});
