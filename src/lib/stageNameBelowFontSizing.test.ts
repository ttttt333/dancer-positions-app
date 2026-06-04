import { describe, expect, it } from "vitest";
import {
  clampNameBelowFontPx,
  computeNameBelowFontResizeDraftSizes,
  effectiveNameBelowFontPx,
  stableDancerMarkerPxForNameFont,
} from "./stageNameBelowFontSizing";

describe("stageNameBelowFontSizing", () => {
  it("個別 nameBelowFontPx を優先する", () => {
    expect(effectiveNameBelowFontPx({ nameBelowFontPx: 20 }, 24)).toBe(20);
  });

  it("ドラフト中は draft を優先する", () => {
    expect(
      effectiveNameBelowFontPx({ nameBelowFontPx: 20 }, 24, 16)
    ).toBe(16);
  });

  it("上下ドラッグで 1 人のサイズが変わる", () => {
    const draft = computeNameBelowFontResizeDraftSizes({
      startFonts: new Map([["a", 14]]),
      deltaY: -20,
      bulk: false,
    });
    expect(draft.get("a")).toBeGreaterThan(14);
  });

  it("複数選択は同じフォントサイズになる", () => {
    const draft = computeNameBelowFontResizeDraftSizes({
      startFonts: new Map([
        ["a", 12],
        ["b", 16],
      ]),
      deltaY: -10,
      bulk: true,
      anchorFontPx: 16,
    });
    expect(draft.get("a")).toBe(draft.get("b"));
  });

  it("クランプする", () => {
    expect(clampNameBelowFontPx(999)).toBe(48);
    expect(clampNameBelowFontPx(1)).toBe(8);
  });

  it("名下フォント既定は床幅連動の markerPx ではなく保存直径を使う", () => {
    expect(stableDancerMarkerPxForNameFont({ sizePx: 22 }, 18)).toBe(22);
    expect(stableDancerMarkerPxForNameFont({}, 24)).toBe(24);
    const stablePx = stableDancerMarkerPxForNameFont({}, 24);
    const floorPx = 99;
    expect(effectiveNameBelowFontPx({}, stablePx)).toBe(
      effectiveNameBelowFontPx({}, 24)
    );
    expect(effectiveNameBelowFontPx({}, stablePx)).not.toBe(
      effectiveNameBelowFontPx({}, floorPx)
    );
  });
});
