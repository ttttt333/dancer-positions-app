import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { vibrateOnCueAdvance } from "./cueAdvanceHaptic";

describe("vibrateOnCueAdvance", () => {
  const originalMatchMedia = window.matchMedia;
  const vibrate = vi.fn();

  beforeEach(() => {
    vibrate.mockReset();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("vibrates on coarse pointer devices", () => {
    window.matchMedia = vi.fn((q: string) => ({
      matches: q.includes("pointer: coarse"),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    vibrateOnCueAdvance();
    expect(vibrate).toHaveBeenCalledWith([10, 24, 14]);
  });

  it("skips on desktop fine pointer", () => {
    window.matchMedia = vi.fn((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    vibrateOnCueAdvance();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
