import { useMemo } from "react";
import type { DancerSpot } from "../types/choreography";
import {
  dancersForLayoutPreset,
  LAYOUT_PRESET_LABELS,
  PRESET_CATEGORIES,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import { classicSuggestionEntries } from "../lib/formationClassicSuggestions";
import {
  DEFAULT_UI_PRESET_MAX_TIER,
  filterPresetCategories,
  type PresetTier,
} from "../lib/formationPresetTiers";

export const CLASSIC_PRESET_CATEGORY_LABEL = "定番の提案";

export type FormationPresetPreviewItem = {
  id: LayoutPresetId;
  label: string;
  dancers: DancerSpot[];
};

export type FormationPresetCategoryPreview = {
  label: string;
  items: FormationPresetPreviewItem[];
};

export function splitClassicPresetCategories(
  categories: FormationPresetCategoryPreview[]
): {
  classic: FormationPresetCategoryPreview | null;
  catalog: FormationPresetCategoryPreview[];
} {
  let classic: FormationPresetCategoryPreview | null = null;
  const catalog: FormationPresetCategoryPreview[] = [];
  for (const cat of categories) {
    if (cat.label === CLASSIC_PRESET_CATEGORY_LABEL) {
      classic = cat;
    } else {
      catalog.push(cat);
    }
  }
  return { classic, catalog };
}

export function useFormationPresetCategoryPreviews(
  count: number,
  spacingOpts: { dancerSpacingMm?: number | null; stageWidthMm?: number | null },
  showAllTiers: boolean
): FormationPresetCategoryPreview[] {
  const maxTier: PresetTier = showAllTiers ? 3 : DEFAULT_UI_PRESET_MAX_TIER;
  const n = Math.max(1, count);

  return useMemo(() => {
    const opts = {
      dancerSpacingMm: spacingOpts.dancerSpacingMm ?? undefined,
      stageWidthMm: spacingOpts.stageWidthMm ?? undefined,
    };
    const classicItems: FormationPresetPreviewItem[] = classicSuggestionEntries(
      n
    ).map((entry) => ({
      id: entry.id as LayoutPresetId,
      label: entry.label,
      dancers: dancersForLayoutPreset(n, entry.id as LayoutPresetId, opts),
    }));

    const rest = filterPresetCategories(PRESET_CATEGORIES, maxTier).map(
      (cat) => ({
        label: cat.label,
        items: cat.ids.map((id) => ({
          id,
          label: LAYOUT_PRESET_LABELS[id] ?? id,
          dancers: dancersForLayoutPreset(n, id, opts),
        })),
      })
    );

    return [
      { label: CLASSIC_PRESET_CATEGORY_LABEL, items: classicItems },
      ...rest,
    ];
  }, [maxTier, n, spacingOpts.dancerSpacingMm, spacingOpts.stageWidthMm]);
}

export function firstPresetIdInCategories(
  categories: FormationPresetCategoryPreview[]
): LayoutPresetId | null {
  return categories[0]?.items[0]?.id ?? null;
}
