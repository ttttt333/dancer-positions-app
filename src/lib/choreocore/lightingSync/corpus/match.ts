/**
 * 蓄積照明プランから FCP に近いキューを検索し、プリセットを上書き提案する
 */

import { LIGHTING_PLAN_SHOWS } from "./shows";
import type { LightingPresetId, SectionType } from "../types";
import type {
  CorpusLightingMatch,
  LightingColorMood,
  LightingPlanShow,
} from "./types";

export type LightingCorpusAdvice = {
  lightingPreset: LightingPresetId;
  colorMood: LightingColorMood;
  referenceNote: string;
  referenceShowTitle?: string;
  matches: CorpusLightingMatch[];
  preferCorpus: boolean;
};

export type CorpusMatchContext = {
  progress: number;
  sectionType: SectionType;
  energyLevel: number;
  /** 出演人数（近い演目を優先） */
  dancerCount?: number;
  /** toddler / elementary / advanced */
  ageGroup?: "toddler" | "elementary" | "advanced";
  /** 直前フレームのプリセット（連続重複を避ける） */
  avoidPreset?: LightingPresetId;
  topK?: number;
  shows?: LightingPlanShow[];
};

const SECTION_COMPAT: Record<SectionType, SectionType[]> = {
  intro: ["intro", "verse"],
  verse: ["verse", "intro"],
  chorus: ["chorus", "drop"],
  drop: ["drop", "chorus", "se_trigger"],
  se_trigger: ["se_trigger", "drop", "verse"],
  outro: ["outro", "chorus"],
};

function progressOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number
): number {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return Math.max(0, hi - lo);
}

function ageAffinity(
  show: LightingPlanShow,
  ageGroup?: CorpusMatchContext["ageGroup"]
): number {
  if (!ageGroup) return 0;
  const name = `${show.className} ${show.title}`.toLowerCase();
  const isChibi = /ちび|ちび|toddler|超入門|キッズスタート/.test(name);
  const isKids = /キッズ|初中級|初心者|ステップアップ|入門/.test(name);
  const isAdv = /マスター|上級|フリースタイル|finale|オープニング|lock|ハウス|house/.test(
    name
  );
  if (ageGroup === "toddler") return isChibi ? 0.22 : isKids ? 0.08 : -0.06;
  if (ageGroup === "elementary")
    return isKids ? 0.18 : isChibi ? 0.06 : isAdv ? -0.04 : 0.04;
  return isAdv ? 0.16 : isChibi ? -0.08 : 0.04;
}

function castAffinity(show: LightingPlanShow, dancerCount?: number): number {
  if (dancerCount == null || dancerCount <= 0) return 0;
  const diff = Math.abs(show.dancerCount - dancerCount);
  if (diff <= 3) return 0.14;
  if (diff <= 8) return 0.08;
  if (diff <= 15) return 0.03;
  // 大人数 vs 少人数の極端な差は減点
  if (
    (dancerCount <= 12 && show.dancerCount >= 30) ||
    (dancerCount >= 30 && show.dancerCount <= 12)
  ) {
    return -0.08;
  }
  return 0;
}

function scoreCue(
  show: LightingPlanShow,
  cue: (typeof show.cues)[number],
  opts: CorpusMatchContext
): { score: number; reason: string } {
  const mid = (cue.progressStart + cue.progressEnd) / 2;
  const progressDist = Math.abs(mid - opts.progress);
  const progressScore = Math.max(0, 1 - progressDist * 2.2);

  const compat = SECTION_COMPAT[opts.sectionType] ?? [];
  const sectionScore =
    cue.inferredSection === opts.sectionType
      ? 1
      : compat.includes(cue.inferredSection)
        ? 0.55
        : 0.15;

  const energy = opts.energyLevel;
  const energyBias =
    energy >= 0.65
      ? cue.tags.includes("bright") ||
        cue.tags.includes("chorus") ||
        cue.tags.includes("ss") ||
        cue.tags.includes("motion")
        ? 0.16
        : 0
      : cue.tags.includes("atmosphere") ||
          cue.tags.includes("dim") ||
          cue.tags.includes("intro")
        ? 0.12
        : 0;

  const size = castAffinity(show, opts.dancerCount);
  const age = ageAffinity(show, opts.ageGroup);

  let avoid = 0;
  if (opts.avoidPreset && cue.lightingPreset === opts.avoidPreset) {
    avoid = -0.12;
  }

  const score =
    progressScore * 0.48 +
    sectionScore * 0.3 +
    energyBias +
    size +
    age +
    avoid;
  const reason = `t≈${Math.round(opts.progress * 100)}%×${cue.inferredSection}/${opts.sectionType} @${show.title}#${cue.cueNo}`;
  return { score, reason };
}

