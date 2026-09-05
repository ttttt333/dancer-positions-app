import { describe, expect, it } from "vitest";
import { pickPattern } from "./lightingTable";
import {
  applyTasteToProfile,
  applyFeedbackToTaste,
  feedbackVarietySalt,
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

  it("applyFeedbackToTaste steers layout preferences from resuggest feedback", () => {
    const base = resolveSuggestTaste({ style: "symmetric" });
    const withImpact = applyFeedbackToTaste(base, {
      preferMoreImpact: true,
      note: "大きな円と交差で盛り上げて",
    });
    expect(withImpact.preferPatterns).toContain("vee");
    expect(withImpact.preferPatterns).toContain("circle");
    expect(withImpact.energyWeight).toBeGreaterThan(base.energyWeight);
    expect(withImpact.summary).toContain("FB:インパクト");

    const quieter = applyFeedbackToTaste(base, {
      preferLessMovement: true,
      preferFewerCrossings: true,
    });
    expect(quieter.allowCross).toBe(false);
    expect(quieter.avoidPatterns).toContain("dynamic_cross");
    expect(quieter.movementScale).toBeLessThanOrEqual(0.8);
  });

  it("feedbackVarietySalt changes when the note or flags change", () => {
    expect(feedbackVarietySalt(undefined)).toBe(0);
    const a = feedbackVarietySalt({ preferMoreImpact: true });
    const b = feedbackVarietySalt({
      preferMoreImpact: true,
      note: "もっと広がりを",
    });
    const c = feedbackVarietySalt({ preferLessMovement: true });
    expect(a).not.toBe(0);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
