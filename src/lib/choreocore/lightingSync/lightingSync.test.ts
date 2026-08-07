/**
 * 照明連動エンジンの基本テスト
 */
import { describe, expect, it } from "vitest";
import {
  CLASS_ADVANCED_MON7,
  CLASS_TODDLER,
  generateLightingSyncSuggestion,
  evaluateMoveConstraints,
  adviseLightingFromCorpus,
  corpusSummary,
  LIGHTING_PLAN_SHOWS,
} from "./index";

function peaksWithChorus(duration = 120, bpm = 128): number[] {
  const n = 2048;
  const out: number[] = [];
  const bps = bpm / 60;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * duration;
    const beat = Math.abs(Math.sin(Math.PI * 2 * bps * t));
    const chorus = t > 40 && t < 75 ? 0.85 : 0.2;
    const drop = t > 75 && t < 90 ? 0.95 : 0;
    out.push(0.25 * beat + chorus + drop);
  }
  return out;
}

describe("lightingSync pipeline", () => {
  it("returns formations JSON with lighting presets and FCP", () => {
    const payload = generateLightingSyncSuggestion({
      peaks: peaksWithChorus(),
      durationSec: 120,
      memberIds: ["m1", "m2", "m3", "m4", "m5", "m6"],
      classProfile: CLASS_ADVANCED_MON7,
      targetMaxFormations: 10,
    });
    expect(payload.classId).toBe("mon_07pm");
    expect(payload.audioAnalysis.bpm).toBeGreaterThan(60);
    expect(payload.formations.length).toBeGreaterThan(1);
    expect(payload.formations[0]!.timestamp).toBe(0);
    expect(payload.formations[0]!.lightingPreset).toBe("pin_spot_dark");
    for (const f of payload.formations) {
      expect(f.positions).toHaveLength(6);
      expect(f.positions.every((p) => p.poseLevel)).toBe(true);
    }
  });

  it("toddler constraints clip long moves", () => {
    const prev = [
      { memberId: "m1", x: 0, y: 0, poseLevel: "stand" as const },
      { memberId: "m2", x: 2, y: 0, poseLevel: "stand" as const },
    ];
    const next = [
      { memberId: "m1", x: 5, y: 3, poseLevel: "stand" as const },
      { memberId: "m2", x: 2, y: 0, poseLevel: "stand" as const },
    ];
    const { warnings, corrected } = evaluateMoveConstraints(
      prev,
      next,
      CLASS_TODDLER,
      4 // max = 0.3*4 = 1.2m
    );
    expect(warnings.some((w) => w.code === "MOVE_LIMIT")).toBe(true);
    const m1 = corrected.find((c) => c.memberId === "m1")!;
    const d = Math.hypot(m1.x - 0, m1.y - 0);
    expect(d).toBeLessThanOrEqual(1.2 + 0.05);
  });

  it("loads recital lighting plan corpus", () => {
    const s = corpusSummary();
    expect(s.showCount).toBeGreaterThanOrEqual(18);
    expect(s.cueCount).toBeGreaterThanOrEqual(200);
    expect(LIGHTING_PLAN_SHOWS.some((x) => x.trackTitle.includes("BLOOM"))).toBe(
      true
    );
    expect(
      LIGHTING_PLAN_SHOWS.some((x) => /ちびちび|ちびちび/.test(x.className))
    ).toBe(true);
  });

  it("matches intro progress to pin-spot corpus cue", () => {
    const advice = adviseLightingFromCorpus({
      progress: 0.02,
      sectionType: "intro",
      energyLevel: 0.3,
      dancerCount: 30,
      ageGroup: "advanced",
      fallbackPreset: "guide_mono",
    });
    expect(advice.matches.length).toBeGreaterThan(0);
    expect(advice.preferCorpus).toBe(true);
    expect(advice.lightingPreset).toBe("pin_spot_dark");
    expect(advice.referenceNote.length).toBeGreaterThan(0);
  });

  it("prefers chibi shows for toddler age group", () => {
    const toddler = adviseLightingFromCorpus({
      progress: 0.15,
      sectionType: "verse",
      energyLevel: 0.4,
      dancerCount: 12,
      ageGroup: "toddler",
      fallbackPreset: "guide_mono",
    });
    expect(toddler.matches.length).toBeGreaterThan(0);
    const titles = toddler.matches.map((m) => m.showTitle).join(" ");
    expect(/ちび|超入門|キッズ/.test(titles)).toBe(true);
  });

  it("matches mid-song chorus to bright warm from BLOOM cues", () => {
    const advice = adviseLightingFromCorpus({
      progress: 0.2,
      sectionType: "chorus",
      energyLevel: 0.8,
      fallbackPreset: "guide_mono",
    });
    expect(advice.preferCorpus).toBe(true);
    expect(
      advice.lightingPreset === "full_bright_warm" ||
        advice.colorMood === "yellow" ||
        advice.colorMood === "colorful"
    ).toBe(true);
  });

  it("attaches lightingNote from corpus on generate", () => {
    const payload = generateLightingSyncSuggestion({
      peaks: peaksWithChorus(185),
      durationSec: 185,
      memberIds: ["m1", "m2", "m3", "m4"],
      classProfile: CLASS_ADVANCED_MON7,
      targetMaxFormations: 8,
    });
    const withNote = payload.formations.filter((f) => f.lightingNote);
    expect(withNote.length).toBeGreaterThan(0);
    expect(payload.formations.some((f) => f.colorMood)).toBe(true);
  });
});