export function findCorpusMatches(
  opts: CorpusMatchContext
): CorpusLightingMatch[] {
  const shows = opts.shows ?? LIGHTING_PLAN_SHOWS;
  const topK = opts.topK ?? 5;
  const scored: CorpusLightingMatch[] = [];

  for (const show of shows) {
    for (const cue of show.cues) {
      const overlap = progressOverlap(
        opts.progress - 0.05,
        opts.progress + 0.1,
        cue.progressStart,
        cue.progressEnd
      );
      const { score, reason } = scoreCue(show, cue, opts);
      const boosted = score + overlap * 0.28;
      if (boosted < 0.32) continue;
      scored.push({
        showId: show.id,
        showTitle: show.title,
        cue,
        score: boosted,
        reason,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  // 同一ショー偏りを抑え、上位からショー多様性を確保
  const picked: CorpusLightingMatch[] = [];
  const showUsed = new Set<string>();
  for (const m of scored) {
    if (picked.length >= topK) break;
    if (showUsed.has(m.showId) && picked.length < topK - 1) {
      // 2件目以降は別ショー優先
      continue;
    }
    picked.push(m);
    showUsed.add(m.showId);
  }
  // 足りなければスコア順で補充
  for (const m of scored) {
    if (picked.length >= topK) break;
    if (!picked.includes(m)) picked.push(m);
  }
  return picked;
}

export function adviseLightingFromCorpus(
  opts: CorpusMatchContext & { fallbackPreset: LightingPresetId }
): LightingCorpusAdvice {
  const matches = findCorpusMatches(opts);
  if (matches.length === 0) {
    return {
      lightingPreset: opts.fallbackPreset,
      colorMood: "neutral",
      referenceNote: "",
      matches: [],
      preferCorpus: false,
    };
  }

  const votes = new Map<LightingPresetId, number>();
  const moodVotes = new Map<LightingColorMood, number>();
  for (const m of matches) {
    let w = m.score;
    if (opts.avoidPreset && m.cue.lightingPreset === opts.avoidPreset) {
      w *= 0.7;
    }
    votes.set(m.cue.lightingPreset, (votes.get(m.cue.lightingPreset) ?? 0) + w);
    moodVotes.set(
      m.cue.colorMood,
      (moodVotes.get(m.cue.colorMood) ?? 0) + w
    );
  }

  let bestPreset = opts.fallbackPreset;
  let bestVote = -1;
  for (const [p, v] of votes) {
    if (v > bestVote) {
      bestVote = v;
      bestPreset = p;
    }
  }

  // 直前と同じなら2位を検討
  if (opts.avoidPreset && bestPreset === opts.avoidPreset && votes.size > 1) {
    let second: LightingPresetId | null = null;
    let secondV = -1;
    for (const [p, v] of votes) {
      if (p === opts.avoidPreset) continue;
      if (v > secondV) {
        secondV = v;
        second = p;
      }
    }
    if (second && secondV >= bestVote * 0.75) bestPreset = second;
  }

  let bestMood: LightingColorMood = "neutral";
  let bestMoodV = -1;
  for (const [m, v] of moodVotes) {
    if (v > bestMoodV) {
      bestMoodV = v;
      bestMood = m;
    }
  }

  const top = matches[0]!;
  const preferCorpus = top.score >= 0.5;

  // intro は実プランでも SS/ピンスポ始まりが多いので優先
  let chosenPreset = preferCorpus ? bestPreset : opts.fallbackPreset;
  if (opts.sectionType === "intro") {
    const pinHit = matches.find(
      (m) =>
        m.cue.lightingPreset === "pin_spot_dark" ||
        m.cue.tags.includes("pin_spot") ||
        m.cue.tags.includes("ss")
    );
    if (pinHit && pinHit.score >= top.score * 0.7) {
      chosenPreset = "pin_spot_dark";
    }
  }

  return {
    lightingPreset: chosenPreset,
    colorMood: bestMood,
    referenceNote: top.cue.note,
    referenceShowTitle: top.showTitle,
    matches,
    preferCorpus,
  };
}

export function corpusSummary(): {
  showCount: number;
  cueCount: number;
  shows: { id: string; title: string; cues: number }[];
} {
  return {
    showCount: LIGHTING_PLAN_SHOWS.length,
    cueCount: LIGHTING_PLAN_SHOWS.reduce((s, sh) => s + sh.cues.length, 0),
    shows: LIGHTING_PLAN_SHOWS.map((s) => ({
      id: s.id,
      title: s.title,
      cues: s.cues.length,
    })),
  };
}
