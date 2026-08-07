/**
 * sectionType → 照明 / フォーメーション変換テーブル
 */

import type {
  FormationPatternId,
  LightingPresetId,
  SectionType,
} from "./types";

export type SectionLightingRule = {
  sectionType: SectionType;
  lightingPreset: LightingPresetId;
  lightingLabel: string;
  patterns: FormationPatternId[];
  presetName: string;
  algorithmNote: string;
};

export const SECTION_LIGHTING_TABLE: SectionLightingRule[] = [
  {
    sectionType: "intro",
    lightingPreset: "pin_spot_dark",
    lightingLabel: "ピンサス、シルエット、暗転明け",
    patterns: ["center_condensed", "silhouette_line"],
    presetName: "Center Condensed Silhouette",
    algorithmNote: "センター軸の放射・一列・背対",
  },
  {
    sectionType: "verse",
    lightingPreset: "guide_mono",
    lightingLabel: "ガイド光、シックな単色",
    patterns: ["split_lr", "small_groups"],
    presetName: "Left-Right Separate Groups",
    algorithmNote: "前後・左右のシンメトリー",
  },
  {
    sectionType: "chorus",
    lightingPreset: "full_bright_warm",
    lightingLabel: "フル照射、明転、フラッシュ",
    patterns: ["vee", "double_u", "wide_spread"],
    presetName: "Choreographed V-Shape",
    algorithmNote: "視認性最大化（被り自動回避）",
  },
  {
    sectionType: "drop",
    lightingPreset: "strobe_flash",
    lightingLabel: "ストロボ、激しい点滅、色切り替え",
    patterns: ["fast_shift", "circle", "dynamic_cross"],
    presetName: "Dynamic Cross / Circle",
    algorithmNote: "前後完全入れ替え、交差移動",
  },
  {
    sectionType: "se_trigger",
    lightingPreset: "color_switch",
    lightingLabel: "ストロボ、色切り替え",
    patterns: ["dynamic_cross", "fast_shift"],
    presetName: "SE Trigger Burst",
    algorithmNote: "前後完全入れ替え、交差移動",
  },
  {
    sectionType: "outro",
    lightingPreset: "fade_spot",
    lightingLabel: "フェードアウト、スポット光",
    patterns: ["front_asymmetry", "wide_spread"],
    presetName: "Front Asymmetry Pose",
    algorithmNote: "視線集中、非対称シルエット",
  },
];

export function ruleForSection(sectionType: SectionType): SectionLightingRule {
  return (
    SECTION_LIGHTING_TABLE.find((r) => r.sectionType === sectionType) ??
    SECTION_LIGHTING_TABLE[1]!
  );
}

export function pickPattern(
  sectionType: SectionType,
  salt: number,
  allowCross: boolean,
  corpusTags?: string[]
): FormationPatternId {
  const rule = ruleForSection(sectionType);
  let patterns = [...rule.patterns];
  if (!allowCross) {
    patterns = patterns.filter(
      (p) => p !== "dynamic_cross" && p !== "fast_shift"
    );
  }

  // 実プランのタグでフォーメーション優先度を寄せる
  const tags = new Set((corpusTags ?? []).map((t) => t.toLowerCase()));
  if (tags.has("pin_spot") || tags.has("center") || tags.has("solo")) {
    patterns = [
      "center_condensed",
      "silhouette_line",
      ...patterns.filter(
        (p) => p !== "center_condensed" && p !== "silhouette_line"
      ),
    ];
  } else if (tags.has("bright") || tags.has("chorus") || tags.has("lively")) {
    patterns = [
      "vee",
      "wide_spread",
      "double_u",
      ...patterns.filter(
        (p) => p !== "vee" && p !== "wide_spread" && p !== "double_u"
      ),
    ];
  } else if (tags.has("buildup") || tags.has("energy_up")) {
    patterns = [
      "fast_shift",
      "circle",
      ...patterns.filter((p) => p !== "fast_shift" && p !== "circle"),
    ];
  }

  if (!allowCross) {
    patterns = patterns.filter(
      (p) => p !== "dynamic_cross" && p !== "fast_shift"
    );
  }
  if (patterns.length === 0) patterns = ["silhouette_line"];
  return patterns[Math.abs(salt) % patterns.length]!;
}
