import { useMemo } from "react";
import type { DancerSpot } from "../types/choreography";
import {
  dancersForLayoutPreset,
  LAYOUT_PRESET_LABELS,
  PRESET_CATEGORIES,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import {
  DEFAULT_UI_PRESET_MAX_TIER,
  filterPresetCategories,
  type PresetTier,
} from "../lib/formationPresetTiers";

export type FormationPresetPreviewItem = {
  id: LayoutPresetId;
  label: string;
  dancers: DancerSpot[];
};

export type FormationPresetCategoryPreview = {
  label: string;
  items: FormationPresetPreviewItem[];
};

export function useFormationPresetCategoryPreviews(
  count: number,
  spacingOpts: { dancerSpacingMm?: number | null; stageWidthMm?: number | null },
  showAllTiers: boolean
): FormationPresetCategoryPreview[] {
  const maxTier: PresetTier = showAllTiers ? 3 : DEFAULT_UI_PRESET_MAX_TIER;
  const n = Math.max(1, count);

  return useMemo(
    () =>
      filterPresetCategories(PRESET_CATEGORIES, maxTier).map((cat) => ({
        label: cat.label,
        items: cat.ids.map((id) => ({
          id,
          label: LAYOUT_PRESET_LABELS[id] ?? id,
          dancers: dancersForLayoutPreset(n, id, {
            dancerSpacingMm: spacingOpts.dancerSpacingMm ?? undefined,
            stageWidthMm: spacingOpts.stageWidthMm ?? undefined,
          }),
        })),
      })),
    [
      maxTier,
      n,
      spacingOpts.dancerSpacingMm,
      spacingOpts.stageWidthMm,
    ]
  );
}

export function firstPresetIdInCategories(
  categories: FormationPresetCategoryPreview[]
): LayoutPresetId | null {
  return categories[0]?.items[0]?.id ?? null;
}
