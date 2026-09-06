import { describe, expect, it } from "vitest";
import {
  enforceRightMasterSymmetry,
  quantizeFormationGeometry,
  resolveCollisions,
} from "./geometricGridQuantizer";

describe("geometricGridQuantizer", () => {
  it("snaps messy coordinates onto 0.9 × 1.0 m grid", () => {
    const out = quantizeFormationGeometry(
      [
        { id: "a", x: 0.12, y: 0.2 },
        { id: "b", x: 1.05, y: 1.1 },
        { id: "c", x: -1.1, y: 1.05 },
      ],
      { enableStaggering: false }
    );
    expect(out.find((p) => p.id === "a")!.x).toBe(0);
    expect(out.find((p) => p.id === "a")!.y).toBe(0);
    expect(out.find((p) => p.id === "b")!.x).toBe(0.9);
    expect(out.find((p) => p.id === "b")!.y).toBe(1);
    expect(out.find((p) => p.id === "c")!.x).toBe(-0.9);
    expect(out.find((p) => p.id === "c")!.y).toBe(1);
  });

  it("staggers a back row that would sit on the same X as the front", () => {
    const out = quantizeFormationGeometry([
      { id: "f1", x: 0.9, y: 0 },
      { id: "f2", x: -0.9, y: 0 },
      { id: "b1", x: 0.95, y: 1.05 },
      { id: "b2", x: -0.95, y: 1.05 },
    ]);
    const b1 = out.find((p) => p.id === "b1")!;
    const b2 = out.find((p) => p.id === "b2")!;
    // 前の列が ±0.9 なので、後ろは半ステップずらし → ±1.35
    expect(Math.abs(b1.x)).toBeCloseTo(1.35, 2);
    expect(Math.abs(b2.x)).toBeCloseTo(1.35, 2);
    expect(b1.x).toBeCloseTo(-b2.x, 2);
  });

  it("keeps left/right as perfect mirrors on the same row", () => {
    const out = quantizeFormationGeometry(
      [
        { id: "r", x: 1.2, y: 1 },
        { id: "l", x: -0.7, y: 1.05 },
        { id: "c", x: 0.1, y: 1 },
      ],
      { enableStaggering: false }
    );
    const r = out.find((p) => p.id === "r")!;
    const l = out.find((p) => p.id === "l")!;
    const c = out.find((p) => p.id === "c")!;
    expect(c.x).toBe(0);
    expect(r.x).toBeCloseTo(-l.x, 2);
    expect(r.y).toBeCloseTo(l.y, 2);
  });

  it("pushes same-row collisions apart to at least 0.8m", () => {
    const packed = resolveCollisions(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 0.3, y: 0 },
      ],
      0.8,
      0.9
    );
    const d = Math.hypot(packed[0]!.x - packed[1]!.x, packed[0]!.y - packed[1]!.y);
    expect(d).toBeGreaterThanOrEqual(0.8 - 1e-3);
  });

  it("enforceRightMasterSymmetry mirrors left from right", () => {
    const out = enforceRightMasterSymmetry(
      [
        { id: "r", x: 1.8, y: 0 },
        { id: "l", x: -1.1, y: 0 },
      ],
      0.3
    );
    expect(out.find((p) => p.id === "r")!.x).toBe(1.8);
    expect(out.find((p) => p.id === "l")!.x).toBe(-1.8);
  });
});
