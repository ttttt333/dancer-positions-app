import { describe, expect, it } from "vitest";
import {
  centerDistanceLabelMmFromMarkerCenter,
  equalizeXPctByStartCenterDistanceSlot,
  formatCenterDistanceCmFine,
  rawHorizontalDistanceFromStageCenterMm,
  snapAbsCenterDistanceMm,
  snapXPctToCenterDistanceMmGrid,
  xPctFromSignedCenterDistanceMm,
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

  it("snap した xPct の表示距離は格子で、再スナップしてもラベルが変わらない", () => {
    // 幅が割り切れないとき float 誤差で raw mm は僅かにずれるが、表示は格子に戻る
    const Wodd = 14_000;
    const x = snapXPctToCenterDistanceMmGrid(42.17, Wodd, 50);
    const labelMm = centerDistanceLabelMmFromMarkerCenter(x, Wodd);
    expect(labelMm % 50).toBe(0);
    const x2 = snapXPctToCenterDistanceMmGrid(x, Wodd, 50);
    expect(centerDistanceLabelMmFromMarkerCenter(x2, Wodd)).toBe(labelMm);
  });
});

describe("equalizeXPctByStartCenterDistanceSlot", () => {
  const W = 12_000;

  it("縮尺後に左右が半コマずれていても同じ距離スロットに揃える", () => {
    // 開始: 左右とも 1500mm（±12.5%）
    const startLeft = xPctFromSignedCenterDistanceMm(-1500, W);
    const startRight = xPctFromSignedCenterDistanceMm(1500, W);
    // 縮尺後: 境界 1625mm 付近で左右がわずかにずれた想定
    const nextLeft = xPctFromSignedCenterDistanceMm(-1624.4, W);
    const nextRight = xPctFromSignedCenterDistanceMm(1625.6, W);
    // 個別スナップだと 1600 vs 1650 に分かれる
    expect(snapAbsCenterDistanceMm(1624.4, 50)).toBe(1600);
    expect(snapAbsCenterDistanceMm(1625.6, 50)).toBe(1650);

    const equalized = equalizeXPctByStartCenterDistanceSlot(
      new Map([
        ["L", nextLeft],
        ["R", nextRight],
      ]),
      new Map([
        ["L", startLeft],
        ["R", startRight],
      ]),
      W,
      50
    );
    const leftMm = centerDistanceLabelMmFromMarkerCenter(
      equalized.get("L")!,
      W
    );
    const rightMm = centerDistanceLabelMmFromMarkerCenter(
      equalized.get("R")!,
      W
    );
    expect(leftMm).toBe(rightMm);
    // 平均 1625 → 1650
    expect(leftMm).toBe(1650);
  });

  it("開始スロットが違う印は別々にスナップする", () => {
    const startA = xPctFromSignedCenterDistanceMm(-1000, W);
    const startB = xPctFromSignedCenterDistanceMm(2000, W);
    const nextA = xPctFromSignedCenterDistanceMm(-1100, W);
    const nextB = xPctFromSignedCenterDistanceMm(2200, W);
    const equalized = equalizeXPctByStartCenterDistanceSlot(
      new Map([
        ["A", nextA],
        ["B", nextB],
      ]),
      new Map([
        ["A", startA],
        ["B", startB],
      ]),
      W,
      50
    );
    expect(centerDistanceLabelMmFromMarkerCenter(equalized.get("A")!, W)).toBe(
      1100
    );
    expect(centerDistanceLabelMmFromMarkerCenter(equalized.get("B")!, W)).toBe(
      2200
    );
  });
});
