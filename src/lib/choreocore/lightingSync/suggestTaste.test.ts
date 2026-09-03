import { describe, expect, it } from "vitest";
import { pickPattern } from "./lightingTable";
import {
  applyTasteToProfile,
  resolveSuggestTaste,
} from "./suggestTaste";
import { CLASS_TODDLER, CLASS_ADVANCED_MON7 } from "./classProfiles";

describe("suggestTaste", () => {
  it("puts lyric 円 at the front of preferred patterns", () => {
    const bias = resolveSuggestTaste({
      lyrics: "みんなで大きな円になって踊ろう",
    });
    expect(bias.preferPatterns[0]).toBe("circle");
    expect(bias.lyricsHits).toContain("円・輪");
    expect(bias.summary).toContain("円・輪");
  });

  it("wave style prefers flowing shapes and avoids cross", () => {
    const bias = resolveSuggestTaste({ style: "wave" });
    expect(bias.preferPatterns).toContain("circle");
    expect(bias.preferPatterns).toContain("double_u");
    expect(bias.avoidPatterns).toContain("dynamic_cross");
  });

  it("energetic vibe raises energy weight versus emotional", () => {
    const hot = resolveSuggestTaste({ vibes: ["energetic"] });
    const soft = resolveSuggestTaste({ vibes: ["emotional"] });
    expect(hot.energyWeight).toBeGreaterThan(soft.energyWeight);
  });

  it("keeps toddler class from allowing crosses even if style is dynamic", () => {
    const bias = resolveSuggestTaste({ style: "dynamic" });
    const profile = applyTasteToProfile(CLASS_TODDLER, bias);
    expect(profile.allowCrossMovement).toBe(false);
    expect(profile.maxMoveDistancePerCount).toBeLessThanOrEqual(0.45);
  });

  it("widens advanced class movement for dynamic style", () => {
    const bias = resolveSuggestTaste({ style: "dynamic" });
    const profile = applyTasteToProfile(CLASS_ADVANCED_MON7, bias);
    expect(profile.allowCrossMovement).toBe(true);
    expect(profile.maxMoveDistancePerCount).toBeGreaterThan(
      CLASS_ADVANCED_MON7.maxMoveDistancePerCount
    );
  });

  it("pickPattern salt 0 follows taste prefer over section default", () => {
    expect(
      pickPattern("verse", 0, true, undefined, {
        preferPatterns: ["circle"],
      })
    ).toBe("circle");
  });
});
