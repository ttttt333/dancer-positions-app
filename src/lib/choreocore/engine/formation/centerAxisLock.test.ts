import { describe, it, expect } from "vitest";
import { enforceCenterAxisLock } from "./centerAxisLock";
import { GOLDEN_GEOMETRY } from "./goldenParameters";

describe("centerAxisLock", () => {
  it("奇数人数の場合、中央に最も近いダンサーの X 座標が 50.0% にロックされること", () => {
    const input = [
      { xPct: 49.2, yPct: 30.0 }, // ほぼセンター
      { xPct: 30.0, yPct: 50.0 },
      { xPct: 70.0, yPct: 50.0 },
    ];

    const result = enforceCenterAxisLock(input);
    expect(result[0]!.xPct).toBe(50.0);
    expect(result[0]!.yPct).toBe(30.0);
  });

  it("偶数人数の場合、中央ペアが 50.0% 軸を中心に左右対称へ均等補正されること", () => {
    const input = [
      { xPct: 42.0, yPct: 40.0 }, // -8.0
      { xPct: 56.0, yPct: 40.0 }, // +6.0 (平均 dx = 7.0)
      { xPct: 20.0, yPct: 60.0 },
      { xPct: 80.0, yPct: 60.0 },
    ];

    const result = enforceCenterAxisLock(input);
    expect(result[0]!.xPct).toBe(43.0); // 50 - 7
    expect(result[1]!.xPct).toBe(57.0); // 50 + 7
  });

  it("許容誤差外の奇数点は strict でない限り動かさない", () => {
    const input = [
      { xPct: 40.0, yPct: 30.0 },
      { xPct: 20.0, yPct: 50.0 },
      { xPct: 80.0, yPct: 50.0 },
    ];
    const result = enforceCenterAxisLock(input, {
      centerTolerancePct: GOLDEN_GEOMETRY.CENTER_AXIS_TOLERANCE,
    });
    expect(result[0]!.xPct).toBe(40.0);

    const strict = enforceCenterAxisLock(input, { strictCenterSnap: true });
    expect(strict[0]!.xPct).toBe(50.0);
  });

  it("DancerSpot 相当の追加フィールドを保持する", () => {
    const input = [
      { xPct: 49.5, yPct: 40, id: "a", label: "1" },
      { xPct: 20, yPct: 50, id: "b", label: "2" },
      { xPct: 80, yPct: 50, id: "c", label: "3" },
    ];
    const result = enforceCenterAxisLock(input);
    expect(result[0]!.id).toBe("a");
    expect(result[0]!.label).toBe("1");
    expect(result[0]!.xPct).toBe(50.0);
  });
});

describe("goldenParameters", () => {
  it("defines core stage geometry constants", () => {
    expect(GOLDEN_GEOMETRY.ROW_GAP_PCT).toBe(14);
    expect(GOLDEN_GEOMETRY.COL_GAP_PCT).toBe(16);
    expect(GOLDEN_GEOMETRY.V_SHAPE_ANGLE_DEG).toBe(70);
    expect(GOLDEN_GEOMETRY.WEDGE_ANGLE_DEG).toBe(110);
    expect(GOLDEN_GEOMETRY.ARC_RADIUS_PCT).toBe(35);
    expect(GOLDEN_GEOMETRY.CENTER_AXIS_TOLERANCE).toBe(5);
  });
});
