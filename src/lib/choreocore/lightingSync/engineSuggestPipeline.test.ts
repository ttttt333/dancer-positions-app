import { afterEach, describe, expect, it } from "vitest";
import { LAYOUT_PRESET_LABELS } from "../../formationLayouts";
import { CLASS_ADVANCED_MON7, CLASS_TODDLER } from "./classProfiles";
import { resolveSuggestTaste, applyFeedbackToTaste, feedbackVarietySalt } from "./suggestTaste";
import { isCrossLayoutPreset } from "./layoutPresetBridge";
import { travelDurationSec } from "./suggestTravelTiming";
import { phase1FromPeaks, runEngineAppSuggest } from "./engineSuggestPipeline";
import { MOCK_CALLBACK_CHORUS_FAMILIES } from "../engine/music/sectionFamilyFixtures";
import { cuesAreTimeOrdered } from "../engine/cue/cueQuality";
import { setMusicEnginePhase12EnabledForTests } from "./musicEngineFlag";
import { analyzeAndCacheRealPhase1 } from "../engine/audio/analyzeAndCacheRealPhase1";
import { clearRealPhase1Cache } from "../engine/audio/realPhase1Cache";
import { makeQuietThenHit } from "../engine/audio/testBuffers";
import { resetMusicEngineTrace } from "../engine/music/productionTimeline";
import type { DancerSpot } from "../../types/choreography";

function peaksWithChorus(duration = 80, bpm = 120): number[] {
  const n = 400;
  const out: number[] = [];
  const bps = bpm / 60;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * duration;
    const beat = Math.abs(Math.sin(Math.PI * 2 * bps * t));
    const chorus = t > 24 && t < 48 ? 0.85 : 0.22;
    const drop = t > 48 && t < 56 ? 0.95 : 0;
    out.push(0.25 * beat + chorus + drop);
  }
  return out;
}

function seeds(n = 6): DancerSpot[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `dancer-${i + 1}`,
    label: String(i + 1),
    xPct: 20 + (i % 3) * 20,
    yPct: 30 + Math.floor(i / 3) * 20,
    colorIndex: i % 12,
  }));
}

