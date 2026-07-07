import { describe, expect, it } from "vitest";
import {
  computeEditorViewportKey,
  isEditorMobileStackViewport,
  resolveWideEditorLayout,
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

  it("treats layout viewport without scrollbar gutter like clientWidth", () => {
    expect(computeEditorViewportKey(1263, 800)).toBe("01");
    expect(computeEditorViewportKey(767, 1024)).toBe("10");
  });

  it("does not mobile-stack Windows laptop with scaled short height", () => {
    expect(
      isEditorMobileStackViewport(1093, 614, { desktopPointer: true })
    ).toBe(false);
    expect(computeEditorViewportKey(1093, 614, { desktopPointer: true })).toBe(
      "01"
    );
  });

  it("does not mobile-stack desktop with DevTools docked (narrow width)", () => {
    expect(
      isEditorMobileStackViewport(725, 551, { desktopPointer: true })
    ).toBe(false);
    expect(computeEditorViewportKey(725, 551, { desktopPointer: true })).toBe(
      "00"
    );
  });

  it("still mobile-stacks phones", () => {
    expect(
      isEditorMobileStackViewport(390, 844, { desktopPointer: false })
    ).toBe(true);
  });
});

describe("resolveWideEditorLayout", () => {
  it("is exported and callable", () => {
    expect(typeof resolveWideEditorLayout).toBe("function");
  });
});
