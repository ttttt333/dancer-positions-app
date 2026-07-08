import type { StageFloorMarkup } from "../types/choreography";

/** 閲覧画面のメモ帯に出す床テキスト（重複除去・入力順） */
export function collectViewerStageMemoTexts(
  globalFloorMarkup: StageFloorMarkup[] | null | undefined,
  formationMarkup: StageFloorMarkup[] | null | undefined
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const addItems = (items: StageFloorMarkup[] | null | undefined) => {
    for (const m of items ?? []) {
      if (m.kind !== "text") continue;
      const text = m.text?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  };

  addItems(globalFloorMarkup);
  addItems(formationMarkup);
  return out;
}
