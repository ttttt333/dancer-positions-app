import { describe, expect, it } from "vitest";
import {
  clampCenterMarkPct,
  createDefaultCenterMark,
  normalizeStageCenterMarks,
  nextCenterMarkOffset,
} from "./stageCenterMarks";

describe("stageCenterMarks", () => {
  it("clamps pct to 0–100", () => {
    expect(clampCenterMarkPct(-5)).toBe(0);
    expect(clampCenterMarkPct(150)).toBe(100);
    expect(clampCenterMarkPct(33.33)).toBe(33.3);
  });

  it("normalizes valid marks and drops junk", () => {
    const marks = normalizeStageCenterMarks([
      { id: "a", xPct: 40, yPct: 60, label: "A" },
      { id: "a", xPct: 10, yPct: 10 },
      { xPct: "no", yPct: 50 },
      { id: "b", xPct: 0, yPct: 100 },
    ]);
    expect(marks).toHaveLength(2);
    expect(marks[0]).toMatchObject({ id: "a", xPct: 40, yPct: 60, label: "A" });
    expect(marks[1]).toMatchObject({ id: "b", xPct: 0, yPct: 100 });
  });

  it("seeds center when requested and empty", () => {
    const marks = normalizeStageCenterMarks(undefined, {
      seedCenterIfEmpty: true,
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].xPct).toBe(50);
    expect(marks[0].yPct).toBe(50);
    expect(marks[0].label).toBe("ヘソ");
  });

  it("does not seed when empty and flag false", () => {
    expect(normalizeStageCenterMarks([])).toEqual([]);
  });

  it("createDefaultCenterMark sets defaults", () => {
    const m = createDefaultCenterMark();
    expect(m.xPct).toBe(50);
    expect(m.yPct).toBe(50);
    expect(m.label).toBe("ヘソ");
    expect(m.id.length).toBeGreaterThan(0);
  });

  it("nextCenterMarkOffset spreads marks", () => {
    const a = nextCenterMarkOffset([]);
    expect(a).toEqual({ xPct: 50, yPct: 50 });
    const b = nextCenterMarkOffset([createDefaultCenterMark()]);
    expect(b.xPct).toBe(54);
  });
});
