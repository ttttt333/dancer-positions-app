import { describe, expect, it } from "vitest";
import { waveRulerTicks } from "./timeFormat";

describe("waveRulerTicks", () => {
  it("uses 0.05s steps when the view is tightly zoomed", () => {
    const ticks = waveRulerTicks(10, 10.4, 10);
    expect(ticks.length).toBeGreaterThan(2);
    const steps = ticks.slice(1).map((t, i) =>
      Math.round((t - ticks[i]!) * 1000) / 1000
    );
    expect(steps.every((s) => s === 0.05)).toBe(true);
  });
});
