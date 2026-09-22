import { describe, expect, it } from "vitest";
import {
  isFormFieldKeyboardTarget,
  isModSaveKey,
  isModUndoKey,
  isTextEditingKeyboardTarget,
} from "./useEditorKeyboardShortcuts";

describe("editor keyboard shortcut matchers", () => {
  it("detects ⌘/Ctrl+S via key or code", () => {
    expect(
      isModSaveKey({
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: "s",
        code: "KeyS",
      })
    ).toBe(true);
    expect(
      isModSaveKey({
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: "S",
        code: "KeyS",
      })
    ).toBe(true);
    expect(
      isModSaveKey({
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        key: "s",
        code: "KeyS",
      })
    ).toBe(false);
  });

  it("detects ⌘/Ctrl+Z (shift optional for redo)", () => {
    expect(
      isModUndoKey({
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: "z",
        code: "KeyZ",
      })
    ).toBe(true);
    expect(
      isModUndoKey({
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        key: "z",
        code: "KeyZ",
      })
    ).toBe(true);
    expect(
      isModUndoKey({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: "z",
        code: "KeyZ",
      })
    ).toBe(false);
  });

  it("treats text inputs as text editing, but not selects", () => {
    const text = document.createElement("input");
    text.type = "text";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const select = document.createElement("select");
    expect(isTextEditingKeyboardTarget(text)).toBe(true);
    expect(isTextEditingKeyboardTarget(checkbox)).toBe(false);
    expect(isTextEditingKeyboardTarget(select)).toBe(false);
    expect(isFormFieldKeyboardTarget(select)).toBe(true);
  });
});
