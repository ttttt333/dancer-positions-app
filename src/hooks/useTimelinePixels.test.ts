import { describe, expect, it } from "vitest";
import { resolveCanonicalTimelineView } from "../hooks/useTimelinePixels";

describe("resolveCanonicalTimelineView", () => {
  it("prefers published full-song range over fallback (fixes React/Canvas drift)", () => {
    const published = { start: 0.02, end: 189.65, span: 189.63 };
    const fallback = { start: 0, end: 189.65, span: 189.65 };
    const v = resolveCanonicalTimelineView(published, fallback, 189.65);
    expect(v.start).toBeCloseTo(0.02, 5);
    expect(v.span).toBeCloseTo(189.63, 5);
  });

  it("ignores unset default {0,1,1} when duration is long", () => {
    const published = { start: 0, end: 1, span: 1 };
    const fallback = { start: 0, end: 120, span: 120 };
    const v = resolveCanonicalTimelineView(published, fallback, 120);
    expect(v.span).toBe(120);
  });

  it("uses published zoomed window", () => {
    const published = { start: 30, end: 60, span: 30 };
    const fallback = { start: 0, end: 120, span: 120 };
    const v = resolveCanonicalTimelineView(published, fallback, 120);
    expect(v).toEqual(published);
  });
});
