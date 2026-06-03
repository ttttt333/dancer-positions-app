import { describe, expect, it } from "vitest";
import {
  centerDistanceLabelMmFromMarkerCenter,
  formatCenterDistanceCmFine,
  snapXPctToCenterDistanceMmGrid,
} from "./dancerSpacing";

describe("centerDistanceLabelMmFromMarkerCenter", () => {
  const W = 12_000;

  it("左右対称の xPct で同じ cm ラベルになる", () => {
    const left = 40;
    const right = 60;
    const leftMm = centerDistanceLabelMmFromMarkerCenter(left, W);
    const rightMm = centerDistanceLabelMmFromMarkerCenter(right, W);
    expect(leftMm).toBe(rightMm);
    expect(formatCenterDistanceCmFine(leftMm)).toBe(
      formatCenterDistanceCmFine(rightMm)
    );
  });

  it("5cm 格子に揃えてから距離を出す", () => {
    const xPct = snapXPctToCenterDistanceMmGrid(41.2, W, 50);
    const mm = centerDistanceLabelMmFromMarkerCenter(41.2, W);
    expect(mm % 50).toBe(0);
    expect(centerDistanceLabelMmFromMarkerCenter(xPct, W)).toBe(mm);
  });
});
