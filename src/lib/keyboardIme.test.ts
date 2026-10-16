import { describe, expect, it } from "vitest";
import { isImeComposingKey } from "./keyboardIme";

describe("isImeComposingKey", () => {
  it("detects React isComposing", () => {
    expect(isImeComposingKey({ isComposing: true, keyCode: 13 })).toBe(true);
  });

  it("detects nativeEvent.isComposing", () => {
    expect(
      isImeComposingKey({ nativeEvent: { isComposing: true }, keyCode: 13 })
    ).toBe(true);
  });

  it("detects keyCode 229", () => {
    expect(isImeComposingKey({ keyCode: 229 })).toBe(true);
  });

  it("returns false for a normal Enter", () => {
    expect(
      isImeComposingKey({
        isComposing: false,
        nativeEvent: { isComposing: false },
        keyCode: 13,
      })
    ).toBe(false);
  });
});
