import { describe, expect, it } from "vitest";
import {
  computeEditorViewportKey,
  resolveWideEditorLayout,
  subscribeWideEditorLayout,
} from "./editorViewport";

describe("editorViewport", () => {
  it("detects mobile stack when short side < 768", () => {
    expect(computeEditorViewportKey(390, 844)).toBe("10");
    expect(computeEditorViewportKey(844, 390)).toBe("11");
  });

  it("detects desktop when short side >= 768", () => {
    expect(computeEditorViewportKey(1280, 800)).toBe("01");
    expect(computeEditorViewportKey(800, 1280)).toBe("00");
  });

  /** Windows 等で innerWidth と clientWidth が数 px ずれる場合、clientWidth 基準に揃える */
  it("treats layout viewport without scrollbar gutter like clientWidth", () => {
    expect(computeEditorViewportKey(1263, 800)).toBe("01");
    expect(computeEditorViewportKey(767, 1024)).toBe("10");
  });
});

describe("resolveWideEditorLayout", () => {
  it("is exported and callable", () => {
    expect(typeof resolveWideEditorLayout).toBe("function");
  });
});