describe("engineSuggestPipeline", () => {
  afterEach(() => {
    setMusicEnginePhase12EnabledForTests(undefined);
    clearRealPhase1Cache();
    resetMusicEngineTrace();
  });

  it("builds phase1 whose duration matches the song", () => {
    const phase1 = phase1FromPeaks(peaksWithChorus(64), 64, 128);
    expect(phase1.duration).toBeGreaterThan(60);
    expect(phase1.tempo.bpm).toBe(128);
    expect(phase1.beats.length).toBeGreaterThan(10);
  });

  it("returns formations keyed by seed dancer ids", () => {
    const people = seeds(6);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 0, time: 0, score: 0.4, tier: "minor" },
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 16, time: 32, score: 0.8, tier: "major", section_type: "CHORUS" },
        { eight_index: 24, time: 48, score: 0.7, tier: "medium" },
      ],
      seedDancers: people,
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic", vibes: ["energetic"] }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    expect(result!.formations.length).toBeGreaterThan(1);
    const ids = people.map((p) => p.id).sort();
    for (const f of result!.formations) {
      expect(f.dancers.map((d) => d.id).sort()).toEqual(ids);
    }
    expect(result!.cues.length).toBe(result!.formations.length);
    expect(result!.reasoning.some((l) => l.includes("曲理解エンジン"))).toBe(true);
    expect(result!.reasoning.some((l) => l.includes("エディタ雛形"))).toBe(true);
    const labels = Object.values(LAYOUT_PRESET_LABELS);
    expect(
      result!.formations.some((f) => labels.some((label) => f.name.includes(label)))
    ).toBe(true);
    for (const f of result!.formations) {
      expect(f.dancers.map((d) => d.id)).toEqual(people.map((p) => p.id));
    }
  });

  it("uses the specified cue count when change points are far enough apart", () => {
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(90),
      durationSec: 90,
      bpm: 128,
      remoteChangePoints: Array.from({ length: 20 }, (_, i) => ({
        eight_index: i * 2,
        time: i * 4,
        score: 0.6 + (i % 3) * 0.1,
        tier: i % 4 === 0 ? ("major" as const) : ("medium" as const),
      })),
      seedDancers: seeds(8),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({}),
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.formations.length).toBe(6);
    expect(result!.cues.length).toBe(6);
    expect(result!.evaluation.cues.length).toBeGreaterThan(0);
    expect(result!.evaluation.formationRankings.length).toBe(result!.formations.length);
  });

  it("honors both fewer and more cue counts than the default dozen", () => {
    const base = {
      peaks: peaksWithChorus(240),
      durationSec: 240,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 0, time: 0, score: 0.4, tier: "minor" as const },
        {
          eight_index: 8,
          time: 32,
          score: 0.75,
          tier: "medium" as const,
          section_type: "PRE_CHORUS" as const,
        },
        {
          eight_index: 12,
          time: 48,
          score: 0.95,
          tier: "major" as const,
          section_type: "CHORUS_START" as const,
        },
        {
          eight_index: 24,
          time: 96,
          score: 0.7,
          tier: "medium" as const,
          section_type: "PRE_CHORUS" as const,
        },
        {
          eight_index: 28,
          time: 112,
          score: 0.9,
          tier: "major" as const,
          section_type: "CHORUS_START" as const,
        },
        {
          eight_index: 40,
          time: 160,
          score: 0.85,
          tier: "major" as const,
          section_type: "DROP" as const,
        },
        {
          eight_index: 52,
          time: 208,
          score: 0.6,
          tier: "medium" as const,
          section_type: "OUTRO" as const,
        },
        ...Array.from({ length: 18 }, (_, i) => ({
          eight_index: 2 + i * 3,
          time: 12 + i * 12,
          score: 0.55,
          tier: "medium" as const,
        })),
      ],
      seedDancers: seeds(8),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({}),
    };
    const six = runEngineAppSuggest({ ...base, targetCueCount: 6 });
    const sixteen = runEngineAppSuggest({ ...base, targetCueCount: 16 });
    expect(six!.cues.length).toBe(6);
    expect(sixteen!.cues.length).toBe(16);
    const sixTimes = six!.cues.map((c) => c.tStartSec);
    expect(sixTimes.some((t) => Math.abs(t - 32) < 4)).toBe(true);
    expect(sixTimes.some((t) => Math.abs(t - 48) < 4)).toBe(true);
  });

  it("places cues on irregular music times instead of even clock slices", () => {
    const duration = 266;
    const peaks = peaksWithChorus(duration);
    const remote = [
      { eight_index: 0, time: 0, score: 0.3, tier: "minor" as const },
      {
        eight_index: 4,
        time: 18,
        score: 0.7,
        tier: "medium" as const,
        section_type: "PRE_CHORUS" as const,
      },
      {
        eight_index: 8,
        time: 32,
        score: 0.95,
        tier: "major" as const,
        section_type: "CHORUS_START" as const,
      },
      {
        eight_index: 16,
        time: 64,
        score: 0.6,
        tier: "medium" as const,
        section_type: "VERSE" as const,
      },
      {
        eight_index: 22,
        time: 88,
        score: 0.75,
        tier: "medium" as const,
        section_type: "PRE_CHORUS" as const,
      },
      {
        eight_index: 26,
        time: 104,
        score: 0.92,
        tier: "major" as const,
        section_type: "CHORUS_START" as const,
      },
      {
        eight_index: 36,
        time: 144,
        score: 0.55,
        tier: "medium" as const,
      },
      {
        eight_index: 42,
        time: 168,
        score: 0.8,
        tier: "major" as const,
        section_type: "DROP" as const,
      },
      {
        eight_index: 50,
        time: 200,
        score: 0.5,
        tier: "medium" as const,
      },
      {
        eight_index: 58,
        time: 232,
        score: 0.65,
        tier: "medium" as const,
        section_type: "OUTRO" as const,
      },
    ];
    const result = runEngineAppSuggest({
      peaks,
      durationSec: duration,
      bpm: 120,
      remoteChangePoints: remote,
      seedDancers: seeds(12),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic" }),
      targetCueCount: 12,
    });
    expect(result).not.toBeNull();
    expect(result!.cues.length).toBe(12);
    const starts = [...result!.cues]
      .map((c) => c.tStartSec)
      .sort((a, b) => a - b);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]!);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance =
      gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / Math.max(1, gaps.length);
    // 均等割り（約22秒）だと分散がほぼ0。音楽連動ならギャップがバラつく
    expect(variance).toBeGreaterThan(8);
    expect(starts.some((t) => Math.abs(t - 32) < 3)).toBe(true);
    expect(starts.some((t) => Math.abs(t - 104) < 3)).toBe(true);

    const layouts = result!.lightingSyncPayload.formations
      .map((f) => f.layoutPresetId)
      .filter((id): id is string => Boolean(id));
    const unique = new Set(layouts);
    expect(unique.size).toBeGreaterThanOrEqual(5);
    expect(
      layouts.some((id) =>
        /pyramid|stagger|grid|diamond|two_rows|cluster/.test(id)
      )
    ).toBe(true);
    const hWide = layouts.filter((id) =>
      /^(line|line_front|fan_wide|wing_spread|arc)$/.test(id)
    ).length;
    expect(hWide).toBeLessThanOrEqual(Math.ceil(layouts.length / 3));
  });

  it("toddler suggestions never pick cross layouts", () => {
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 0, time: 0, score: 0.4, tier: "minor" },
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 16, time: 32, score: 0.8, tier: "major", section_type: "DROP" },
      ],
      seedDancers: seeds(6),
      profile: CLASS_TODDLER,
      tasteBias: resolveSuggestTaste({ style: "dynamic" }),
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    const layoutIds = result!.lightingSyncPayload.formations
      .map((f) => f.layoutPresetId)
      .filter((id): id is string => Boolean(id));
    expect(layoutIds.some(isCrossLayoutPreset)).toBe(false);
  });

  it("leaves a 4-count travel gap between formations", () => {
    const bpm = 120;
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm,
      remoteChangePoints: [
        { eight_index: 0, time: 0, score: 0.4, tier: "minor" },
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 16, time: 32, score: 0.8, tier: "major", section_type: "CHORUS" },
        { eight_index: 24, time: 48, score: 0.7, tier: "medium" },
      ],
      seedDancers: seeds(6),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic" }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    expect(result!.cues.length).toBeGreaterThan(1);
    const travel = travelDurationSec(bpm);
    const sorted = [...result!.cues].sort((a, b) => a.tStartSec - b.tStartSec);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const gap = sorted[i + 1]!.tStartSec - sorted[i]!.tEndSec;
      expect(gap).toBeGreaterThanOrEqual(travel - 0.06);
    }
  });

  it("changes dancer positions at a chorus hit", () => {
    const people = seeds(6);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 0, time: 0, score: 0.4, tier: "minor" },
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 16, time: 32, score: 0.8, tier: "major", section_type: "CHORUS" },
      ],
      seedDancers: people,
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic", vibes: ["energetic"] }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    const sorted = [...result!.cues].sort((a, b) => a.tStartSec - b.tStartSec);
    const chorusCue =
      sorted.find((c) => Math.abs(c.tStartSec - 16) < 4) ??
      sorted.find((c) => c.tStartSec >= 12 && c.tStartSec <= 28);
    expect(chorusCue).toBeDefined();
    const prevCue = sorted.filter((c) => c.tStartSec < (chorusCue!.tStartSec - 0.05)).at(-1);
    expect(prevCue).toBeDefined();
    const byId = new Map(result!.formations.map((f) => [f.id, f] as const));
    const a = byId.get(prevCue!.formationId)!.dancers;
    const b = byId.get(chorusCue!.formationId)!.dancers;
    const mean = a.reduce((sum, d) => {
      const n = b.find((x) => x.id === d.id);
      if (!n) return sum;
      return sum + Math.hypot(d.xPct - n.xPct, d.yPct - n.yPct);
    }, 0) / a.length;
    expect(mean).toBeGreaterThan(8);
  });

  it("places a formation at A-melody end and a different one at chorus", () => {
    const people = seeds(6);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 6, time: 12, score: 0.7, tier: "medium", section_type: "PRE_CHORUS" },
        { eight_index: 10, time: 20, score: 0.95, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 18, time: 36, score: 0.6, tier: "medium", section_type: "VERSE" },
      ],
      seedDancers: people,
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "symmetric" }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    const sorted = [...result!.cues].sort((a, b) => a.tStartSec - b.tStartSec);
    const pre = sorted.find((c) => Math.abs(c.tStartSec - 12) < 3);
    const chorus = sorted.find((c) => Math.abs(c.tStartSec - 20) < 3);
    expect(pre).toBeDefined();
    expect(chorus).toBeDefined();
    expect(pre!.name).toContain("閉じる");
    expect(chorus!.name).toMatch(/広げる|大転換/);
    expect(pre!.formationId).not.toBe(chorus!.formationId);
    const byId = new Map(result!.formations.map((f) => [f.id, f] as const));
    const a = byId.get(pre!.formationId)!.dancers;
    const b = byId.get(chorus!.formationId)!.dancers;
    const mean =
      a.reduce((sum, d) => {
        const n = b.find((x) => x.id === d.id);
        if (!n) return sum;
        return sum + Math.hypot(d.xPct - n.xPct, d.yPct - n.yPct);
      }, 0) / a.length;
    expect(mean).toBeGreaterThan(5);
    const layoutIds = result!.lightingSyncPayload.formations
      .map((f) => f.layoutPresetId)
      .filter((id): id is string => Boolean(id));
    expect(layoutIds.some((id) => id.startsWith("extra_"))).toBe(false);
    expect(layoutIds.some((id) => /pinwheel|heart|spiral/.test(id))).toBe(false);
    expect(result!.reasoning.some((l) => l.includes("PRE_CHORUS"))).toBe(true);
  });

  it("PRE_CHORUS contracts on the legacy path as well (FLAG OFF)", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 6, time: 12, score: 0.7, tier: "medium", section_type: "PRE_CHORUS" },
        { eight_index: 10, time: 20, score: 0.95, tier: "major", section_type: "CHORUS_START" },
      ],
      seedDancers: seeds(6),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "symmetric" }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    const sorted = [...result!.cues].sort((a, b) => a.tStartSec - b.tStartSec);
    const pre = sorted.find((c) => Math.abs(c.tStartSec - 12) < 3);
    const chorus = sorted.find((c) => Math.abs(c.tStartSec - 20) < 3);
    expect(pre).toBeDefined();
    expect(chorus).toBeDefined();
    expect(pre!.name).toContain("閉じる");
    expect(chorus!.name).toMatch(/広げる|大転換/);
    expect(result!.musicEngine).toBeUndefined();
  });

  it("F. FLAG OFF does not attach Real Phase2 musicEngine", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
      ],
      seedDancers: seeds(6),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({}),
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.musicEngine).toBeUndefined();
    expect(result!.musicEngine?.formationIntelligence).toBeUndefined();
  });

  it("D. FLAG ON cache miss falls back to legacy suggest", () => {
    setMusicEnginePhase12EnabledForTests(true);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      audioCacheKey: "missing-stage2",
      remoteChangePoints: [
        { eight_index: 8, time: 16, score: 0.9, tier: "major", section_type: "CHORUS_START" },
      ],
      seedDancers: seeds(6),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({}),
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.musicEngine?.analysisSource).toBe("synthetic-legacy");
    expect(result!.musicEngine?.fallbackReason).toBe("cache-miss");
    expect(result!.musicEngine?.preservedPhase2).toBeNull();
    expect(result!.musicEngine?.formationIntelligence).toBeUndefined();
    expect(result!.musicEngine?.transitionIntelligence).toBeUndefined();
    expect(result!.formations.length).toBeGreaterThan(0);
  });

  it("C+gap. FLAG ON cache hit: Cue uses Real Timeline, remote does not overwrite", async () => {
    setMusicEnginePhase12EnabledForTests(true);
    await analyzeAndCacheRealPhase1({
      audioBuffer: makeQuietThenHit({ durationSec: 3.0, hitTimeSec: 1.4 }),
      cacheKey: "stage2-suggest",
      force: true,
    });
    const remote = [
      { eight_index: 0, time: 0, score: 0.4, tier: "minor" as const },
      {
        eight_index: 8,
        time: 16,
        score: 0.9,
        tier: "major" as const,
        section_type: "CHORUS_START" as const,
      },
    ];
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(80),
      durationSec: 80,
      bpm: 120,
      audioCacheKey: "stage2-suggest",
      remoteChangePoints: remote,
      seedDancers: seeds(6),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic" }),
      targetCueCount: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.musicEngine?.analysisSource).toBe("engine-phase12");
    expect(result!.musicEngine?.phase1Provenance).toBe("real");
    expect(result!.musicEngine?.overwriteSites).toEqual([]);
    const preserved = result!.musicEngine?.preservedPhase2;
    expect(preserved).toBeTruthy();
    expect(preserved!.sections.length).toBeGreaterThan(0);
    expect(preserved!.phrases.length).toBeGreaterThan(0);
    expect(Array.isArray(preserved!.changePoints)).toBe(true);
    expect(Array.isArray(preserved!.eventClusters)).toBe(true);
    const cueSections = result!.evaluation.sections.map((s) => s.id).join("|");
    const preservedIds = preserved!.sections.map((s) => s.id).join("|");
    expect(cueSections).toBe(preservedIds);
    expect(result!.evaluation.sections.some((s) => s.id.includes("16000"))).toBe(
      false
    );
    expect(
      preserved!.eventClusters.some((c) => c.id.startsWith("fly-ec-"))
    ).toBe(false);
    expect(result!.musicEngine?.timeline?.source).toBe("engine-phase12");
    expect(result!.musicEngine?.cueQuality?.source).toBe("engine-phase12");
    expect(result!.musicEngine?.cueQuality?.preChorusBeforeChorus).toBe(true);
    expect(cuesAreTimeOrdered(result!.evaluation.cues)).toBe(true);
    const qualityRows = result!.musicEngine?.cueQuality?.rows ?? [];
    expect(qualityRows.some((r) => r.sourceEventId.length > 0)).toBe(true);
    const intents = result!.musicEngine?.choreographicIntents?.intents ?? [];
    expect(intents.length).toBeGreaterThan(0);
    expect(intents.every((i) => i.primary.sourceEventIds.length > 0)).toBe(true);
    expect(
      intents.every(
        (i) => !("x" in i.primary) && !("positions" in i.primary)
      )
    ).toBe(true);
    const intel = result!.musicEngine?.formationIntelligence;
    expect(intel?.recommendations.length).toBeGreaterThan(0);
    expect(intel?.recommendations.some((r) => r.primary)).toBe(true);
    const motion = result!.musicEngine?.transitionIntelligence;
    expect(motion?.recommendations.length).toBeGreaterThan(0);
    expect(motion?.analysisVersion.startsWith("7.")).toBe(true);
    const people = seeds(6);
    const ids = people.map((p) => p.id);
    for (const f of result!.formations) {
      expect(f.dancers.map((d) => d.id)).toEqual(ids);
    }
    expect(result!.reasoning.some((l) => l.includes("エディタ雛形"))).toBe(true);
  });

  it("reuses the first chorus layout on repeat and scales the final chorus", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const people = seeds(6);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(104),
      durationSec: 104,
      bpm: 120,
      remoteChangePoints: [
        { eight_index: 2, time: 4, score: 0.4, tier: "minor", section_type: "VERSE" },
        { eight_index: 8, time: 16, score: 0.7, tier: "medium", section_type: "PRE_CHORUS" },
        { eight_index: 10, time: 20, score: 0.95, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 18, time: 36, score: 0.5, tier: "medium", section_type: "VERSE" },
        { eight_index: 26, time: 52, score: 0.93, tier: "major", section_type: "CHORUS_START" },
        { eight_index: 42, time: 84, score: 0.97, tier: "major", section_type: "CHORUS" },
      ],
      sectionFamilies: MOCK_CALLBACK_CHORUS_FAMILIES,
      seedDancers: people,
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "symmetric" }),
      targetCueCount: 8,
    });
    expect(result).not.toBeNull();
    const frames = result!.lightingSyncPayload.formations;
    const first = frames.find((f) => f.timestamp >= 20 && f.timestamp < 36);
    const repeat = frames.find((f) => f.timestamp >= 52 && f.timestamp < 68);
    const finale = frames.find((f) => f.timestamp >= 84 && f.timestamp < 100);
    expect(first?.chorusFamilyId).toBe("chorus-A");
    expect(repeat?.chorusFamilyId).toBe("chorus-A");
    expect(repeat?.layoutPresetId).toBe(first?.layoutPresetId);
    expect(repeat?.callbackVariation).toBe("repeat");
    expect(finale?.chorusFamilyId).toBe("chorus-A");
    expect(finale?.layoutPresetId).toBe(first?.layoutPresetId);
    expect(finale?.callbackVariation).toBe("final");
    expect(finale?.scale).toBe("max");
    expect(finale?.presetName).toContain("特大");
    const byId = new Map(result!.formations.map((f) => [f.id, f] as const));
    const repeatCue = result!.cues.find((c) => Math.abs(c.tStartSec - (repeat?.timestamp ?? -1)) < 0.2);
    const finaleCue = result!.cues.find((c) => Math.abs(c.tStartSec - (finale?.timestamp ?? -1)) < 0.2);
    const firstCue = result!.cues.find((c) => Math.abs(c.tStartSec - (first?.timestamp ?? -1)) < 0.2);
    const firstSpots = firstCue ? byId.get(firstCue.formationId)?.dancers : undefined;
    const finaleSpots = finaleCue ? byId.get(finaleCue.formationId)?.dancers : undefined;
    expect(repeatCue?.name).toContain("コールバック");
    if (firstSpots && finaleSpots && firstSpots.length === finaleSpots.length) {
      const span = (spots: typeof firstSpots) => {
        const xs = spots.map((d) => d.xPct);
        return Math.max(...xs) - Math.min(...xs);
      };
      expect(span(finaleSpots)).toBeGreaterThan(span(firstSpots) - 0.01);
    }
  });

  it("keeps late cues from reusing the same layout many times in a row", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(240),
      durationSec: 240,
      bpm: 120,
      remoteChangePoints: Array.from({ length: 28 }, (_, i) => ({
        eight_index: i * 3,
        time: i * 8,
        score: 0.55 + (i % 5) * 0.08,
        tier: i % 3 === 0 ? ("major" as const) : ("medium" as const),
        section_type:
          i % 7 === 0
            ? ("CHORUS_START" as const)
            : i % 7 === 6
              ? ("PRE_CHORUS" as const)
              : ("VERSE" as const),
      })),
      seedDancers: seeds(8),
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic", vibes: ["energetic"] }),
      targetCueCount: 16,
    });
    expect(result).not.toBeNull();
    const layouts = result!.lightingSyncPayload.formations.map(
      (f) => f.layoutPresetId ?? f.presetName
    );
    expect(layouts.length).toBe(16);
    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < layouts.length; i += 1) {
      if (layouts[i] === layouts[i - 1]) run += 1;
      else run = 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(2);
    const unique = new Set(layouts.filter(Boolean));
    expect(unique.size).toBeGreaterThanOrEqual(8);
    const uCount = layouts.filter((id) => id === "u_shape").length;
    expect(uCount).toBeLessThanOrEqual(3);
  });

  it("keeps suggested formations from collapsing into a center pile", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const people = seeds(16);
    const result = runEngineAppSuggest({
      peaks: peaksWithChorus(120),
      durationSec: 120,
      bpm: 120,
      remoteChangePoints: Array.from({ length: 18 }, (_, i) => ({
        eight_index: i * 2,
        time: i * 6,
        score: 0.7,
        tier: i % 4 === 0 ? ("major" as const) : ("medium" as const),
      })),
      seedDancers: people,
      profile: CLASS_ADVANCED_MON7,
      tasteBias: resolveSuggestTaste({ style: "dynamic" }),
      targetCueCount: 12,
    });
    expect(result).not.toBeNull();
    for (const f of result!.formations) {
      const minD = Math.min(
        ...f.dancers.flatMap((a, i) =>
          f.dancers.slice(i + 1).map((b) => {
            const dx = ((a.xPct - b.xPct) / 100) * 12;
            const dy = ((a.yPct - b.yPct) / 100) * 8;
            return Math.hypot(dx, dy);
          })
        )
      );
      expect(minD).toBeGreaterThanOrEqual(0.75);
      const xs = f.dancers.map((d) => d.xPct);
      const spanX = Math.max(...xs) - Math.min(...xs);
      expect(spanX).toBeGreaterThan(12);
    }
  });

  it("changes standing layouts when feedback salt and taste are applied", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const baseInput = {
      peaks: peaksWithChorus(120),
      durationSec: 120,
      bpm: 120,
      remoteChangePoints: Array.from({ length: 16 }, (_, i) => ({
        eight_index: i * 2,
        time: i * 6,
        score: 0.6,
        tier: "medium" as const,
      })),
      seedDancers: seeds(6),
      profile: CLASS_ADVANCED_MON7,
      targetCueCount: 10,
    };
    const plainBias = resolveSuggestTaste({ style: "symmetric" });
    const a = runEngineAppSuggest({
      ...baseInput,
      tasteBias: plainBias,
      layoutVarietySalt: 0,
    });
    const feedback = {
      preferMoreImpact: true,
      note: "円とV字でインパクトを",
    };
    const b = runEngineAppSuggest({
      ...baseInput,
      tasteBias: applyFeedbackToTaste(plainBias, feedback),
      layoutVarietySalt: feedbackVarietySalt(feedback),
    });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const sig = (
      frames: NonNullable<typeof a>["lightingSyncPayload"]["formations"]
    ) =>
      frames
        .map(
          (f) =>
            `${f.layoutPresetId ?? ""}:${(f.positions ?? [])
              .map((m) => `${Math.round(m.x * 10)},${Math.round(m.y * 10)}`)
              .join("|")}`
        )
        .join("||");
    expect(sig(a!.lightingSyncPayload.formations)).not.toBe(
      sig(b!.lightingSyncPayload.formations)
    );
  });
});
