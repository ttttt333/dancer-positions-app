import { describe, expect, it } from "vitest";
import { groupScaleForHandle } from "./stageBoardModelHelpers";

const box = { x0: 20, y0: 30, x1: 80, y1: 70 };

describe("groupScaleForHandle", () => {
  it("starts at scale 1 even when pointer is outside the dancer bbox (handle inset)", () => {
    // 東ハンドルは視覚上 x1 より外側にある想定
    const start = { x: 88, y: 50 };
    const r = groupScaleForHandle("e", box, start.x, start.y, false, start);
    expect(r.sx).toBeCloseTo(1, 5);
    expect(r.sy).toBe(1);
  });

  it("scales smoothly with pointer delta from the grab point", () => {
    const start = { x: 88, y: 50 };
    // 右へ 6pt（床％）→ 東辺が 80+6=86、sx=(86-50)/(80-50)=1.2
    const wider = groupScaleForHandle("e", box, 94, 50, false, start);
    expect(wider.sx).toBeCloseTo(1.2, 5);

    // 左へ 15pt → 東辺 65、sx=(65-50)/30≈0.5
    const narrower = groupScaleForHandle("e", box, 73, 50, false, start);
    expect(narrower.sx).toBeCloseTo(0.5, 5);
  });

  it("narrows height from a south handle without jumping", () => {
    const start = { x: 50, y: 78 };
    const r0 = groupScaleForHandle("s", box, 50, 78, false, start);
    expect(r0.sy).toBeCloseTo(1, 5);
    const r1 = groupScaleForHandle("s", box, 50, 68, false, start);
    // 南辺 70-10=60、sy=(60-50)/(70-50)=0.5
    expect(r1.sy).toBeCloseTo(0.5, 5);
  });

  it("keeps aspect-ratio corners at scale 1 on grab, then follows pointer delta", () => {
    const start = { x: 88, y: 78 };
    const r0 = groupScaleForHandle("se", box, start.x, start.y, true, start);
    expect(r0.sx).toBeCloseTo(1, 5);
    expect(r0.sy).toBeCloseTo(1, 5);

    const r1 = groupScaleForHandle("se", box, 94, 78, true, start);
    expect(r1.sx).toBeCloseTo(1.2, 5);
    expect(r1.sy).toBeCloseTo(1.2, 5);
  });
});
