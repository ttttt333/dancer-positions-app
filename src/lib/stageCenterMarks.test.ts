import { describe, expect, it } from "vitest";
import {
  clampCenterMarkPct,
  createDefaultCenterMark,
  normalizeStageCenterMarks,
  nextCenterMarkOffset,
  resolveCenterMarkAxes,
  STAGE_CENTER_MARK_RX_DEFAULT,
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
      { id: "b", xPct: 0, yPct: 100, shape: "ellipse", rxPct: 5, ryPct: 3 },
    ]);
    expect(marks).toHaveLength(2);
    expect(marks[0]).toMatchObject({
      id: "a",
      xPct: 40,
      yPct: 60,
      label: "A",
      shape: "circle",
      rxPct: STAGE_CENTER_MARK_RX_DEFAULT,
    });
    expect(marks[1]).toMatchObject({
      id: "b",
      xPct: 0,
      yPct: 100,
      shape: "ellipse",
      rxPct: 5,
      ryPct: 3,
    });
  });

  it("seeds center when requested and empty", () => {
    const marks = normalizeStageCenterMarks(undefined, {
      seedCenterIfEmpty: true,
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].xPct).toBe(50);
    expect(marks[0].yPct).toBe(50);
    expect(marks[0].label).toBe("ヘソ");
    expect(marks[0].shape).toBe("circle");
  });

  it("does not seed when empty and flag false", () => {
    expect(normalizeStageCenterMarks([])).toEqual([]);
  });

  it("createDefaultCenterMark sets defaults", () => {
    const m = createDefaultCenterMark();
    expect(m.xPct).toBe(50);
    expect(m.yPct).toBe(50);
    expect(m.label).toBe("ヘソ");
    expect(m.shape).toBe("circle");
    expect(m.rxPct).toBe(STAGE_CENTER_MARK_RX_DEFAULT);
    expect(m.id.length).toBeGreaterThan(0);
  });

  it("nextCenterMarkOffset spreads marks", () => {
    const a = nextCenterMarkOffset([]);
    expect(a).toEqual({ xPct: 50, yPct: 50 });
    const b = nextCenterMarkOffset([createDefaultCenterMark()]);
    expect(b.xPct).toBe(54);
  });

  it("resolveCenterMarkAxes corrects circle for floor aspect", () => {
    const circle = resolveCenterMarkAxes(
      { rxPct: 4, shape: "circle" },
      2
    );
    expect(circle.rx).toBe(4);
    expect(circle.ry).toBe(8);
    expect(circle.shape).toBe("circle");

    const ellipse = resolveCenterMarkAxes(
      { rxPct: 4, ryPct: 2, shape: "ellipse" },
      2
    );
    expect(ellipse.rx).toBe(4);
    expect(ellipse.ry).toBe(2);
  });
});
